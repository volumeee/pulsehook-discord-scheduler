"""Unit tests for TaskExecutor retry mechanism, exponential backoff, and exhaustion logging."""

from __future__ import annotations

import threading
from datetime import UTC, datetime

from requests import Response

from app.models.task import Task
from app.models.task_log import TaskLog
from app.models.user import User
from app.services.discord_client import DiscordDispatchResult, send_discord_webhook
from app.services.executor import TaskExecutor
from tests.conftest import VALID_DISCORD_WEBHOOK


def _seed_task(session_factory, *, max_retry: int = 3, retry_delay_ms: int = 200) -> int:
    with session_factory() as db:
        user = User(
            username="test-user",
            username_lower="test-user",
            email="test-user@example.com",
            password_hash="test-hash",
            is_email_verified=True,
        )
        db.add(user)
        db.flush()
        task = Task(
            user_id=user.id,
            name="Release Dispatch",
            schedule="0 9 * * *",
            webhook_url=VALID_DISCORD_WEBHOOK,
            payload={"content": "Release shipped!"},
            max_retry=max_retry,
            retry_delay_ms=retry_delay_ms,
            next_run_at=datetime(2030, 1, 1, tzinfo=UTC),
            status="active",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task.id


def test_executor_succeeds_first_attempt(app_factory):
    sleeps: list[float] = []
    app = app_factory(sleep_fn=lambda s: sleeps.append(s))
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory)

    outcome = app.extensions["executor"].execute_by_id(task_id)
    assert outcome is not None
    assert outcome.succeeded is True
    assert outcome.attempts == 1
    assert sleeps == []

    with session_factory() as db:
        logs = db.query(TaskLog).filter_by(task_id=task_id).all()
        assert len(logs) == 1
        assert logs[0].status == "success"
        assert logs[0].retry_count == 0


def test_executor_retries_with_exponential_backoff_and_recovers(app_factory):
    sleeps: list[float] = []
    calls = {"count": 0}

    def flaky_sender(_url, _payload):
        calls["count"] += 1
        if calls["count"] <= 2:
            return DiscordDispatchResult(
                ok=False,
                http_status=503,
                duration_ms=110,
                message="Discord rejected payload (HTTP 503): Service Unavailable",
            )
        return DiscordDispatchResult(
            ok=True,
            http_status=204,
            duration_ms=40,
            message="Delivered to Discord webhook (HTTP 204)",
        )

    app = app_factory(send_webhook_fn=flaky_sender, sleep_fn=lambda s: sleeps.append(s))
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory, max_retry=3, retry_delay_ms=200)

    outcome = app.extensions["executor"].execute_by_id(task_id)
    assert outcome is not None
    assert outcome.succeeded is True
    assert outcome.attempts == 3
    assert sleeps == [0.2, 0.4]

    with session_factory() as db:
        logs = db.query(TaskLog).filter_by(task_id=task_id).order_by(TaskLog.id).all()
        assert [entry.status for entry in logs] == ["retrying", "retrying", "success"]
        assert logs[-1].retry_count == 2


def test_executor_exhausts_retries_and_marks_task_failed(app_factory):
    sleeps: list[float] = []

    def always_fail(_url, _payload):
        return DiscordDispatchResult(
            ok=False,
            http_status=500,
            duration_ms=85,
            message="Discord rejected payload (HTTP 500): Internal Server Error",
        )

    app = app_factory(send_webhook_fn=always_fail, sleep_fn=lambda s: sleeps.append(s))
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory, max_retry=2, retry_delay_ms=100)

    outcome = app.extensions["executor"].execute_by_id(task_id)
    assert outcome is not None
    assert outcome.succeeded is False
    assert outcome.attempts == 3
    assert outcome.final_status == "failed"
    assert sleeps == [0.1, 0.2]

    with session_factory() as db:
        task = db.get(Task, task_id)
        assert task is not None
        assert task.status == "failed"
        assert task.next_run_at is None
        logs = db.query(TaskLog).filter_by(task_id=task_id).order_by(TaskLog.id).all()
        assert [entry.status for entry in logs] == ["retrying", "retrying", "failed"]


def test_executor_rejects_a_different_task_owner(app_factory):
    app = app_factory()
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory)
    with session_factory() as db:
        owner_id = db.get(Task, task_id).user_id

    assert app.extensions["executor"].execute_by_id(task_id, user_id=owner_id + 1) is None
    with session_factory() as db:
        assert db.query(TaskLog).filter_by(task_id=task_id).count() == 0


def test_discord_retry_after_is_bounded_for_extreme_values():
    response = Response()
    response.status_code = 429
    response.reason = "Too Many Requests"
    response.headers["Retry-After"] = "1e309"
    response._content = b"{}"
    result = send_discord_webhook(
        VALID_DISCORD_WEBHOOK, {"content": "test"}, post_fn=lambda *args, **kwargs: response
    )
    assert result.retry_after_ms == 30000


def test_discord_redirect_is_not_followed():
    response = Response()
    response.status_code = 302
    response.reason = "Found"
    response.headers["Location"] = "http://127.0.0.1/private"
    response._content = b""
    captured = {}

    def redirecting_post(*args, **kwargs):
        captured.update(kwargs)
        return response

    result = send_discord_webhook(
        VALID_DISCORD_WEBHOOK, {"content": "test"}, post_fn=redirecting_post
    )
    assert captured["allow_redirects"] is False
    assert result.ok is False
    assert result.http_status == 302


def test_scheduled_failure_clears_next_run_and_removes_job(app_factory):
    def always_fail(_url, _payload):
        return DiscordDispatchResult(ok=False, http_status=500, duration_ms=1, message="failed")

    app = app_factory(send_webhook_fn=always_fail)
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory, max_retry=0)
    scheduler = app.extensions["scheduler"]
    scheduler.schedule_task(
        task_id=task_id, name="Release Dispatch", schedule="0 9 * * *", status="active"
    )
    job = scheduler._scheduler.get_job(scheduler._job_id(task_id))
    job.func(*job.args)

    with session_factory() as db:
        task = db.get(Task, task_id)
        assert task.status == "failed"
        assert task.next_run_at is None
    assert not scheduler.is_scheduled(task_id)


def test_executor_preserves_pause_during_dispatch(app_factory):
    def pause_then_succeed(_url, _payload):
        with session_factory() as db:
            task = db.get(Task, task_id)
            task.status = "paused"
            task.next_run_at = None
            db.commit()
        return DiscordDispatchResult(ok=True, http_status=204, duration_ms=1, message="OK")

    app = app_factory(send_webhook_fn=pause_then_succeed)
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory)
    outcome = app.extensions["executor"].execute_by_id(task_id)

    assert outcome.succeeded is True
    with session_factory() as db:
        task = db.get(Task, task_id)
        assert task.status == "paused"
        assert task.next_run_at is None


def test_executor_uses_schedule_edited_during_dispatch(app_factory):
    def reschedule_then_succeed(_url, _payload):
        with session_factory() as db:
            task = db.get(Task, task_id)
            task.schedule = "0 0 1 1 *"
            db.commit()
        return DiscordDispatchResult(ok=True, http_status=204, duration_ms=1, message="OK")

    app = app_factory(send_webhook_fn=reschedule_then_succeed)
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory)
    outcome = app.extensions["executor"].execute_by_id(task_id)

    assert outcome.succeeded is True
    with session_factory() as db:
        task = db.get(Task, task_id)
        assert task.next_run_at.month == 1
        assert task.next_run_at.day == 1
        assert task.next_run_at.hour == 0
        assert task.next_run_at.minute == 0


def test_executor_skips_overlapping_concurrent_run(app_factory):
    started_event = threading.Event()
    release_event = threading.Event()

    def slow_sender(_url, _payload):
        started_event.set()
        release_event.wait(timeout=3)
        return DiscordDispatchResult(ok=True, http_status=204, duration_ms=15, message="OK")

    app = app_factory(send_webhook_fn=slow_sender)
    session_factory = app.extensions["session_factory"]
    task_id = _seed_task(session_factory)
    executor: TaskExecutor = app.extensions["executor"]

    first_result = {}

    def runner():
        first_result["outcome"] = executor.execute_by_id(task_id)

    t = threading.Thread(target=runner)
    t.start()
    assert started_event.wait(timeout=2)

    second_outcome = executor.execute_by_id(task_id)
    assert second_outcome is not None
    assert second_outcome.skipped_due_to_lock is True

    release_event.set()
    t.join(timeout=3)
    assert first_result["outcome"].succeeded is True
