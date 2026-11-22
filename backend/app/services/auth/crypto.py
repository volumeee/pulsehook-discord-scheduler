"""Auth domain error, password hashing (scrypt), masking, and user-agent helpers."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any

OTP_TTL_MINUTES = 5
OTP_RESEND_GRACE_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
PASSWORD_RESET_TTL_MINUTES = 15
PASSWORD_RESET_COOLDOWN_SECONDS = 60
REFRESH_TOKEN_PREFIX = "ph_ref_"
PASSWORD_RESET_TOKEN_PREFIX = "ph_rst_"
FORGOT_PASSWORD_NEUTRAL_MESSAGE = (
    "If an account matches that email or username, we've sent a password reset link."
)

_BROWSERS = (
    ("Edg/", "Microsoft Edge"),
    ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"),
    ("Safari/", "Safari"),
)
_PLATFORMS = (
    ("Android", "Android"),
    ("iPhone", "iOS"),
    ("iPad", "iOS"),
    ("Mac OS X", "macOS"),
    ("Windows", "Windows"),
    ("Linux", "Linux"),
)


class AuthServiceError(RuntimeError):
    """Domain error carrying an explicit HTTP status code and optional response fields."""

    def __init__(
        self, message: str, status_code: int = 400, extra: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.extra = extra or {}


def hash_secret(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash password with salted scrypt (stdlib, zero external crypto dependency)."""
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if len(parts) != 6 or parts[0] != "scrypt":
        return False
    _, n_str, r_str, p_str, salt_hex, expected_hex = parts
    if not (n_str.isdigit() and r_str.isdigit() and p_str.isdigit()):
        return False
    try:
        salt = bytes.fromhex(salt_hex)
        derived = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n_str), r=int(r_str), p=int(p_str), dklen=32
        )
    except ValueError:
        return False
    return hmac.compare_digest(derived.hex(), expected_hex)


DUMMY_PASSWORD_HASH = hash_password("pulsehook-dummy-timing-guard")


def mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = f"{local[0]}***" if local else "***"
    else:
        masked_local = f"{local[0]}{'*' * min(len(local) - 2, 4)}{local[-1]}"
    return f"{masked_local}@{domain}"


def summarize_user_agent(user_agent: str | None) -> str:
    if not user_agent:
        return "Web browser"
    ua = user_agent.strip()
    browser = next((name for token, name in _BROWSERS if token in ua), "Web browser")
    platform = next((name for token, name in _PLATFORMS if token in ua), "")
    return f"{browser} on {platform}" if platform else browser
