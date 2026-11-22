"""Tests for Upstash QStash v2 scheduling, idempotent log sync, and per-user bootstrap isolation."""

from __future__ import annotations

import json
from typing import Any

from app.extensions import utc_now
from app.models.user import User
from app.services.auth import hash_password
from app.services.qstash_scheduler import KEEPALIVE_SCHEDULE_ID, QStashSchedulerService
from app.services.security import ACCESS_COOKIE_NAME


class _FakeResponse:
    def __init__(self, status_code: int = 200, payload: Any = None) -> None:
        self.status_code = status_code
        self._payload = payload
        self.content = b"" if payload is None else json.dumps(payload).encode("utf-8")

    def json(self) -> Any:
        return self._payload


class _FakeQStashSession:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.remote_schedules: list[dict[str, Any]] = []
        self.remote_logs: list[dict[str, Any]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> _FakeResponse:
        self.calls.append({"method": method, "url": url, **kwargs})
        if method == "GET" and url.endswith("/v2/schedules"):
            return _FakeResponse(200, self.remote_schedules)
        if method == "GET" and "/v2/logs" in url:
            return _FakeResponse(200, {"logs": self.remote_logs})
        if method == "POST" and "/v2/schedules/" in url:
            return _FakeResponse(201, {"scheduleId": kwargs["headers"]["Upstash-Schedule-Id"]})
        if method == "DELETE" and "/v2/schedules/" in url:
            return _FakeResponse(200, {"deleted": True})
        return _FakeResponse(404, {"error": "not found"})


def test_qstash_schedule_upsert_sync_keepalive_and_idempotent_logs(app_factory):
    app = app_factory()
    sf = app.extensions["session_factory"]
    task_service = app.extensions["task_service"]
    log_service = app.extensions["log_service"]

    with sf() as db:
        user = User(
            username="qstash_owner",
            username_lower="qstash_owner",
            email="qstash_owner@example.com",
            password_hash=hash_password("Str0ngPass!123"),
            is_email_verified=True,
            verified_at=utc_now(),
        )
        db.add(user)
        db.commit()
        user_id = user.id

    from app.schemas.task_schema import CreateTaskSchema

    t_active = task_service.create_task(
        CreateTaskSchema(
            name="Standup Reminder",
            schedule="0 9 * * 1-5",
            webhookUrl="https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234",
            payload={"content": "Standup time"},
            maxRetry=3,
            status="active",
        ),
        user_id=user_id,
    )
    t_paused = task_service.create_task(
        CreateTaskSchema(
            name="Paused Job",
            schedule="0 10 * * *",
            webhookUrl="https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234",
            payload={"content": "Paused"},
            maxRetry=2,
            status="paused",
        ),
        user_id=user_id,
    )

    fake_http = _FakeQStashSession()
    fake_http.remote_schedules = [
        {"scheduleId": f"pulsehook_task_{t_paused['id']}"},
        {"scheduleId": "pulsehook_task_99999"},
        {"scheduleId": KEEPALIVE_SCHEDULE_ID},
        {"scheduleId": "other_app_job"},
    ]

    scheduler = QStashSchedulerService(
        session_factory=sf,
        qstash_url="https://qstash.upstash.io",
        qstash_token="qstash_test_token",
        max_retries=3,
        log_sync_ttl_seconds=0.0,
        http_session=fake_http,  # type: ignore[arg-type]
    )

    count = scheduler.sync_tasks([t_active, t_paused])
    assert count == 1
    assert scheduler.is_scheduled(t_active["id"]) is True
    assert scheduler.is_scheduled(t_paused["id"]) is False

    # Confirm active task was upserted directly to Discord webhook with deterministic schedule ID
    post_calls = [c for c in fake_http.calls if c["method"] == "POST"]
    assert len(post_calls) == 1
    assert post_calls[0]["url"].endswith(t_active["webhookUrl"])
    assert post_calls[0]["headers"]["Upstash-Schedule-Id"] == f"pulsehook_task_{t_active['id']}"
    assert post_calls[0]["headers"]["Upstash-Cron"] == "0 9 * * 1-5"
    assert json.loads(post_calls[0]["data"]) == {"content": "Standup time"}

    # Confirm stale PulseHook schedules were deleted, while keepalive & foreign schedules were untouched
    deleted_urls = [c["url"] for c in fake_http.calls if c["method"] == "DELETE"]
    assert any(u.endswith(f"/v2/schedules/pulsehook_task_{t_paused['id']}") for u in deleted_urls)
    assert any(u.endswith("/v2/schedules/pulsehook_task_99999") for u in deleted_urls)
    assert not any(KEEPALIVE_SCHEDULE_ID in u or "other_app_job" in u for u in deleted_urls)

    # Keepalive schedule upsert (with private port bearer token forwarding)
    assert (
        scheduler.ensure_keepalive(
            health_url="https://5001-example.instabox.tech/api/health",
            cron="*/10 * * * *",
            bearer_token="ibp_secret_token",
        )
        is True
    )
    keepalive_call = fake_http.calls[-1]
    assert keepalive_call["url"].endswith("/v2/schedules/https://5001-example.instabox.tech/api/health")
    assert keepalive_call["headers"]["Upstash-Schedule-Id"] == KEEPALIVE_SCHEDULE_ID
    assert keepalive_call["headers"]["Upstash-Method"] == "GET"
    assert keepalive_call["headers"]["Upstash-Retries"] == "2"
    assert keepalive_call["headers"]["Upstash-Forward-Authorization"] == "Bearer ibp_secret_token"
    # Idempotent log sync
    fake_http.remote_logs = [
        {
            "messageId": "msg_001",
            "scheduleId": f"pulsehook_task_{t_active['id']}",
            "state": "CREATED",
            "time": 1763800000000,
        },
        {
            "messageId": "msg_001",
            "scheduleId": f"pulsehook_task_{t_active['id']}",
            "state": "DELIVERED",
            "responseStatus": 204,
            "retried": 0,
            "time": 1763800001000,
        },
        {
            "messageId": "msg_002",
            "scheduleId": f"pulsehook_task_{t_active['id']}",
            "state": "FAILED",
            "responseStatus": 429,
            "retried": 2,
            "error": "rate limited",
            "time": 1763800005000,
        },
        {
            "messageId": "msg_keepalive",
            "scheduleId": KEEPALIVE_SCHEDULE_ID,
            "state": "DELIVERED",
            "responseStatus": 200,
            "time": 1763800006000,
        },
    ]

    inserted_first = scheduler.sync_logs(force=True)
    inserted_second = scheduler.sync_logs(force=True)
    assert inserted_first == 2
    assert inserted_second == 0

    logs = log_service.list_logs(user_id=user_id, task_id=t_active["id"])
    assert len(logs) == 2
    ext_map = {row["externalId"]: row for row in logs}
    assert ext_map["msg_001"]["status"] == "success"
    assert ext_map["msg_001"]["httpStatus"] == 204
    assert ext_map["msg_002"]["status"] == "failed"
    assert ext_map["msg_002"]["retryCount"] == 2
    assert "rate limited" in ext_map["msg_002"]["message"]

    refreshed = task_service.get_task(t_active["id"], user_id=user_id)
    assert refreshed is not None and refreshed["lastRunAt"] is not None


def test_per_user_bootstrap_api_key_isolation_and_registration_default(app_factory):
    app = app_factory(api_key=None)
    client = app.test_client()

    # Registration is enabled by default
    status = client.get("/api/auth/status").get_json()
    assert status["registrationEnabled"] is True

    sf = app.extensions["session_factory"]
    auth_service = app.extensions["auth_service"]
    now = utc_now()
    with sf() as db:
        u1 = User(
            username="tenant_alpha",
            username_lower="tenant_alpha",
            email="alpha@example.com",
            password_hash=hash_password("Str0ngPass!123"),
            is_email_verified=True,
            verified_at=now,
        )
        u2 = User(
            username="tenant_beta",
            username_lower="tenant_beta",
            email="beta@example.com",
            password_hash=hash_password("Str0ngPass!123"),
            is_email_verified=True,
            verified_at=now,
        )
        db.add_all([u1, u2])
        db.flush()
        _, tok1, _ = auth_service._mint_session_pair(db=db, user=u1, now=now)
        _, tok2, _ = auth_service._mint_session_pair(db=db, user=u2, now=now)
        db.commit()

    headers = {"Origin": "http://localhost:3000", "X-Requested-With": "PulseHook"}

    # Tenant Alpha bootstraps their own initial key
    client.set_cookie(ACCESS_COOKIE_NAME, tok1)
    r1 = client.post("/api/auth/bootstrap", json={"name": "Alpha CI"}, headers=headers)
    assert r1.status_code == 201
    # Calling bootstrap again as Alpha fails with 409
    r1_dup = client.post("/api/auth/bootstrap", json={"name": "Alpha CI 2"}, headers=headers)
    assert r1_dup.status_code == 409

    # Tenant Beta can STILL bootstrap their own initial key independently!
    client.set_cookie(ACCESS_COOKIE_NAME, tok2)
    r2 = client.post("/api/auth/bootstrap", json={"name": "Beta CI"}, headers=headers)
    assert r2.status_code == 201
    assert r2.get_json()["key"]["name"] == "Beta CI"


def test_qstash_sync_logs_ignores_malformed_json_response(app_factory):
    app = app_factory()

    class _BadJsonResp:
        status_code = 200
        content = b"<html>gateway</html>"

        def json(self):
            raise ValueError("not json")

    class _BadHttp:
        def request(self, method, url, **kwargs):
            return _BadJsonResp()

    scheduler = QStashSchedulerService(
        session_factory=app.extensions["session_factory"],
        qstash_url="https://qstash.upstash.io",
        qstash_token="tok_test",
        log_sync_ttl_seconds=0.0,
        http_session=_BadHttp(),  # type: ignore[arg-type]
    )
    assert scheduler.sync_logs(force=True) == 0
