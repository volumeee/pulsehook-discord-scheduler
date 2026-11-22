"""6-digit OTP challenge issuance/verification and single-use password reset flows."""

from __future__ import annotations

import hmac
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.extensions import ensure_utc, utc_now
from app.models.otp_code import OtpCode
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.services.auth.crypto import (
    FORGOT_PASSWORD_NEUTRAL_MESSAGE,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_RESEND_GRACE_MINUTES,
    OTP_TTL_MINUTES,
    PASSWORD_RESET_COOLDOWN_SECONDS,
    PASSWORD_RESET_TOKEN_PREFIX,
    PASSWORD_RESET_TTL_MINUTES,
    AuthServiceError,
    hash_secret,
    mask_email,
    summarize_user_agent,
)
from app.services.email import (
    EmailDeliveryError,
    ResendEmailService,
    build_login_otp_email,
    build_password_reset_email,
    build_verification_email,
)

logger = logging.getLogger(__name__)


def issue_otp_challenge(
    *,
    db: Session,
    email_service: ResendEmailService,
    user: User,
    purpose: str,
    user_agent: str | None = None,
) -> dict[str, Any]:
    now = utc_now()
    active_codes = (
        db.execute(
            select(OtpCode).where(
                OtpCode.user_id == user.id,
                OtpCode.purpose == purpose,
                OtpCode.consumed_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for existing in active_codes:
        existing.consumed_at = now

    raw_code = f"{secrets.randbelow(1_000_000):06d}"
    challenge_token = f"ph_otp_{secrets.token_urlsafe(24)}"
    expires_at = now + timedelta(minutes=OTP_TTL_MINUTES)

    db.add(
        OtpCode(
            user_id=user.id,
            purpose=purpose,
            challenge_token=challenge_token,
            code_hash=hash_secret(raw_code),
            attempts=0,
            expires_at=expires_at,
            created_at=now,
        )
    )
    db.flush()

    rendered = (
        build_verification_email(username=user.username, code=raw_code, expires_minutes=OTP_TTL_MINUTES)
        if purpose == "email_verification"
        else build_login_otp_email(
            username=user.username,
            code=raw_code,
            client_summary=summarize_user_agent(user_agent),
            expires_minutes=OTP_TTL_MINUTES,
            requested_at=now,
        )
    )

    try:
        delivery = email_service.send_email(to_email=user.email, rendered=rendered)
    except EmailDeliveryError as exc:
        db.rollback()
        raise AuthServiceError(str(exc), status_code=exc.status_code) from exc

    db.commit()
    return {
        "challengeToken": challenge_token,
        "purpose": purpose,
        "maskedEmail": mask_email(user.email),
        "username": user.username,
        "expiresAt": expires_at.isoformat(),
        "expiresInSeconds": OTP_TTL_MINUTES * 60,
        "resendCooldownSeconds": OTP_RESEND_COOLDOWN_SECONDS,
        "emailDeliveryId": delivery.message_id,
    }


def resend_otp_challenge(
    *,
    db: Session,
    email_service: ResendEmailService,
    challenge_token: str,
    user_agent: str | None = None,
) -> dict[str, Any]:
    now = utc_now()
    otp_record = db.execute(
        select(OtpCode).where(OtpCode.challenge_token == challenge_token).with_for_update()
    ).scalar_one_or_none()

    if otp_record is None:
        raise AuthServiceError("This verification session is no longer valid. Please sign in again.", status_code=404)
    if otp_record.consumed_at is not None:
        raise AuthServiceError("This verification session is no longer valid. Please sign in again.", status_code=400)

    grace_deadline = ensure_utc(otp_record.expires_at) + timedelta(minutes=OTP_RESEND_GRACE_MINUTES)
    if now > grace_deadline:
        otp_record.consumed_at = now
        db.commit()
        raise AuthServiceError("This verification session has expired. Please sign in again.", status_code=400)

    user = db.execute(select(User).where(User.id == otp_record.user_id).with_for_update()).scalar_one_or_none()
    if user is None:
        raise AuthServiceError("Account not found.", status_code=404)

    latest_otp = (
        db.execute(
            select(OtpCode)
            .where(OtpCode.user_id == user.id, OtpCode.purpose == otp_record.purpose)
            .order_by(OtpCode.created_at.desc(), OtpCode.id.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    ref_created = ensure_utc(latest_otp.created_at if latest_otp is not None else otp_record.created_at)
    elapsed = int((now - ref_created).total_seconds())
    if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
        wait_sec = OTP_RESEND_COOLDOWN_SECONDS - elapsed
        raise AuthServiceError(
            f"Please wait {wait_sec}s before requesting another code.",
            status_code=429,
            extra={"retryAfterSeconds": wait_sec},
        )

    challenge = issue_otp_challenge(
        db=db,
        email_service=email_service,
        user=user,
        purpose=otp_record.purpose,
        user_agent=user_agent,
    )
    return {**challenge, "message": f"A fresh 6-digit code is on its way to {challenge['maskedEmail']}."}


def consume_otp_challenge(
    *, db: Session, challenge_token: str, code: str, now: datetime
) -> tuple[User, OtpCode]:
    otp_record = db.execute(
        select(OtpCode).where(OtpCode.challenge_token == challenge_token).with_for_update()
    ).scalar_one_or_none()

    if otp_record is None:
        raise AuthServiceError("Verification session not found. Please start again.", status_code=404)
    if otp_record.consumed_at is not None:
        raise AuthServiceError(
            "This verification code has already been used or replaced. Request a new code.",
            status_code=400,
        )
    if now > ensure_utc(otp_record.expires_at):
        raise AuthServiceError(
            "This verification code has expired. Click Resend code to receive a fresh one.",
            status_code=400,
        )
    if otp_record.attempts >= OTP_MAX_ATTEMPTS:
        raise AuthServiceError(
            "Too many failed attempts on this code. Request a new code to continue.",
            status_code=429,
        )

    if not hmac.compare_digest(hash_secret(code), otp_record.code_hash):
        otp_record.attempts += 1
        remaining = max(0, OTP_MAX_ATTEMPTS - otp_record.attempts)
        db.commit()
        if remaining == 0:
            raise AuthServiceError(
                "Too many failed attempts on this code. Request a new code to continue.",
                status_code=429,
                extra={"attemptsRemaining": 0},
            )
        label = "attempt" if remaining == 1 else "attempts"
        raise AuthServiceError(
            f"That code didn't match. {remaining} {label} remaining.",
            status_code=400,
            extra={"attemptsRemaining": remaining},
        )

    user = db.execute(select(User).where(User.id == otp_record.user_id).with_for_update()).scalar_one_or_none()
    if user is None:
        raise AuthServiceError("Account not found.", status_code=404)

    otp_record.consumed_at = now
    if otp_record.purpose == "email_verification" and not user.is_email_verified:
        user.is_email_verified = True
        user.verified_at = now
    return user, otp_record


def request_password_reset_link(
    *,
    db: Session,
    email_service: ResendEmailService,
    identifier: str,
    app_base_url: str,
    user_agent: str | None = None,
    requested_ip: str | None = None,
) -> dict[str, Any]:
    normalized = identifier.strip().lower()
    now = utc_now()
    neutral = {"sent": True, "message": FORGOT_PASSWORD_NEUTRAL_MESSAGE}

    user = (
        db.execute(
            select(User)
            .where(or_(User.username_lower == normalized, User.email == normalized))
            .with_for_update()
        )
        .scalars()
        .first()
    )
    if user is None:
        return neutral

    latest_reset = (
        db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .order_by(PasswordResetToken.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if latest_reset is not None and (now - ensure_utc(latest_reset.created_at)).total_seconds() < PASSWORD_RESET_COOLDOWN_SECONDS:
        return neutral

    active_resets = (
        db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.consumed_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for existing in active_resets:
        existing.consumed_at = now

    raw_token = f"{PASSWORD_RESET_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
    expires_at = now + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_secret(raw_token),
            requested_ip=(requested_ip or "")[:64] or None,
            user_agent=(user_agent or "")[:255] or None,
            expires_at=expires_at,
            created_at=now,
        )
    )
    db.flush()

    rendered = build_password_reset_email(
        username=user.username,
        reset_url=f"{app_base_url.rstrip('/')}/reset-password?token={raw_token}",
        client_summary=summarize_user_agent(user_agent),
        expires_minutes=PASSWORD_RESET_TTL_MINUTES,
        requested_at=now,
    )
    try:
        email_service.send_email(to_email=user.email, rendered=rendered)
    except EmailDeliveryError as exc:
        db.rollback()
        logger.warning("Password reset email delivery failed for user #%s: %s", user.id, exc)
        return neutral

    db.commit()
    return neutral


def load_valid_reset_token(
    db: Session, raw_token: str, now: datetime, *, for_update: bool = False
) -> PasswordResetToken:
    if not raw_token or not raw_token.startswith(PASSWORD_RESET_TOKEN_PREFIX):
        raise AuthServiceError(
            "This password reset link is invalid. Request a new link to continue.",
            status_code=400,
        )

    stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_secret(raw_token))
    if for_update:
        stmt = stmt.with_for_update()
    record = db.execute(stmt).scalar_one_or_none()

    if record is None:
        raise AuthServiceError(
            "This password reset link is invalid. Request a new link to continue.",
            status_code=400,
        )
    if record.consumed_at is not None:
        raise AuthServiceError(
            "This password reset link has already been used. Request a fresh link if you still need to reset your password.",
            status_code=400,
        )
    if now > ensure_utc(record.expires_at):
        record.consumed_at = now
        db.commit()
        raise AuthServiceError(
            "This password reset link has expired. Request a new link to continue.",
            status_code=400,
        )
    return record
