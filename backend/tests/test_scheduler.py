"""Unit tests for cron schedule validation and TaskSchedulerService."""

from __future__ import annotations

import pickle
from datetime import UTC, datetime

import pytest

from app.schemas.task_schema import compute_next_run, is_valid_cron_expression
from app.services.scheduler import CroniterTrigger, TaskSchedulerService


def test_cron_validation_and_next_run():
    assert is_valid_cron_expression("0 9 * * 1-5") is True
    assert is_valid_cron_expression("*/15 * * * *") is True
    assert is_valid_cron_expression("not a cron") is False
    assert is_valid_cron_expression("* * *") is False
    assert compute_next_run("0 * * * *") is not None
    assert compute_next_run("bad cron") is None


def test_trigger_uses_standard_cron_days_and_preserves_missed_fires():
    friday = datetime(2025, 1, 3, 8, tzinfo=UTC)
    sunday = datetime(2025, 1, 5, 9, tzinfo=UTC)
    trigger = pickle.loads(pickle.dumps(CroniterTrigger("0 9 * * 0")))
    assert trigger.get_next_fire_time(None, friday) == sunday
    assert trigger.get_next_fire_time(None, friday) == compute_next_run("0 9 * * 0", friday)

    trigger = CroniterTrigger("0 9 1 * 0")
    assert trigger.get_next_fire_time(None, friday) == sunday
    assert trigger.get_next_fire_time(sunday, datetime(2025, 1, 15, tzinfo=UTC)) == datetime(
        2025, 1, 12, 9, tzinfo=UTC
    )
    assert trigger.get_next_fire_time(None, sunday) == compute_next_run("0 9 1 * 0", sunday)
    assert trigger.get_next_fire_time(sunday, sunday) == datetime(2025, 1, 12, 9, tzinfo=UTC)
    assert CroniterTrigger("0 0 31 2 *").get_next_fire_time(None, friday) is None


def test_scheduler_rejects_multiple_configured_workers(app_factory, monkeypatch):
    monkeypatch.setenv("GUNICORN_WORKERS", "2")
    with pytest.raises(RuntimeError, match="single.*worker"):
        app_factory(enable_scheduler=True)


def test_scheduler_registers_active_and_removes_paused_tasks():
    triggered: list[int] = []
    scheduler = TaskSchedulerService(on_trigger=lambda task_id: triggered.append(task_id))

    try:
        active_count = scheduler.sync_tasks(
            [
                {"id": 1, "name": "Active Hourly", "schedule": "0 * * * *", "status": "active"},
                {"id": 2, "name": "Paused Daily", "schedule": "0 9 * * *", "status": "paused"},
                {"id": 3, "name": "Failed Job", "schedule": "*/5 * * * *", "status": "failed"},
                {"id": 4, "name": "Active Minute", "schedule": "* * * * *", "status": "active"},
            ]
        )

        assert active_count == 2
        assert scheduler.is_scheduled(1) is True
        assert scheduler.is_scheduled(2) is False
        assert scheduler.is_scheduled(3) is False
        assert scheduler.is_scheduled(4) is True

        scheduler.schedule_task(
            task_id=4, name="Updated Minute", schedule="*/2 * * * *", status="active"
        )
        assert scheduler.scheduled_count() == 2

        scheduler.schedule_task(
            task_id=4, name="Active Minute", schedule="bad cron", status="active"
        )
        assert scheduler.is_scheduled(4) is False
        scheduler.schedule_task(
            task_id=4, name="Active Minute", schedule="* * * * *", status="active"
        )

        # Pausing task #1 unschedules it
        scheduler.schedule_task(
            task_id=1, name="Active Hourly", schedule="0 * * * *", status="paused"
        )
        assert scheduler.is_scheduled(1) is False
        assert scheduler.scheduled_count() == 1

        # Unscheduling non-existent task returns False
        assert scheduler.unschedule_task(9999) is False

        # Syncing empty list clears all jobs
        assert scheduler.sync_tasks([]) == 0
    finally:
        scheduler.shutdown()
