"""End-to-end pytest coverage for HttpOnly cookie auth, refresh rotation, reuse detection, CSRF defense, OTP, and forgot/reset password."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from sqlalchemy import select

from app.models.otp_code import OtpCode
from app.models.password_reset_token import PasswordResetToken
from app.services.email import (
    EmailDeliveryError,
    EmailDeliveryResult,
    RenderedEmail,
    ResendEmailService,
    build_login_otp_email,
    build_password_reset_email,
    build_verification_email,
)

HTTPS_BASE = "https://localhost:3000"
CSRF_HEADERS = {
    "X-Requested-With": "PulseHook",
    "Origin": "https://localhost:3000",
}


class FakeEmailService:
    """In-memory email capture stub matching ResendEmailService interface."""

    def __init__(self, should_fail: EmailDeliveryError | None = None) -> None:
        self.sent: list[dict[str, Any]] = []
        self.should_fail = should_fail
        self.is_configured = True

    def send_email(self, *, to_email: str, rendered: RenderedEmail) -> EmailDeliveryResult:
        if self.should_fail is not None:
            raise self.should_fail
        code_match = re.search(r"\b(\d{6})\b", rendered.text_body)
        code = code_match.group(1) if code_match else None
        reset_match = re.search(
            r"(https?://[^\s]+/reset-password\?token=ph_rst_[^\s]+)", rendered.text_body
        )
        reset_url = reset_match.group(1) if reset_match else None
        reset_token = (
            reset_url.split("token=", 1)[1] if reset_url and "token=" in reset_url else None
        )
        self.sent.append(
            {
                "to": to_email,
                "subject": rendered.subject,
                "html": rendered.html_body,
                "text": rendered.text_body,
                "attachments": rendered.attachments,
                "code": code,
                "reset_url": reset_url,
                "reset_token": reset_token,
            }
        )
        return EmailDeliveryResult(
            delivered=True,
            message_id=f"re_test_{len(self.sent)}",
            recipient=to_email,
            subject=rendered.subject,
        )


def _extract_set_cookie_map(response) -> dict[str, str]:
    headers = response.headers.getlist("Set-Cookie")
    out: dict[str, str] = {}
    for raw in headers:
        name = raw.split("=", 1)[0].strip()
        out[name] = raw
    return out


def test_email_templates_render_bento_english_html_and_escape_html():
    verify_mail = build_verification_email(
        username="alice_<script>alert(1)</script>",
        code="482915",
        expires_minutes=5,
    )
    assert ">482915<" in verify_mail.html_body
    assert "4 8 2 9 1 5" not in verify_mail.html_body
    assert "white-space:nowrap" in verify_mail.html_body
    assert "@media only screen and (max-width: 600px)" in verify_mail.html_body
    assert "application/ld+json" in verify_mail.html_body
    assert 'src="cid:pulsehook-logo"' in verify_mail.html_body
    assert len(verify_mail.attachments) == 1
    assert verify_mail.attachments[0]["content_id"] == "pulsehook-logo"
    assert verify_mail.attachments[0]["content_type"] == "image/png"
    assert verify_mail.attachments[0]["content"].startswith("iVBORw0KGgo")
    assert verify_mail.subject.startswith("482915 ")
    assert "482915" in verify_mail.text_body
    assert "<script>" not in verify_mail.html_body
    assert "&lt;script&gt;" in verify_mail.html_body
    assert "#5865F2" in verify_mail.html_body
    assert "#F6F7FB" in verify_mail.html_body

    login_mail = build_login_otp_email(
        username="bagus",
        code="903412",
        client_summary="Chrome on macOS",
        expires_minutes=5,
    )
    assert ">903412<" in login_mail.html_body
    assert "9 0 3 4 1 2" not in login_mail.html_body
    assert 'src="cid:pulsehook-logo"' in login_mail.html_body
    assert len(login_mail.attachments) == 1
    assert login_mail.subject.startswith("903412 ")
    assert "903412" in login_mail.text_body
    assert "Chrome on macOS" in login_mail.html_body
    assert "PulseHook" in login_mail.subject

    reset_mail = build_password_reset_email(
        username="bagose_<img onerror=alert(1)>",
        reset_url="https://pulsehook.example.com/reset-password?token=ph_rst_abc123",
        client_summary="Chrome on Android",
        expires_minutes=15,
    )
    assert "Reset your PulseHook password" == reset_mail.subject
    assert 'src="cid:pulsehook-logo"' in reset_mail.html_body
    assert "Reset Password" in reset_mail.html_body
    assert (
        "https://pulsehook.example.com/reset-password?token=ph_rst_abc123" in reset_mail.html_body
    )
    assert (
        "https://pulsehook.example.com/reset-password?token=ph_rst_abc123" in reset_mail.text_body
    )
    assert "<img onerror=" not in reset_mail.html_body
    assert len(reset_mail.attachments) == 1
    assert reset_mail.attachments[0]["content_id"] == "pulsehook-logo"


def test_resend_service_maps_sandbox_403_clearly(monkeypatch):
    captured_payloads: list[dict[str, Any]] = []

    class DummyResponse:
        status_code = 403
        content = b'{"message":"You can only send testing emails to your own email address (owner@example.com)."}'

        def json(self):
            return {
                "message": "You can only send testing emails to your own email address (owner@example.com)."
            }

    def fake_post(*args, **kwargs):
        captured_payloads.append(kwargs.get("json", {}))
        return DummyResponse()

    monkeypatch.setattr(requests, "post", fake_post)
    svc = ResendEmailService(
        api_key="re_fake_key",
        sender="PulseHook <noreply@pulsehook.bagos.web.id>",
    )
    rendered = build_verification_email(username="bagus", code="123456")

    try:
        svc.send_email(to_email="other@example.com", rendered=rendered)
        assert False, "Expected EmailDeliveryError"
    except EmailDeliveryError as exc:
        assert exc.status_code == 400
        assert "onboarding@resend.dev" in str(exc) or "verified" in str(exc).lower()
        assert len(captured_payloads) == 1
        assert captured_payloads[0]["from"] == "PulseHook <noreply@pulsehook.bagos.web.id>"
        assert captured_payloads[0]["attachments"][0]["content_id"] == "pulsehook-logo"


def test_cookie_only_auth_csrf_refresh_rotation_and_reuse_detection(app_factory, test_api_key):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    # Auth status advertises cookie-only transport
    status_res = client.get("/api/auth/status", base_url=HTTPS_BASE)
    assert status_res.status_code == 200
    status_data = status_res.get_json()
    assert status_data["authMode"] == "account_otp"
    assert status_data["sessionTransport"] == "http_only_cookies"
    assert status_res.headers.get("X-Content-Type-Options") == "nosniff"
    assert status_res.headers.get("Referrer-Policy") == "no-referrer"
    assert "no-store" in (status_res.headers.get("Cache-Control") or "")

    # 1. Register & verify OTP -> sets HttpOnly ph_access + ph_refresh cookies, ZERO tokens in JSON body
    reg_res = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "bagus_dev",
            "email": "Bagus251001@Gmail.com",
            "password": "StrongPassword9",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.get_json()
    verify_code = mailer.sent[0]["code"]

    verify_res = client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
        json={"challengeToken": reg_data["challengeToken"], "code": verify_code},
    )
    assert verify_res.status_code == 200
    verify_json = verify_res.get_json()
    assert verify_json["authenticated"] is True
    assert "token" not in verify_json
    assert "accessToken" not in verify_json
    assert "refreshToken" not in verify_json
    assert verify_json["principal"]["username"] == "bagus_dev"

    cookies = _extract_set_cookie_map(verify_res)
    assert "ph_access" in cookies and "ph_refresh" in cookies
    assert "HttpOnly" in cookies["ph_access"]
    assert "Secure" in cookies["ph_access"]
    assert "SameSite=Lax" in cookies["ph_access"]
    assert "Partitioned" not in cookies["ph_access"]
    assert "Path=/api" in cookies["ph_access"]
    assert "HttpOnly" in cookies["ph_refresh"]
    assert "Path=/api/auth" in cookies["ph_refresh"]

    first_refresh_value = cookies["ph_refresh"].split("=", 1)[1].split(";", 1)[0]

    # 2. Protected GET works purely via HttpOnly ph_access cookie
    me_res = client.get("/api/auth/me", base_url=HTTPS_BASE)
    assert me_res.status_code == 200
    assert me_res.get_json()["principal"]["username"] == "bagus_dev"

    # 3. CSRF defense: Cookie-authenticated POST without X-Requested-With is blocked with 403
    csrf_missing = client.post(
        "/api/keys",
        base_url=HTTPS_BASE,
        json={"name": "Evil CSRF Attempt"},
    )
    assert csrf_missing.status_code == 403

    # Evil cross-site Origin rejected with 403 even with header
    csrf_evil_origin = client.post(
        "/api/keys",
        base_url=HTTPS_BASE,
        headers={
            "X-Requested-With": "PulseHook",
            "Origin": "https://evil-attacker.example",
        },
        json={"name": "Evil Cross-Origin"},
    )
    assert csrf_evil_origin.status_code == 403

    # Valid CSRF header succeeds via HttpOnly cookie
    key_ok = client.post(
        "/api/keys",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
        json={"name": "Postman Automation"},
    )
    assert key_ok.status_code == 201

    # Dual auth: Postman X-API-Key still works without cookies or CSRF header
    raw_client = app.test_client()
    api_key_tasks = raw_client.get("/api/tasks", headers={"X-API-Key": test_api_key})
    assert api_key_tasks.status_code == 200

    # 4. Refresh token rotation mints new access + refresh cookies
    refresh_res = client.post(
        "/api/auth/refresh",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
    )
    assert refresh_res.status_code == 200
    assert refresh_res.get_json()["refreshed"] is True
    rotated_cookies = _extract_set_cookie_map(refresh_res)
    second_refresh_value = rotated_cookies["ph_refresh"].split("=", 1)[1].split(";", 1)[0]
    assert second_refresh_value != first_refresh_value

    # New rotated session works cleanly
    assert client.get("/api/auth/me", base_url=HTTPS_BASE).status_code == 200

    # 5. Reuse / theft detection: attacker replays already-rotated first_refresh_value!
    attacker_client = app.test_client()
    attacker_client.set_cookie(
        "ph_refresh", first_refresh_value, domain="localhost", path="/api/auth"
    )
    reuse_res = attacker_client.post(
        "/api/auth/refresh",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
    )
    assert reuse_res.status_code == 401
    assert reuse_res.get_json().get("reuseDetected") is True

    # Victim's ENTIRE session family is immediately revoked!
    after_reuse = client.get("/api/auth/me", base_url=HTTPS_BASE)
    assert after_reuse.status_code == 401


def test_forgot_password_and_reset_flow_revokes_all_sessions_and_blocks_host_injection(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    # Register & sign in user so an active cookie session exists
    reg = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "bagose",
            "email": "iotbagos@gmail.com",
            "password": "OldPassword1",
        },
    ).get_json()
    otp = mailer.sent[-1]["code"]
    verify_res = client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
        json={"challengeToken": reg["challengeToken"], "code": otp},
    )
    assert verify_res.status_code == 200
    assert client.get("/api/auth/me", base_url=HTTPS_BASE).status_code == 200

    # 1. Anti-enumeration: unknown account returns identical neutral 200
    unknown_res = client.post(
        "/api/auth/forgot-password",
        base_url=HTTPS_BASE,
        json={"identifier": "nobody_exists@example.com"},
    )
    assert unknown_res.status_code == 200
    unknown_msg = unknown_res.get_json()["message"]

    # 2. Host Header Injection attempt is blocked — reset link uses safe fallback/allowed host
    known_res = client.post(
        "/api/auth/forgot-password",
        base_url=HTTPS_BASE,
        headers={
            "Origin": "https://evil-phishing.example",
            "X-Forwarded-Host": "evil-phishing.example",
        },
        json={"identifier": "iotbagos@gmail.com"},
    )
    assert known_res.status_code == 200
    assert known_res.get_json()["message"] == unknown_msg

    reset_email = mailer.sent[-1]
    assert reset_email["to"] == "iotbagos@gmail.com"
    assert reset_email["reset_url"] is not None
    assert "evil-phishing.example" not in reset_email["reset_url"]
    assert reset_email["reset_url"].startswith("http://localhost:3000/reset-password?token=ph_rst_")
    assert 'src="cid:pulsehook-logo"' in reset_email["html"]
    reset_token = reset_email["reset_token"]

    # 3. Validate token via POST body
    val_res = client.post(
        "/api/auth/reset-password/validate",
        base_url=HTTPS_BASE,
        json={"token": reset_token},
    )
    assert val_res.status_code == 200
    assert val_res.get_json()["valid"] is True
    assert val_res.get_json()["username"] == "bagose"

    # 4. Complete password reset -> updates password, burns token, revokes ALL active sessions
    reset_res = client.post(
        "/api/auth/reset-password",
        base_url=HTTPS_BASE,
        json={"token": reset_token, "newPassword": "NewSecurePassword9"},
    )
    assert reset_res.status_code == 200
    assert reset_res.get_json()["reset"] is True
    assert reset_res.get_json()["revokedSessions"] >= 1

    # Reusing the same reset token fails
    reuse_reset = client.post(
        "/api/auth/reset-password",
        base_url=HTTPS_BASE,
        json={"token": reset_token, "newPassword": "AnotherPassword9"},
    )
    assert reuse_reset.status_code == 400

    # Previous cookie session is revoked!
    assert client.get("/api/auth/me", base_url=HTTPS_BASE).status_code == 401

    # Old password rejected, new password accepted
    old_login = client.post(
        "/api/auth/login",
        base_url=HTTPS_BASE,
        json={"identifier": "bagose", "password": "OldPassword1"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        base_url=HTTPS_BASE,
        json={"identifier": "bagose", "password": "NewSecurePassword9"},
    )
    assert new_login.status_code == 200
    assert new_login.get_json()["purpose"] == "login_otp"

    # 5. Expired reset token rejected cleanly
    session_factory = app.extensions["session_factory"]
    with session_factory() as db:
        row = db.execute(select(PasswordResetToken)).scalar_one()
        row.created_at = datetime.now(UTC) - timedelta(seconds=90)
        db.commit()

    client.post(
        "/api/auth/forgot-password",
        base_url=HTTPS_BASE,
        json={"identifier": "bagose"},
    )
    second_token = mailer.sent[-1]["reset_token"]
    with session_factory() as db:
        latest = (
            db.execute(select(PasswordResetToken).order_by(PasswordResetToken.id.desc()))
            .scalars()
            .first()
        )
        latest.expires_at = datetime.now(UTC) - timedelta(seconds=5)
        db.commit()

    expired_res = client.post(
        "/api/auth/reset-password/validate",
        base_url=HTTPS_BASE,
        json={"token": second_token},
    )
    assert expired_res.status_code == 400
    assert "expired" in expired_res.get_json()["error"].lower()


def test_logout_revokes_session_and_clears_cookies(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    reg = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "logout_user",
            "email": "logout@example.com",
            "password": "StrongPassword9",
        },
    ).get_json()
    code = mailer.sent[-1]["code"]
    client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
        json={"challengeToken": reg["challengeToken"], "code": code},
    )
    assert client.get("/api/auth/me", base_url=HTTPS_BASE).status_code == 200

    logout_res = client.post(
        "/api/auth/logout",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
    )
    assert logout_res.status_code == 200
    assert logout_res.get_json()["revoked"] is True
    cleared = _extract_set_cookie_map(logout_res)
    assert "Max-Age=0" in cleared["ph_access"]
    assert "Max-Age=0" in cleared["ph_refresh"]

    assert client.get("/api/auth/me", base_url=HTTPS_BASE).status_code == 401
    assert (
        client.post(
            "/api/auth/refresh",
            base_url=HTTPS_BASE,
            headers=CSRF_HEADERS,
        ).status_code
        == 401
    )


def test_otp_wrong_attempts_lockout_expiry_and_resend_cooldown(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer)
    client = app.test_client()

    reg = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "security_ops",
            "email": "ops@example.com",
            "password": "Password123",
        },
    ).get_json()
    token = reg["challengeToken"]

    early_resend = client.post(
        "/api/auth/resend-otp",
        base_url=HTTPS_BASE,
        json={"challengeToken": token},
    )
    assert early_resend.status_code == 429
    assert early_resend.get_json()["retryAfterSeconds"] > 0

    for attempt in range(4):
        wrong = client.post(
            "/api/auth/verify-otp",
            base_url=HTTPS_BASE,
            json={"challengeToken": token, "code": "000000"},
        )
        assert wrong.status_code == 400
        assert wrong.get_json()["attemptsRemaining"] == 4 - attempt

    fifth = client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        json={"challengeToken": token, "code": "000000"},
    )
    assert fifth.status_code == 429

    session_factory = app.extensions["session_factory"]
    with session_factory() as db:
        row = db.execute(select(OtpCode).where(OtpCode.challenge_token == token)).scalar_one()
        row.created_at = datetime.now(UTC) - timedelta(seconds=65)
        db.commit()

    resend_ok = client.post(
        "/api/auth/resend-otp",
        base_url=HTTPS_BASE,
        json={"challengeToken": token},
    )
    assert resend_ok.status_code == 200
    new_token = resend_ok.get_json()["challengeToken"]
    new_code = mailer.sent[-1]["code"]

    with session_factory() as db:
        row = db.execute(select(OtpCode).where(OtpCode.challenge_token == new_token)).scalar_one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=5)
        db.commit()

    expired = client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        json={"challengeToken": new_token, "code": new_code},
    )
    assert expired.status_code == 400
    assert "expired" in expired.get_json()["error"].lower()


def test_configured_tunnel_domain_pins_reset_links_cors_and_blocks_run_app(app_factory):
    mailer = FakeEmailService()
    tunnel_url = "https://pulsehook.bagos.web.id"
    app = app_factory(
        email_service=mailer,
        app_base_url=tunnel_url,
        cors_origins="https://other.example",
    )
    assert tunnel_url in app.config["ALLOWED_ORIGINS"]
    client = app.test_client()

    # Requests without Origin header do not emit a misleading Access-Control-Allow-Origin
    no_origin_status = client.get("/api/auth/status", base_url=HTTPS_BASE)
    assert no_origin_status.status_code == 200
    assert "Access-Control-Allow-Origin" not in no_origin_status.headers

    # Register + verify user
    reg = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "tunnel_user",
            "email": "tunnel@example.com",
            "password": "StrongPassword9",
        },
    ).get_json()
    code = mailer.sent[-1]["code"]
    verify_res = client.post(
        "/api/auth/verify-otp",
        base_url=HTTPS_BASE,
        headers=CSRF_HEADERS,
        json={"challengeToken": reg["challengeToken"], "code": code},
    )
    assert verify_res.status_code == 200

    # Attacker *.run.app origin + matching X-Forwarded-Host must be rejected by CSRF defense
    run_app_csrf = client.post(
        "/api/keys",
        base_url=HTTPS_BASE,
        headers={
            "X-Requested-With": "PulseHook",
            "Origin": "https://attacker.run.app",
            "X-Forwarded-Host": "attacker.run.app",
        },
        json={"name": "Poison Key"},
    )
    assert run_app_csrf.status_code == 403

    # Configured tunnel Origin is accepted by CSRF defense
    tunnel_csrf = client.post(
        "/api/keys",
        base_url=HTTPS_BASE,
        headers={
            "X-Requested-With": "PulseHook",
            "Origin": tunnel_url,
        },
        json={"name": "Tunnel Key"},
    )
    assert tunnel_csrf.status_code == 201

    # Forgot-password always uses configured APP_BASE_URL even when spoofed Origin/X-Forwarded-Host is sent
    forgot_res = client.post(
        "/api/auth/forgot-password",
        base_url=HTTPS_BASE,
        headers={
            "Origin": "http://localhost:3000",
            "X-Forwarded-Host": "attacker.run.app",
            "CF-Connecting-IP": "198.51.100.42",
            "X-Forwarded-For": "203.0.113.9",
        },
        json={"identifier": "tunnel@example.com"},
    )
    assert forgot_res.status_code == 200
    reset_url = mailer.sent[-1]["reset_url"]
    assert reset_url is not None
    assert reset_url.startswith(f"{tunnel_url}/reset-password?token=ph_rst_")
    assert "localhost" not in reset_url
    assert "run.app" not in reset_url


def test_registration_disabled_blocks_signup_and_reports_status(app_factory):
    mailer = FakeEmailService()
    app = app_factory(email_service=mailer, allow_registration=False)
    client = app.test_client()

    status_res = client.get("/api/auth/status", base_url=HTTPS_BASE)
    assert status_res.status_code == 200
    assert status_res.get_json()["registrationEnabled"] is False

    reg_res = client.post(
        "/api/auth/register",
        base_url=HTTPS_BASE,
        json={
            "username": "intruder",
            "email": "intruder@example.com",
            "password": "StrongPassword9",
        },
    )
    assert reg_res.status_code == 403
    assert "disabled" in reg_res.get_json()["error"].lower()
    assert len(mailer.sent) == 0
