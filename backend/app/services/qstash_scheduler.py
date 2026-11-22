"""Upstash QStash v2 remote cron scheduler and idempotent on-demand log synchronizer."""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import UTC, datetime
from typing import Any

import requests
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.extensions import ensure_utc, utc_now
from app.models.task import Task
from app.models.task_log import TaskLog
from app.schemas.task_schema import (
    compute_next_run,
    is_valid_cron_expression,
    validate_discord_webhook_url,
)

logger = logging.getLogger(__name__)

TASK_SCHEDULE_PREFIX = "pulsehook_task_"
KEEPALIVE_SCHEDULE_ID = "pulsehook_keepalive"
_TERMINAL_STATES = {"DELIVERED": "success", "FAILED": "failed", "ERROR": "failed"}


class QStashSchedulerService:
    """Schedules Discord webhook cron jobs via Upstash QStash v2 and syncs delivery logs on demand."""

    def __init__(
        self,
        *,
        session_factory: sessionmaker[Session],
        qstash_url: str,
        qstash_token: str,
        max_retries: int = 3,
        log_sync_ttl_seconds: float = 15.0,
        timeout_seconds: float = 10.0,
        http_session: requests.Session | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._base_url = qstash_url.rstrip("/")
        self._token = qstash_token.strip()
        self._max_retries = max(0, max_retries)
        self._log_sync_ttl = max(0.0, log_sync_ttl_seconds)
        self._timeout = timeout_seconds
        self._http = http_session or requests.Session()
        self._sync_lock = threading.Lock()
        self._last_log_sync = 0.0
        self._scheduled_ids: set[int] = set()

    @property
    def backend_name(self) -> str:
        return "qstash"

    def start(self) -> None:
        pass

    def shutdown(self) -> None:
        pass

    @staticmethod
    def schedule_id(task_id: int) -> str:
        return f"{TASK_SCHEDULE_PREFIX}{task_id}"

    @staticmethod
    def _parse_task_id(schedule_id: str | None) -> int | None:
        if not schedule_id or not schedule_id.startswith(TASK_SCHEDULE_PREFIX):
            return None
        suffix = schedule_id[len(TASK_SCHEDULE_PREFIX) :]
        return int(suffix) if suffix.isdigit() else None

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        base = {"Authorization": f"Bearer {self._token}"}
        if extra:
            base.update(extra)
        return base

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response | None:
        url = f"{self._base_url}{path}"
        headers = self._headers(kwargs.pop("headers", None))
        try:
            return self._http.request(method, url, headers=headers, timeout=self._timeout, **kwargs)
        except requests.RequestException as exc:
            logger.warning("QStash %s %s failed: %s", method, path, exc)
            return None

    @staticmethod
    def _safe_json(resp: requests.Response, default: Any) -> Any:
        if not resp.content:
            return default
        try:
            return resp.json()
        except ValueError:
            logger.warning("QStash returned invalid JSON (status=%s)", resp.status_code)
            return default

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
        if status != "active":
            self.unschedule_task(task_id)
            return None
        if not is_valid_cron_expression(schedule):
            logger.warning("Skipping QStash schedule for task #%s (%s): invalid cron %r", task_id, name, schedule)
            return None

        resolved_url, resolved_payload, resolved_retry = self._resolve_task_target(
            task_id, webhook_url, payload, max_retry
        )
        if not resolved_url:
            return None
        ok, reason = validate_discord_webhook_url(resolved_url)
        if not ok:
            logger.warning("Skipping QStash schedule for task #%s: %s", task_id, reason)
            return None

        retries = min(resolved_retry, self._max_retries)
        resp = self._request(
            "POST",
            f"/v2/schedules/{resolved_url}",
            headers={
                "Content-Type": "application/json",
                "Upstash-Cron": schedule.strip(),
                "Upstash-Schedule-Id": self.schedule_id(task_id),
                "Upstash-Retries": str(max(0, retries)),
                "Upstash-Method": "POST",
            },
            data=json.dumps(resolved_payload or {}, separators=(",", ":")),
        )
        if resp is None or not (200 <= resp.status_code < 300):
            code = resp.status_code if resp is not None else "network_error"
            logger.warning("QStash upsert failed for task #%s (status=%s)", task_id, code)
            return None

        self._scheduled_ids.add(task_id)
        return compute_next_run(schedule)

    def _resolve_task_target(
        self,
        task_id: int,
        webhook_url: str | None,
        payload: dict[str, Any] | None,
        max_retry: int | None,
    ) -> tuple[str | None, dict[str, Any] | None, int]:
        if webhook_url is not None and payload is not None and max_retry is not None:
            return webhook_url, payload, max_retry
        with self._session_factory() as db:
            task = db.get(Task, task_id)
            if task is None:
                return None, None, self._max_retries
            return (
                webhook_url or task.webhook_url,
                payload if payload is not None else task.payload,
                max_retry if max_retry is not None else task.max_retry,
            )

    def unschedule_task(self, task_id: int) -> bool:
        self._scheduled_ids.discard(task_id)
        resp = self._request("DELETE", f"/v2/schedules/{self.schedule_id(task_id)}")
        if resp is None:
            return False
        return resp.status_code in {200, 204, 404}

    def ensure_keepalive(
        self,
        *,
        health_url: str | None,
        cron: str | None,
        bearer_token: str | None = None,
    ) -> bool:
        if not health_url or not cron or not is_valid_cron_expression(cron):
            return False
        headers = {
            "Upstash-Cron": cron.strip(),
            "Upstash-Schedule-Id": KEEPALIVE_SCHEDULE_ID,
            "Upstash-Retries": "2",
            "Upstash-Method": "GET",
        }
        cleaned_token = bearer_token.strip() if bearer_token else ""
        if cleaned_token:
            headers["Upstash-Forward-Authorization"] = f"Bearer {cleaned_token}"
        resp = self._request(
            "POST",
            f"/v2/schedules/{health_url.strip()}",
            headers=headers,
        )
        ok = resp is not None and 200 <= resp.status_code < 300
        if not ok:
            logger.warning("QStash keep-alive upsert failed for %s", health_url)
        return ok

    def sync_tasks(self, tasks: list[dict[str, Any]]) -> int:
        active_ids: set[int] = set()
        for task in tasks:
            task_id = int(task["id"])
            if str(task["status"]) == "active":
                scheduled = self.schedule_task(
                    task_id=task_id,
                    name=str(task["name"]),
                    schedule=str(task["schedule"]),
                    status="active",
                    webhook_url=str(task.get("webhookUrl") or "") or None,
                    payload=task.get("payload") if isinstance(task.get("payload"), dict) else None,
                    max_retry=int(task["maxRetry"]) if task.get("maxRetry") is not None else None,
                )
                if scheduled is not None:
                    active_ids.add(task_id)

        resp = self._request("GET", "/v2/schedules")
        if resp is not None and resp.status_code == 200:
            remote_items = self._safe_json(resp, [])
            for item in remote_items if isinstance(remote_items, list) else []:
                remote_tid = self._parse_task_id(str(item.get("scheduleId") or ""))
                if remote_tid is not None and remote_tid not in active_ids:
                    self.unschedule_task(remote_tid)

        self._scheduled_ids = active_ids
        return len(active_ids)

    def sync_logs(self, *, force: bool = False) -> int:
        """Pull terminal QStash delivery events into task_logs idempotently via external_id."""
        now_mono = time.monotonic()
        if not force and (now_mono - self._last_log_sync) < self._log_sync_ttl:
            return 0
        if not self._sync_lock.acquire(blocking=False):
            return 0
        try:
            self._last_log_sync = time.monotonic()
            resp = self._request("GET", "/v2/logs", params={"count": 100})
            if resp is None or resp.status_code != 200 or not resp.content:
                return 0
            payload = self._safe_json(resp, {})
            entries = payload.get("logs", []) if isinstance(payload, dict) else []
            return self._ingest_log_entries(entries)
        finally:
            self._sync_lock.release()

    def _ingest_log_entries(self, entries: list[Any]) -> int:
        candidates: dict[str, tuple[int, str, dict[str, Any]]] = {}
        for item in entries:
            if not isinstance(item, dict):
                continue
            ext_id = str(item.get("messageId") or "").strip()
            task_id = self._parse_task_id(str(item.get("scheduleId") or ""))
            mapped_status = _TERMINAL_STATES.get(str(item.get("state") or "").upper())
            if ext_id and task_id is not None and mapped_status:
                candidates[ext_id] = (task_id, mapped_status, item)

        if not candidates:
            return 0

        with self._session_factory() as db:
            existing_ext = set(
                db.execute(
                    select(TaskLog.external_id).where(TaskLog.external_id.in_(list(candidates)))
                )
                .scalars()
                .all()
            )
            needed_task_ids = {tid for ext_id, (tid, _, _) in candidates.items() if ext_id not in existing_ext}
            if not needed_task_ids:
                return 0

            tasks_by_id = {
                task.id: task
                for task in db.execute(select(Task).where(Task.id.in_(list(needed_task_ids)))).scalars().all()
            }
            inserted = 0
            latest_run_by_task: dict[int, datetime] = {}

            for ext_id, (task_id, status, item) in candidates.items():
                if ext_id in existing_ext or task_id not in tasks_by_id:
                    continue
                raw_ms = item.get("time")
                exec_time = (
                    datetime.fromtimestamp(int(raw_ms) / 1000.0, tz=UTC)
                    if isinstance(raw_ms, (int, float)) and raw_ms > 0
                    else utc_now()
                )
                http_status = item.get("responseStatus")
                http_code = (
                    http_status
                    if isinstance(http_status, int) and not isinstance(http_status, bool)
                    else None
                )
                raw_retried = item.get("retried")
                retry_count = (
                    raw_retried
                    if isinstance(raw_retried, int) and not isinstance(raw_retried, bool)
                    else 0
                )
                err_text = str(item.get("error") or "").strip()
                msg = (
                    f"QStash delivered webhook (HTTP {http_code or 204})."
                    if status == "success"
                    else (err_text or f"QStash delivery failed (HTTP {http_code or 'error'}).")
                )
                db.add(
                    TaskLog(
                        task_id=task_id,
                        external_id=ext_id,
                        execution_time=exec_time,
                        status=status,
                        retry_count=max(0, retry_count),
                        http_status=http_code,
                        duration_ms=0,
                        message=msg[:500],
                    )
                )
                prev = latest_run_by_task.get(task_id)
                if prev is None or exec_time > prev:
                    latest_run_by_task[task_id] = exec_time
                inserted += 1

            for task_id, exec_time in latest_run_by_task.items():
                task = tasks_by_id[task_id]
                if task.last_run_at is None or exec_time > ensure_utc(task.last_run_at):
                    task.last_run_at = exec_time
                if task.status == "active":
                    task.next_run_at = compute_next_run(task.schedule, utc_now())

            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                return 0
            return inserted

    def is_scheduled(self, task_id: int) -> bool:
        return task_id in self._scheduled_ids

    def scheduled_count(self) -> int:
        return len(self._scheduled_ids)
