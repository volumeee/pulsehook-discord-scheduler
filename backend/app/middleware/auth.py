"""Unified authentication middleware supporting HttpOnly cookie sessions (with CSRF defense) and X-API-Key."""

from __future__ import annotations

import hmac
from collections.abc import Callable
from datetime import timedelta
from functools import wraps
from typing import Any

from flask import current_app, g, jsonify, request
from sqlalchemy import or_, select, update

from app.extensions import ensure_utc, utc_now
from app.models.api_key import ApiKey
from app.models.user import User
from app.services.api_key_service import hash_api_key
from app.services.security import (
    ACCESS_COOKIE_NAME,
    verify_csrf_for_cookie_request,
)


def has_valid_env_api_key(config: dict[str, Any]) -> bool:
    """Return True only when both API_KEY and numeric API_KEY_USER_ID are configured."""
    configured_key = config.get("API_KEY")
    owner_id = config.get("API_KEY_USER_ID")
    return bool(configured_key) and bool(owner_id) and str(owner_id).isdigit()


def extract_access_cookie() -> str | None:
    token = (request.cookies.get(ACCESS_COOKIE_NAME) or "").strip()
    return token or None


def extract_api_key_from_request() -> str | None:
    """Extract an API key from X-API-Key or Authorization (ApiKey / Bearer) header."""
    header_key = (request.headers.get("X-API-Key") or "").strip()
    if header_key:
        return header_key

    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.startswith("ApiKey "):
        return auth_header[7:].strip() or None
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip() or None
    return None


def verify_api_key_credential(candidate: str) -> dict[str, Any] | None:
    """Verify candidate API key against env API_KEY or hashed api_keys table."""
    configured_key: str | None = current_app.config.get("API_KEY")
    if (
        has_valid_env_api_key(current_app.config)
        and configured_key
        and hmac.compare_digest(candidate, configured_key)
    ):
        owner_id = int(str(current_app.config["API_KEY_USER_ID"]))
        with current_app.extensions["session_factory"]() as db:
            owner = db.get(User, owner_id)
            if owner is None or not owner.is_email_verified:
                return None
            return {
                "method": "api_key",
                "userId": owner.id,
                "displayName": "Environment API Key",
                "keyName": "Environment API_KEY",
            }

    session_factory = current_app.extensions["session_factory"]
    candidate_hash = hash_api_key(candidate)

    with session_factory() as db:
        record = db.execute(
            select(ApiKey)
            .join(User, ApiKey.user_id == User.id)
            .where(ApiKey.key_hash == candidate_hash, User.is_email_verified.is_(True))
        ).scalar_one_or_none()
        if record is None:
            return None

        now = utc_now()
        cutoff = now - timedelta(seconds=60)
        last_used = ensure_utc(record.last_used_at) if record.last_used_at is not None else None
        if last_used is None or last_used < cutoff:
            db.execute(
                update(ApiKey)
                .where(
                    ApiKey.id == record.id,
                    or_(ApiKey.last_used_at.is_(None), ApiKey.last_used_at < cutoff),
                )
                .values(last_used_at=now)
            )
            db.commit()
        return {
            "method": "api_key",
            "keyId": record.id,
            "userId": record.user_id,
            "displayName": record.name,
            "keyName": record.name,
        }


def verify_request_principal() -> tuple[dict[str, Any] | None, str | None, int]:
    """Verify either an HttpOnly access cookie (with CSRF check) or an X-API-Key header.

    Returns (principal, error_message, error_status).
    """
    # 1. Explicit X-API-Key / ApiKey header (Postman, CI, automation)
    candidate_key = extract_api_key_from_request()
    if candidate_key:
        principal = verify_api_key_credential(candidate_key)
        if principal is not None:
            return principal, None, 200
        return None, "Unauthorized: Invalid API key.", 401

    # 2. Browser HttpOnly Cookie-Only Session (ph_access)
    access_cookie = extract_access_cookie()
    if not access_cookie:
        return (
            None,
            "Unauthorized: Sign in with your account or provide a valid X-API-Key header.",
            401,
        )

    allowed_origins: list[str] = current_app.config.get("ALLOWED_ORIGINS", [])
    allow_local = current_app.config.get("FLASK_ENV", "production") in {"development", "testing"}
    csrf_ok, csrf_err = verify_csrf_for_cookie_request(
        request, allowed_origins=allowed_origins, allow_local=allow_local
    )
    if not csrf_ok:
        return None, csrf_err or "Forbidden: CSRF validation failed.", 403

    auth_service = current_app.extensions.get("auth_service")
    if auth_service is None:
        return None, "Unauthorized: Authentication service unavailable.", 401

    principal = auth_service.verify_access_token_cookie(access_cookie)
    if principal is None:
        return None, "Unauthorized: Session expired or invalid credentials.", 401

    return principal, None, 200


def require_api_auth(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator enforcing HttpOnly cookie session (CSRF-protected) or X-API-Key auth."""

    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        principal, err_msg, err_status = verify_request_principal()
        if principal is None:
            return jsonify({"error": err_msg or "Unauthorized."}), err_status

        g.principal = principal
        return fn(*args, **kwargs)

    return wrapper
