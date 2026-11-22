"""Account-scoped task management and global scheduler access."""

from __future__ import annotations

from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, sessionmaker

from app.extensions import ensure_utc, utc_now
from app.models.task import Task
from app.schemas.task_schema import CreateTaskSchema, UpdateTaskSchema, compute_next_run
from app.services.starter_samples import STARTER_SAMPLE_TASKS


class TaskService:
    """Data-access and domain logic service backed by SQLAlchemy sessions."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def list_tasks(
        self, *, user_id: int, status: str | None = None, search: str | None = None
    ) -> list[dict[str, Any]]:
        with self._session_factory() as db:
            stmt = (
                select(Task)
                .where(Task.user_id == user_id)
                .order_by(desc(Task.updated_at), desc(Task.id))
            )
            if status and status != "all":
                stmt = stmt.where(Task.status == status)
            if search and search.strip():
                stmt = stmt.where(Task.name.icontains(search.strip(), autoescape=True))
            rows = db.execute(stmt).scalars().all()
            return [row.to_dict() for row in rows]

    def list_tasks_for_scheduler(self, *, refresh_next_run: bool = False) -> list[dict[str, Any]]:
        with self._session_factory() as db:
            tasks = (
                db.execute(select(Task).order_by(desc(Task.updated_at), desc(Task.id)))
                .scalars()
                .all()
            )
            if refresh_next_run:
                now = utc_now()
                dirty = False
                for task in tasks:
                    if task.status != "active":
                        continue
                    current_next = (
                        ensure_utc(task.next_run_at) if task.next_run_at is not None else None
                    )
                    if current_next is None or current_next <= now:
                        task.next_run_at = compute_next_run(task.schedule, now)
                        dirty = True
                if dirty:
                    db.commit()
            return [task.to_dict() for task in tasks]

    def get_task_for_scheduler(self, task_id: int) -> dict[str, Any] | None:
        with self._session_factory() as db:
            task = db.get(Task, task_id)
            return task.to_dict() if task else None

    def get_task(self, task_id: int, *, user_id: int) -> dict[str, Any] | None:
        with self._session_factory() as db:
            task = db.execute(
                select(Task).where(Task.id == task_id, Task.user_id == user_id)
            ).scalar_one_or_none()
            return task.to_dict() if task else None

    def create_task(self, data: CreateTaskSchema, *, user_id: int) -> dict[str, Any]:
        now = utc_now()
        next_run = compute_next_run(data.schedule, now) if data.status == "active" else None
        with self._session_factory() as db:
            task = Task(
                user_id=user_id,
                name=data.name,
                schedule=data.schedule,
                webhook_url=data.webhook_url,
                payload=data.payload.to_clean_dict(),
                max_retry=data.max_retry,
                retry_delay_ms=data.retry_delay_ms,
                status=data.status,
                next_run_at=next_run,
                created_at=now,
                updated_at=now,
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            return task.to_dict()

    def update_task(
        self, task_id: int, data: UpdateTaskSchema, *, user_id: int
    ) -> dict[str, Any] | None:
        with self._session_factory() as db:
            task = db.execute(
                select(Task).where(Task.id == task_id, Task.user_id == user_id).with_for_update()
            ).scalar_one_or_none()
            if task is None:
                return None

            if data.name is not None:
                task.name = data.name
            if data.schedule is not None:
                task.schedule = data.schedule
            if data.webhook_url is not None:
                task.webhook_url = data.webhook_url
            if data.payload is not None:
                task.payload = data.payload.to_clean_dict()
            if data.max_retry is not None:
                task.max_retry = data.max_retry
            if data.retry_delay_ms is not None:
                task.retry_delay_ms = data.retry_delay_ms
            if data.status is not None:
                task.status = data.status

            now = utc_now()
            task.next_run_at = compute_next_run(task.schedule, now) if task.status == "active" else None
            task.updated_at = now
            db.commit()
            db.refresh(task)
            return task.to_dict()

    def delete_task(self, task_id: int, *, user_id: int) -> bool:
        with self._session_factory() as db:
            task = db.execute(
                select(Task).where(Task.id == task_id, Task.user_id == user_id)
            ).scalar_one_or_none()
            if task is None:
                return False
            db.delete(task)
            db.commit()
            return True

    def duplicate_task(self, task_id: int, *, user_id: int) -> dict[str, Any] | None:
        with self._session_factory() as db:
            original = db.execute(
                select(Task).where(Task.id == task_id, Task.user_id == user_id)
            ).scalar_one_or_none()
            if original is None:
                return None
            now = utc_now()
            clone = Task(
                user_id=user_id,
                name=f"{original.name} (Copy)"[:120],
                schedule=original.schedule,
                webhook_url=original.webhook_url,
                payload=dict(original.payload),
                max_retry=original.max_retry,
                retry_delay_ms=original.retry_delay_ms,
                status="paused",
                next_run_at=None,
                created_at=now,
                updated_at=now,
            )
            db.add(clone)
            db.commit()
            db.refresh(clone)
            return clone.to_dict()

    def seed_sample_tasks(self, *, user_id: int) -> list[dict[str, Any]]:
        now = utc_now()
        created: list[dict[str, Any]] = []
        with self._session_factory() as db:
            for sample in STARTER_SAMPLE_TASKS:
                task = Task(
                    user_id=user_id,
                    name=sample["name"],
                    schedule=sample["schedule"],
                    webhook_url=sample["webhook_url"],
                    payload=sample["payload"],
                    max_retry=sample["max_retry"],
                    retry_delay_ms=sample["retry_delay_ms"],
                    status=sample["status"],
                    next_run_at=None,
                    created_at=now,
                    updated_at=now,
                )
                db.add(task)
                db.flush()
                created.append(task.to_dict())
            db.commit()
        return created
