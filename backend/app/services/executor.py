"""Resilient task execution engine with configurable retries, exponential backoff, and concurrency locking."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.extensions import utc_now
from app.models.task import Task
from app.models.task_log import TaskLog
from app.schemas.task_schema import compute_next_run
from app.services.discord_client import DiscordDispatchResult, send_discord_webhook


@dataclass(frozen=True)
class ExecutionOutcome:
    task_id: int
    succeeded: bool
    attempts: int
    final_status: str
    http_status: int | None
    duration_ms: int
    message: str
    skipped_due_to_lock: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "succeeded": self.succeeded,
            "attempts": self.attempts,
            "finalStatus": self.final_status,
            "httpStatus": self.http_status,
            "durationMs": self.duration_ms,
            "message": self.message,
            "skippedDueToLock": self.skipped_due_to_lock,
        }


SendWebhookFn = Callable[[str, dict[str, Any]], DiscordDispatchResult]
SleepFn = Callable[[float], None]


class TaskExecutor:
    """Executes scheduled webhook tasks with per-task retry budgets and persistent execution logging."""

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        *,
        send_fn: SendWebhookFn | None = None,
        sleep_fn: SleepFn | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._session_factory = session_factory
        self._send_fn = send_fn or (
            lambda url, payload: send_discord_webhook(url, payload, timeout_seconds=timeout_seconds)
        )
        self._sleep_fn = sleep_fn or time.sleep
        self._lock = threading.Lock()
        self._in_flight: set[int] = set()

    def execute_by_id(
        self,
        task_id: int,
        *,
        preserve_paused_status: bool = False,
        user_id: int | None = None,
        max_retry_cap: int | None = None,
        max_wall_seconds: float | None = None,
    ) -> ExecutionOutcome | None:
        """Load task snapshot from DB and execute it safely."""
        with self._session_factory() as db:
            query = select(Task).where(Task.id == task_id)
            if user_id is not None:
                query = query.where(Task.user_id == user_id)
            task = db.scalar(query)
            if task is None:
                return None
            snapshot = {
                "id": task.id,
                "user_id": task.user_id,
                "webhook_url": task.webhook_url,
                "payload": dict(task.payload),
                "max_retry": task.max_retry,
                "retry_delay_ms": task.retry_delay_ms,
                "status": task.status,
            }

        return self._execute_snapshot(
            snapshot,
            preserve_paused_status=preserve_paused_status,
            max_retry_cap=max_retry_cap,
            max_wall_seconds=max_wall_seconds,
        )

    def _execute_snapshot(
        self,
        task_data: dict[str, Any],
        *,
        preserve_paused_status: bool = False,
        max_retry_cap: int | None = None,
        max_wall_seconds: float | None = None,
    ) -> ExecutionOutcome:
        task_id = int(task_data["id"])
        with self._lock:
            if task_id in self._in_flight:
                return ExecutionOutcome(
                    task_id=task_id,
                    succeeded=False,
                    attempts=0,
                    final_status="failed",
                    http_status=None,
                    duration_ms=0,
                    message="Task execution already in progress; skipped duplicate run.",
                    skipped_due_to_lock=True,
                )
            self._in_flight.add(task_id)

        try:
            max_retry = max(0, min(10, int(task_data.get("max_retry", 3))))
            if max_retry_cap is not None:
                max_retry = min(max_retry, max(0, max_retry_cap))
            base_delay_ms = max(50, min(60000, int(task_data.get("retry_delay_ms", 1000))))
            user_id = int(task_data["user_id"])
            webhook_url = str(task_data["webhook_url"])
            payload = task_data["payload"]
            original_status = str(task_data.get("status", "active"))
            started_mono = time.monotonic()
            attempt = 0
            log_status = "failed"
            message = "Task execution aborted."
            result = DiscordDispatchResult(
                ok=False, http_status=None, duration_ms=0, message=message
            )

            for attempt in range(max_retry + 1):
                if attempt > 0 and not self._should_continue_retry(
                    task_id=task_id,
                    user_id=user_id,
                    preserve_paused_status=preserve_paused_status,
                ):
                    break
                attempt_time = utc_now()
                result = self._send_fn(webhook_url, payload)

                if result.ok:
                    log_status = "success"
                    message = (
                        f"{result.message} (recovered on retry {attempt}/{max_retry})"
                        if attempt > 0
                        else result.message
                    )
                    next_status = (
                        "paused"
                        if preserve_paused_status and original_status == "paused"
                        else "active"
                    )
                else:
                    log_status = "retrying"
                    delay = (
                        result.retry_after_ms
                        if result.retry_after_ms is not None
                        else base_delay_ms * (2**attempt)
                    )
                    backoff_ms = max(0, min(delay, 30000))
                    wall_exceeded = (
                        max_wall_seconds is not None
                        and (time.monotonic() - started_mono) + (backoff_ms / 1000.0)
                        > max_wall_seconds
                    )
                    if attempt == max_retry or wall_exceeded:
                        log_status = "failed"
                        if wall_exceeded and attempt < max_retry:
                            message = (
                                f"{result.message} (stopped retrying after request time budget)"
                            )
                        elif max_retry > 0:
                            retry_word = "retry" if max_retry == 1 else "retries"
                            message = f"{result.message} (exhausted all {max_retry} {retry_word})"
                        else:
                            message = result.message
                        next_status = (
                            "paused"
                            if preserve_paused_status and original_status == "paused"
                            else "failed"
                        )
                    else:
                        message = (
                            f"{result.message} — retrying in {backoff_ms}ms "
                            f"(attempt {attempt + 1}/{max_retry + 1})"
                        )
                        next_status = None

                self._persist_attempt_and_task(
                    task_id=task_id,
                    user_id=user_id,
                    execution_time=attempt_time,
                    log_status=log_status,
                    retry_count=attempt,
                    http_status=result.http_status,
                    duration_ms=result.duration_ms,
                    message=message,
                    update_task_status=next_status,
                    original_status=original_status,
                )
                if log_status != "retrying":
                    break
                self._sleep_fn(backoff_ms / 1000.0)

            return ExecutionOutcome(
                task_id=task_id,
                succeeded=result.ok,
                attempts=attempt + 1,
                final_status=log_status,
                http_status=result.http_status,
                duration_ms=result.duration_ms,
                message=message,
            )
        finally:
            with self._lock:
                self._in_flight.discard(task_id)

    def _should_continue_retry(
        self, *, task_id: int, user_id: int, preserve_paused_status: bool
    ) -> bool:
        """Abort pending retries if the task was deleted or paused mid-flight."""
        with self._session_factory() as db:
            task = db.get(Task, task_id)
            if task is None or task.user_id != user_id:
                return False
            return preserve_paused_status or task.status == "active"

    def _persist_attempt_and_task(
        self,
        *,
        task_id: int,
        user_id: int,
        execution_time: datetime,
        log_status: str,
        retry_count: int,
        http_status: int | None,
        duration_ms: int,
        message: str,
        update_task_status: str | None,
        original_status: str,
    ) -> None:
        with self._session_factory() as db:
            task = db.get(Task, task_id, with_for_update=True)
            if task is None or task.user_id != user_id:
                return
            log = TaskLog(
                task_id=task_id,
                execution_time=execution_time,
                status=log_status,
                retry_count=retry_count,
                http_status=http_status,
                duration_ms=duration_ms,
                message=message,
            )
            db.add(log)

            if update_task_status is not None:
                if task.status == original_status:
                    task.status = update_task_status
                task.last_run_at = execution_time
                now = utc_now()
                task.next_run_at = (
                    compute_next_run(task.schedule, now) if task.status == "active" else None
                )
                task.updated_at = now

            db.commit()
