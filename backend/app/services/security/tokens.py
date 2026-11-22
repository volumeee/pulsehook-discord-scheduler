"""HMAC-SHA256 signed short-lived access tokens bound to revocable DB sessions."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from typing import Any

ACCESS_TOKEN_PREFIX = "ph_acc_"
ACCESS_TOKEN_TTL_SECONDS = 15 * 60
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

_B64URL_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _is_strict_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes | None:
    if not _B64URL_RE.match(encoded):
        return None
    padding = "=" * (-len(encoded) % 4)
    try:
        return base64.urlsafe_b64decode(encoded + padding)
    except ValueError:
        return None


def sign_access_token(
    *,
    secret: str,
    user_id: int,
    session_id: int,
    family_id: str,
    username: str = "",
    ttl_seconds: int = ACCESS_TOKEN_TTL_SECONDS,
    now_ts: int | None = None,
) -> str:
    """Create a compact HMAC-SHA256 signed access token bound to a revocable session."""
    issued_at = int(now_ts if now_ts is not None else time.time())
    payload = {
        "typ": "access",
        "sub": int(user_id),
        "sid": int(session_id),
        "fid": family_id,
        "usr": username,
        "iat": issued_at,
        "exp": issued_at + int(ttl_seconds),
    }
    raw_payload = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url_encode(raw_payload)
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{ACCESS_TOKEN_PREFIX}{payload_b64}.{_b64url_encode(sig)}"


def verify_access_token(
    token: str,
    *,
    secret: str,
    now_ts: int | None = None,
    allow_expired: bool = False,
) -> dict[str, Any] | None:
    """Verify HMAC-SHA256 signature and expiration of an access token."""
    if not token or not token.startswith(ACCESS_TOKEN_PREFIX):
        return None
    body = token[len(ACCESS_TOKEN_PREFIX) :]
    if "." not in body:
        return None
    payload_b64, sig_b64 = body.split(".", 1)
    if not payload_b64 or not sig_b64 or not payload_b64.isascii() or not sig_b64.isascii():
        return None

    expected_sig = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    actual_sig = _b64url_decode(sig_b64)
    if actual_sig is None or not hmac.compare_digest(expected_sig, actual_sig):
        return None

    raw_bytes = _b64url_decode(payload_b64)
    if raw_bytes is None:
        return None
    try:
        claims = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None

    now = int(now_ts if now_ts is not None else time.time())
    exp = claims.get("exp") if isinstance(claims, dict) else None
    fid = claims.get("fid") if isinstance(claims, dict) else None
    if (
        not isinstance(claims, dict)
        or claims.get("typ") != "access"
        or not _is_strict_int(exp)
        or (not allow_expired and now >= exp)
        or not _is_strict_int(claims.get("sub"))
        or not _is_strict_int(claims.get("sid"))
        or not isinstance(fid, str)
        or not fid.strip()
    ):
        return None

    return claims
