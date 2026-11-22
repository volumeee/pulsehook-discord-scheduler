"""Account registration, login, rotating HttpOnly sessions, OTP, and password recovery service."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.extensions import ensure_utc, utc_now
from app.models.otp_code import OtpCode
from app.models.user import User
from app.models.user_session import UserSession
from app.services.auth.crypto import (
    DUMMY_PASSWORD_HASH,
    REFRESH_TOKEN_PREFIX,
    AuthServiceError,
    hash_password,
    hash_secret,
    mask_email,
    verify_password,
)
from app.services.auth.otp_recovery import (
    consume_otp_challenge,
    issue_otp_challenge,
    load_valid_reset_token,
    request_password_reset_link,
    resend_otp_challenge,
)
from app.services.email import ResendEmailService
from app.services.security import (
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
    sign_access_token,
    verify_access_token,
)

_INVALID_CREDS_MSG = "Invalid username/email or password. Double-check your credentials and try again."
_CONFLICT_MSG = "An account with that username or email already exists. Try signing in instead."


class AuthService:
    """Coordinates account auth, OTP challenges, password resets, and revocable sessions."""

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        email_service: ResendEmailService,
        token_secret: str | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.email_service = email_service
        self.token_secret = token_secret or secrets.token_hex(32)

    @staticmethod
    def _build_principal(user: User, session_id: int) -> dict[str, Any]:
        return {
            "method": "user_session",
            "sessionId": session_id,
            "userId": user.id,
            "username": user.username,
            "email": user.email,
            "isEmailVerified": user.is_email_verified,
            "displayName": f"@{user.username}",
        }

    def _mint_session_pair(
        self,
        *,
        db: Session,
        user: User,
        now: datetime,
        user_agent: str | None = None,
        family_id: str | None = None,
    ) -> tuple[UserSession, str, str]:
        resolved_family = family_id or secrets.token_hex(16)
        raw_refresh = f"{REFRESH_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
        session_record = UserSession(
            user_id=user.id,
            family_id=resolved_family,
            token_hash=hash_secret(raw_refresh),
            user_agent=(user_agent or "")[:255] or None,
            expires_at=now + timedelta(seconds=REFRESH_TOKEN_TTL_SECONDS),
            last_used_at=now,
            created_at=now,
        )
        db.add(session_record)
        db.flush()

        access_token = sign_access_token(
            secret=self.token_secret,
            user_id=user.id,
            session_id=session_record.id,
            family_id=resolved_family,
            username=user.username,
            ttl_seconds=ACCESS_TOKEN_TTL_SECONDS,
            now_ts=int(now.timestamp()),
        )
        return session_record, access_token, raw_refresh

    @staticmethod
    def _revoke_family(
        db: Session, family_id: str, now: datetime, *, user_id: int | None = None
    ) -> int:
        stmt = select(UserSession).where(
            UserSession.family_id == family_id,
            UserSession.revoked_at.is_(None),
        )
        if user_id is not None:
            stmt = stmt.where(UserSession.user_id == user_id)
        rows = db.execute(stmt).scalars().all()
        for row in rows:
            row.revoked_at = now
        return len(rows)

    @staticmethod
    def _revoke_all_user_sessions(db: Session, user_id: int, now: datetime) -> int:
        rows = (
            db.execute(
                select(UserSession).where(
                    UserSession.user_id == user_id,
                    UserSession.revoked_at.is_(None),
                )
            )
            .scalars()
            .all()
        )
        for row in rows:
            row.revoked_at = now
        return len(rows)

    def register_account(
        self, *, username: str, email: str, password: str, user_agent: str | None = None
    ) -> dict[str, Any]:
        username_lower = username.lower()
        email_lower = email.lower()
        with self.session_factory() as db:
            existing = (
                db.execute(
                    select(User).where(
                        or_(User.username_lower == username_lower, User.email == email_lower)
                    )
                )
                .scalars()
                .first()
            )
            if existing is not None:
                raise AuthServiceError(_CONFLICT_MSG, status_code=409)

            user = User(
                username=username,
                username_lower=username_lower,
                email=email_lower,
                password_hash=hash_password(password),
                is_email_verified=False,
            )
            db.add(user)
            try:
                db.flush()
                challenge = issue_otp_challenge(
                    db=db,
                    email_service=self.email_service,
                    user=user,
                    purpose="email_verification",
                    user_agent=user_agent,
                )
            except IntegrityError as exc:
                db.rollback()
                raise AuthServiceError(_CONFLICT_MSG, status_code=409) from exc

            return {
                **challenge,
                "message": f"Account created! Enter the 6-digit verification code sent to {challenge['maskedEmail']}.",
            }

    def start_login(
        self, *, identifier: str, password: str, user_agent: str | None = None
    ) -> dict[str, Any]:
        normalized = identifier.strip().lower()
        with self.session_factory() as db:
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
                verify_password(password, DUMMY_PASSWORD_HASH)
                raise AuthServiceError(_INVALID_CREDS_MSG, status_code=401)
            if not verify_password(password, user.password_hash):
                raise AuthServiceError(_INVALID_CREDS_MSG, status_code=401)

            purpose = "login_otp" if user.is_email_verified else "email_verification"
            challenge = issue_otp_challenge(
                db=db,
                email_service=self.email_service,
                user=user,
                purpose=purpose,
                user_agent=user_agent,
            )
            msg = (
                f"We sent a 6-digit sign-in code to {challenge['maskedEmail']}."
                if user.is_email_verified
                else f"Your email isn't verified yet—we sent a fresh 6-digit verification code to {challenge['maskedEmail']}."
            )
            return {**challenge, "message": msg}

    def resend_otp(self, *, challenge_token: str, user_agent: str | None = None) -> dict[str, Any]:
        with self.session_factory() as db:
            return resend_otp_challenge(
                db=db,
                email_service=self.email_service,
                challenge_token=challenge_token,
                user_agent=user_agent,
            )

    def verify_otp(
        self, *, challenge_token: str, code: str, user_agent: str | None = None
    ) -> dict[str, Any]:
        now = utc_now()
        with self.session_factory() as db:
            user, _otp = consume_otp_challenge(
                db=db, challenge_token=challenge_token, code=code, now=now
            )
            session_record, access_token, refresh_token = self._mint_session_pair(
                db=db, user=user, now=now, user_agent=user_agent
            )
            db.commit()
            db.refresh(user)
            return {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresAt": session_record.expires_at.isoformat(),
                "principal": self._build_principal(user, session_record.id),
            }

    def verify_access_token_cookie(self, raw_access_token: str) -> dict[str, Any] | None:
        claims = verify_access_token(raw_access_token, secret=self.token_secret)
        if claims is None:
            return None

        session_id = int(claims["sid"])
        user_id = int(claims["sub"])
        family_id = str(claims.get("fid") or "")
        now = utc_now()

        with self.session_factory() as db:
            session_record = db.get(UserSession, session_id)
            if (
                session_record is None
                or session_record.user_id != user_id
                or (family_id and session_record.family_id != family_id)
                or session_record.revoked_at is not None
                or now > ensure_utc(session_record.expires_at)
            ):
                return None

            user = db.get(User, user_id)
            if user is None or not user.is_email_verified:
                return None

            last_used = ensure_utc(session_record.last_used_at) if session_record.last_used_at else None
            if last_used is None or (now - last_used).total_seconds() >= 60:
                session_record.last_used_at = now
                db.commit()

            return self._build_principal(user, session_record.id)

    def rotate_refresh_token(
        self, raw_refresh_token: str, *, user_agent: str | None = None
    ) -> dict[str, Any]:
        if not raw_refresh_token or not raw_refresh_token.startswith(REFRESH_TOKEN_PREFIX):
            raise AuthServiceError("Your session has expired. Please sign in again.", status_code=401)

        now = utc_now()
        with self.session_factory() as db:
            session_record = db.execute(
                select(UserSession)
                .where(UserSession.token_hash == hash_secret(raw_refresh_token))
                .with_for_update()
            ).scalar_one_or_none()

            if session_record is None:
                raise AuthServiceError("Your session has expired. Please sign in again.", status_code=401)

            if session_record.replaced_by_id is not None:
                self._revoke_family(db, session_record.family_id, now, user_id=session_record.user_id)
                db.commit()
                raise AuthServiceError(
                    "Security alert: Session reuse detected. All sessions from this sign-in were revoked. Please sign in again.",
                    status_code=401,
                    extra={"reuseDetected": True},
                )
            if session_record.revoked_at is not None:
                raise AuthServiceError("Your session was signed out or revoked. Please sign in again.", status_code=401)
            if now > ensure_utc(session_record.expires_at):
                session_record.revoked_at = now
                db.commit()
                raise AuthServiceError("Your session expired. Please sign in again.", status_code=401)

            user = db.get(User, session_record.user_id)
            if user is None or not user.is_email_verified:
                self._revoke_family(db, session_record.family_id, now, user_id=session_record.user_id)
                db.commit()
                raise AuthServiceError("Account is unavailable. Please sign in again.", status_code=401)

            new_session, new_access, new_refresh = self._mint_session_pair(
                db=db,
                user=user,
                now=now,
                user_agent=user_agent or session_record.user_agent,
                family_id=session_record.family_id,
            )
            session_record.revoked_at = now
            session_record.replaced_by_id = new_session.id
            db.commit()
            db.refresh(user)
            return {
                "accessToken": new_access,
                "refreshToken": new_refresh,
                "expiresAt": new_session.expires_at.isoformat(),
                "principal": self._build_principal(user, new_session.id),
            }

    def revoke_session_from_cookies(
        self, *, access_token: str | None = None, refresh_token: str | None = None
    ) -> bool:
        now = utc_now()
        family_id: str | None = None
        user_id: int | None = None

        with self.session_factory() as db:
            if refresh_token and refresh_token.startswith(REFRESH_TOKEN_PREFIX):
                rec = db.execute(
                    select(UserSession).where(UserSession.token_hash == hash_secret(refresh_token))
                ).scalar_one_or_none()
                if rec is not None:
                    family_id, user_id = rec.family_id, rec.user_id

            if not family_id and access_token:
                claims = verify_access_token(access_token, secret=self.token_secret)
                if claims and claims.get("fid"):
                    family_id = str(claims["fid"])
                    user_id = int(claims["sub"]) if isinstance(claims.get("sub"), int) else None
                elif claims and isinstance(claims.get("sid"), int):
                    rec = db.get(UserSession, int(claims["sid"]))
                    if rec is not None:
                        family_id, user_id = rec.family_id, rec.user_id

            if not family_id:
                return False

            revoked = self._revoke_family(db, family_id, now, user_id=user_id)
            db.commit()
            return revoked > 0

    def request_password_reset(
        self,
        *,
        identifier: str,
        app_base_url: str,
        user_agent: str | None = None,
        requested_ip: str | None = None,
    ) -> dict[str, Any]:
        with self.session_factory() as db:
            return request_password_reset_link(
                db=db,
                email_service=self.email_service,
                identifier=identifier,
                app_base_url=app_base_url,
                user_agent=user_agent,
                requested_ip=requested_ip,
            )

    def validate_password_reset_token(self, raw_token: str) -> dict[str, Any]:
        with self.session_factory() as db:
            record = load_valid_reset_token(db, raw_token, utc_now())
            user = db.get(User, record.user_id)
            if user is None:
                raise AuthServiceError("Account not found for this reset link.", status_code=404)
            return {
                "valid": True,
                "username": user.username,
                "maskedEmail": mask_email(user.email),
                "expiresAt": record.expires_at.isoformat(),
            }

    def reset_password_with_token(self, *, raw_token: str, new_password: str) -> dict[str, Any]:
        now = utc_now()
        with self.session_factory() as db:
            record = load_valid_reset_token(db, raw_token, now, for_update=True)
            user = db.execute(
                select(User).where(User.id == record.user_id).with_for_update()
            ).scalar_one_or_none()
            if user is None:
                raise AuthServiceError("Account not found.", status_code=404)

            user.password_hash = hash_password(new_password)
            if not user.is_email_verified:
                user.is_email_verified = True
                user.verified_at = now
            record.consumed_at = now

            pending_otps = (
                db.execute(
                    select(OtpCode).where(OtpCode.user_id == user.id, OtpCode.consumed_at.is_(None))
                )
                .scalars()
                .all()
            )
            for otp in pending_otps:
                otp.consumed_at = now

            revoked_sessions = self._revoke_all_user_sessions(db, user.id, now)
            db.commit()
            return {
                "reset": True,
                "username": user.username,
                "revokedSessions": revoked_sessions,
                "message": "Your password has been updated and all previous sessions were signed out.",
            }
