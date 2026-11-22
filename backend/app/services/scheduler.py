"""APScheduler-based in-process cron engine (local dev/test fallback when QStash is unset)."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.base import BaseTrigger
from croniter import CroniterBadDateError, croniter

from app.schemas.task_schema import is_valid_cron_expression

logger = logging.getLogger(__name__)


class CroniterTrigger(BaseTrigger):
    """Use the same UTC cron semantics as the task's next-run calculation."""

    def __init__(self, expression: str) -> None:
        self.expression = expression.strip()

    def get_next_fire_time(
        self, previous_fire_time: datetime | None, now: datetime
    ) -> datetime | None:
        base = previous_fire_time.astimezone(UTC) if previous_fire_time else now.astimezone(UTC)
        try:
            return croniter(self.expression, base).get_next(datetime).astimezone(UTC)
        except (CroniterBadDateError, ValueError, KeyError):
            return None


class TaskSchedulerService:
    """Manages active in-process cron jobs synchronized with PostgreSQL Task records."""

    def __init__(self, on_trigger: Callable[[int], None]) -> None:
        self._on_trigger = on_trigger
        self._scheduler = BackgroundScheduler(
            timezone=UTC,
            job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 60},
        )
        self._started = False

    @property
    def backend_name(self) -> str:
        return "apscheduler"

    def start(self) -> None:
        if not self._started:
            self._scheduler.start()
            self._started = True

    def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False

    @staticmethod
    def _job_id(task_id: int) -> str:
        return f"pulsehook_task_{task_id}"

    def schedule_task(
        self,
        *,
        task_id: int,
        name: str,
        schedule: str,
        status: str,
        webhook_url: str | None = None,
        payload: dict[str, Any] | None = None,
        max_retry: int | None = None,
    ) -> datetime | None:
        """Register or update an active task's cron job; remove it if paused/failed."""
        del webhook_url, payload, max_retry
        job_id = self._job_id(task_id)
        self.unschedule_task(task_id)
        if status != "active":
            return None
        if not is_valid_cron_expression(schedule):
            logger.warning("Skipping task #%s (%s): invalid cron %r", task_id, name, schedule)
            return None

        job = self._scheduler.add_job(
            self._on_trigger,
            trigger=CroniterTrigger(schedule),
            id=job_id,
            name=name,
            args=[task_id],
            replace_existing=True,
        )
        return getattr(job, "next_run_time", None)

    def unschedule_task(self, task_id: int) -> bool:
        try:
            self._scheduler.remove_job(self._job_id(task_id))
            return True
        except JobLookupError:
            return False

    def ensure_keepalive(
        self,
        *,
        health_url: str | None,
        cron: str | None,
        bearer_token: str | None = None,
    ) -> bool:
        del health_url, cron, bearer_token
        return False

    def sync_logs(self, *, force: bool = False) -> int:
        del force
        return 0

    def sync_tasks(self, tasks: list[dict[str, object]]) -> int:
        active_job_ids: set[str] = set()
        for task in tasks:
            task_id = int(task["id"])  # type: ignore[arg-type]
            if str(task["status"]) == "active":
                self.schedule_task(
                    task_id=task_id,
                    name=str(task["name"]),
                    schedule=str(task["schedule"]),
                    status="active",
                )
                active_job_ids.add(self._job_id(task_id))

        for job in self._scheduler.get_jobs():
            if job.id.startswith("pulsehook_task_") and job.id not in active_job_ids:
                self._scheduler.remove_job(job.id)
        return len(self._scheduler.get_jobs())

    def is_scheduled(self, task_id: int) -> bool:
        return self._scheduler.get_job(self._job_id(task_id)) is not None

    def scheduled_count(self) -> int:
        return len(self._scheduler.get_jobs())
