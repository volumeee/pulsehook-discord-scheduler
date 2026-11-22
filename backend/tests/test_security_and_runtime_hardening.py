"""Regression tests for deep-audit security, concurrency, webhook, and runtime hardening."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import requests
from pydantic import ValidationError

from app.config import load_settings
from app.models.task import Task
from app.models.task_log import TaskLog
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.task_schema import CreateTaskSchema, validate_discord_webhook_url
from app.services.discord_client import DiscordDispatchResult, send_discord_webhook
from app.services.email import EmailDeliveryError
from app.services.security import ACCESS_COOKIE_NAME, SlidingWindowRateLimiter
from tests.conftest import VALID_DISCORD_WEBHOOK
from tests.test_account_otp_auth import FakeEmailService


def test_production_requires_auth_token_secret_for_non_sqlite_db():
    with pytest.raises(RuntimeError, match="AUTH_TOKEN_SECRET"):
        load_settings(
            overrides={
                "FLASK_ENV": "production",
                "DATABASE_URL": "postgresql+psycopg://user:pass@localhost:5432/pulsehook",
                "AUTH_TOKEN_SECRET": "",
            }
        )


def test_production_csrf_rejects_missing_origin_and_localhost(app_factory):
    app = app_factory(
        flask_env="production",
        cors_origins="https://pulsehook.bagos.web.id",
        api_key=None,
    )
    auth_service = app.extensions["auth_service"]
    with app.extensions["session_factory"]() as db:
        user = User(
            username="prod_user",
            username_lower="prod_user",
            email="prod@example.com",
            password_hash="unused",
            is_email_verified=True,
        )
        db.add(user)
        db.flush()
        _, access_token, _ = auth_service._mint_session_pair(
            db=db, user=user, now=datetime.now(UTC)
        )
        db.commit()

    client = app.test_client()
    client.set_cookie(ACCESS_COOKIE_NAME, access_token, domain="pulsehook.bagos.web.id")

    # Missing Origin/Referer rejected in production
    res_missing = client.post(
        "/api/keys",
        base_url="https://pulsehook.bagos.web.id",
        headers={"X-Requested-With": "PulseHook"},
        json={"name": "No Origin"},
    )
    assert res_missing.status_code == 403

    # Localhost Origin rejected in production
    res_local = client.post(
        "/api/keys",
        base_url="https://pulsehook.bagos.web.id",
        headers={
            "X-Requested-With": "PulseHook",
            "Origin": "http://localhost:3000",
        },
        json={"name": "Localhost Origin"},
    )
    assert res_local.status_code == 403

    # Exact allowed origin succeeds
    res_ok = client.post(
        "/api/keys",
        base_url="https://pulsehook.bagos.web.id",
        headers={
            "X-Requested-With": "PulseHook",
            "Origin": "https://pulsehook.bagos.web.id",
        },
        json={"name": "Prod Key"},
    )
    assert res_ok.status_code == 201


def test_resend_otp_blocks_consumed_challenge_and_enforces_latest_cooldown(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    reg = client.post(
        "/api/auth/register",
        base_url="https://localhost:3000",
        json={
            "username": "otp_guard",
            "email": "otp_guard@example.com",
            "password": "StrongPassword9",
        },
    ).get_json()
    challenge = reg["challengeToken"]
    code = mailer.sent[-1]["code"]

    # Immediate resend is blocked by 60s cooldown
    too_soon = client.post(
        "/api/auth/resend-otp",
        base_url="https://localhost:3000",
        json={"challengeToken": challenge},
    )
    assert too_soon.status_code == 429

    # Verify consumes the OTP
    verified = client.post(
        "/api/auth/verify-otp",
        base_url="https://localhost:3000",
        headers={"X-Requested-With": "PulseHook", "Origin": "https://localhost:3000"},
        json={"challengeToken": challenge, "code": code},
    )
    assert verified.status_code == 200

    # Reusing consumed challenge for resend must fail (400)
    replay_resend = client.post(
        "/api/auth/resend-otp",
        base_url="https://localhost:3000",
        json={"challengeToken": challenge},
    )
    assert replay_resend.status_code == 400


def test_forgot_password_does_not_enumerate_on_email_delivery_failure(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    reg = client.post(
        "/api/auth/register",
        base_url="https://localhost:3000",
        json={
            "username": "reset_silent",
            "email": "reset_silent@example.com",
            "password": "StrongPassword9",
        },
    ).get_json()
    client.post(
        "/api/auth/verify-otp",
        base_url="https://localhost:3000",
        headers={"X-Requested-With": "PulseHook", "Origin": "https://localhost:3000"},
        json={"challengeToken": reg["challengeToken"], "code": mailer.sent[-1]["code"]},
    )

    mailer.should_fail = EmailDeliveryError("Resend upstream 500", status_code=502)
    res = client.post(
        "/api/auth/forgot-password",
        base_url="https://localhost:3000",
        json={"identifier": "reset_silent@example.com"},
    )
    assert res.status_code == 200
    assert "password reset link" in res.get_json()["message"].lower()


def test_revoke_family_is_scoped_by_user_id(app_factory):
    app = app_factory(api_key=None)
    auth_service = app.extensions["auth_service"]
    now = datetime.now(UTC)
    with app.extensions["session_factory"]() as db:
        u1 = User(
            username="fam_u1",
            username_lower="fam_u1",
            email="u1@example.com",
            password_hash="unused",
            is_email_verified=True,
        )
        u2 = User(
            username="fam_u2",
            username_lower="fam_u2",
            email="u2@example.com",
            password_hash="unused",
            is_email_verified=True,
        )
        db.add_all([u1, u2])
        db.flush()
        s1 = UserSession(
            user_id=u1.id,
            family_id="legacy_family",
            token_hash="a" * 64,
            expires_at=now + timedelta(days=7),
        )
        s2 = UserSession(
            user_id=u2.id,
            family_id="legacy_family",
            token_hash="c" * 64,
            expires_at=now + timedelta(days=7),
        )
        db.add_all([s1, s2])
        db.flush()

        auth_service._revoke_family(db, "legacy_family", now, user_id=u1.id)
        db.commit()

        assert db.get(UserSession, s1.id).revoked_at is not None
        assert db.get(UserSession, s2.id).revoked_at is None


def test_sliding_window_rate_limiter_per_bucket_windows_and_bound():
    limiter = SlidingWindowRateLimiter(max_buckets=16)
    for i in range(40):
        allowed, _ = limiter.check(f"key:{i}", limit=2, window_seconds=3600)
        assert allowed is True
    assert len(limiter._buckets) <= 16


def test_webhook_validation_and_error_redaction():
    for bad in (
        f"{VALID_DISCORD_WEBHOOK}?wait=true",
        f"{VALID_DISCORD_WEBHOOK}#frag",
        f"{VALID_DISCORD_WEBHOOK};param=1",
        "https://@discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz123456",
        f"{VALID_DISCORD_WEBHOOK}\n",
    ):
        ok, _err = validate_discord_webhook_url(bad)
        assert ok is False

    # Empty footer text rejected
    with pytest.raises(ValidationError):
        CreateTaskSchema(
            name="Bad Footer",
            schedule="0 * * * *",
            webhookUrl=VALID_DISCORD_WEBHOOK,
            payload={"embeds": [{"title": "Hi", "footer": {"text": ""}}]},
        )

    # Network exception redacts webhook token
    def fail_post(*_args, **_kwargs):
        raise requests.ConnectionError(f"Failed connecting to {VALID_DISCORD_WEBHOOK}")

    res = send_discord_webhook(VALID_DISCORD_WEBHOOK, {"content": "hi"}, post_fn=fail_post)
    assert res.ok is False
    assert "abcdefghijklmnopqrstuvwxyz123456" not in res.message
    assert "[REDACTED]" in res.message


def test_manual_run_preserves_paused_on_failure_and_caps_retries(app_factory):
    calls = {"count": 0}

    def always_fail(_url, _payload):
        calls["count"] += 1
        return DiscordDispatchResult(
            ok=False, http_status=500, duration_ms=5, message="Discord server error (HTTP 500)"
        )

    app = app_factory(send_webhook_fn=always_fail)
    with app.extensions["session_factory"]() as db:
        task = Task(
            user_id=1,
            name="Paused Manual Task",
            schedule="0 * * * *",
            webhook_url=VALID_DISCORD_WEBHOOK,
            payload={"content": "hi"},
            status="paused",
            max_retry=5,
            retry_delay_ms=100,
        )
        db.add(task)
        db.commit()
        task_id = task.id

    executor = app.extensions["executor"]
    outcome = executor.execute_by_id(
        task_id,
        preserve_paused_status=True,
        user_id=1,
        max_retry_cap=2,
        max_wall_seconds=25.0,
    )
    assert outcome is not None
    assert outcome.succeeded is False
    assert calls["count"] == 3  # 1 initial + 2 capped retries
    with app.extensions["session_factory"]() as db:
        refreshed = db.get(Task, task_id)
        assert refreshed.status == "paused"


def test_scheduled_retry_aborts_if_task_paused_mid_flight(app_factory):
    calls = {"count": 0}

    def fail_and_pause(_url, _payload):
        calls["count"] += 1
        with app.extensions["session_factory"]() as db:
            t = db.get(Task, task_id)
            t.status = "paused"
            db.commit()
        return DiscordDispatchResult(
            ok=False, http_status=500, duration_ms=5, message="Discord error"
        )

    app = app_factory(send_webhook_fn=fail_and_pause)
    with app.extensions["session_factory"]() as db:
        task = Task(
            user_id=1,
            name="Mid-flight Pause",
            schedule="0 * * * *",
            webhook_url=VALID_DISCORD_WEBHOOK,
            payload={"content": "hi"},
            status="active",
            max_retry=3,
            retry_delay_ms=100,
        )
        db.add(task)
        db.commit()
        task_id = task.id

    executor = app.extensions["executor"]
    executor.execute_by_id(task_id, preserve_paused_status=False, user_id=1)
    assert calls["count"] == 1
    with app.extensions["session_factory"]() as db:
        assert db.query(TaskLog).filter_by(task_id=task_id).count() == 1


def test_task_search_escapes_like_wildcards_and_startup_refreshes_next_run(app_factory):
    app = app_factory()
    task_service = app.extensions["task_service"]
    past = datetime.now(UTC) - timedelta(hours=3)
    with app.extensions["session_factory"]() as db:
        db.add_all(
            [
                Task(
                    user_id=1,
                    name="100% Real Discount",
                    schedule="0 * * * *",
                    webhook_url=VALID_DISCORD_WEBHOOK,
                    payload={"content": "a"},
                    status="active",
                    next_run_at=past,
                ),
                Task(
                    user_id=1,
                    name="1000 Other Task",
                    schedule="0 * * * *",
                    webhook_url=VALID_DISCORD_WEBHOOK,
                    payload={"content": "b"},
                    status="active",
                    next_run_at=past,
                ),
            ]
        )
        db.commit()

    found = task_service.list_tasks(user_id=1, search="100%")
    assert [t["name"] for t in found] == ["100% Real Discount"]

    synced = task_service.list_tasks_for_scheduler(refresh_next_run=True)
    now = datetime.now(UTC)
    for item in synced:
        assert item["nextRunAt"] is not None
        assert datetime.fromisoformat(item["nextRunAt"].replace("Z", "+00:00")) > now


def test_logs_endpoint_rejects_malformed_signed_integers_cleanly(app_factory):
    app = app_factory(api_key="test-key")
    client = app.test_client()
    headers = {"X-API-Key": "test-key"}

    res_task = client.get("/api/logs?taskId=--5", headers=headers)
    assert res_task.status_code == 400

    res_page = client.get("/api/logs?page=--1", headers=headers)
    assert res_page.status_code == 400
