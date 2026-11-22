"""Application configuration loaded from environment variables and optional test overrides."""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, load_dotenv

_EPHEMERAL_TOKEN_SECRET = secrets.token_hex(32)

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
_DOTENV_VALUES: dict[str, str | None] = dotenv_values(_ROOT_ENV) if _ROOT_ENV.exists() else {}
if _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV)
else:
    load_dotenv()

_TRUTHY = frozenset({"1", "true", "yes", "on"})
_FALSY = frozenset({"0", "false", "no", "off"})


def _pick(overrides: dict[str, Any] | None, key: str, default: str = "") -> Any:
    if overrides and key in overrides:
        return overrides[key]
    if key in os.environ:
        return os.environ[key]
    return _DOTENV_VALUES.get(key) or default


def _str_opt(value: Any) -> str | None:
    cleaned = str(value).strip() if value is not None else ""
    return cleaned or None


def _parse_bool(raw: Any, default: bool) -> bool:
    if isinstance(raw, bool):
        return raw
    token = str(raw or "").strip().lower()
    if token in _TRUTHY:
        return True
    if token in _FALSY:
        return False
    return default


def _parse_int(raw: Any, default: int, *, minimum: int = 0) -> int:
    text = str(raw if raw is not None else "").strip()
    if not text.lstrip("-").isdigit():
        return max(minimum, default)
    return max(minimum, int(text))


def _parse_float(raw: Any, default: float, *, minimum: float = 0.0) -> float:
    try:
        return max(minimum, float(raw))
    except (TypeError, ValueError):
        return max(minimum, default)


def normalize_database_url(raw_url: str) -> str:
    """Ensure PostgreSQL URLs use the psycopg v3 SQLAlchemy driver."""
    url = raw_url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


@dataclass(frozen=True)
class Settings:
    database_url: str
    api_key: str | None
    api_key_owner_id: str | None
    resend_api_key: str | None
    resend_from: str
    auth_token_secret: str
    app_base_url: str | None
    flask_env: str
    enable_scheduler: bool
    allow_registration: bool
    discord_timeout_seconds: float
    cors_origins: str
    qstash_url: str = "https://qstash.upstash.io"
    qstash_token: str | None = None
    qstash_max_retries: int = 3
    qstash_log_sync_ttl_seconds: float = 15.0
    vps_keepalive_cron: str | None = None
    vps_keepalive_url: str | None = None
    vps_keepalive_bearer_token: str | None = None
    gunicorn_workers: int = 1
    enable_rate_limit: bool = True


def load_settings(overrides: dict[str, Any] | None = None) -> Settings:
    raw_db_url = _str_opt(_pick(overrides, "DATABASE_URL"))
    if not raw_db_url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Set DATABASE_URL in .env or environment variables."
        )

    normalized_db_url = normalize_database_url(raw_db_url)
    flask_env = (_str_opt(_pick(overrides, "FLASK_ENV", "production")) or "production").lower()

    configured_secret = _str_opt(_pick(overrides, "AUTH_TOKEN_SECRET"))
    if (
        not configured_secret
        and flask_env not in {"development", "testing"}
        and not normalized_db_url.startswith("sqlite:")
    ):
        raise RuntimeError(
            "AUTH_TOKEN_SECRET must be set in production so auth sessions survive restarts."
        )

    app_base_url = _str_opt(_pick(overrides, "APP_BASE_URL"))
    qstash_url = (_str_opt(_pick(overrides, "QSTASH_URL", "https://qstash.upstash.io")) or "https://qstash.upstash.io").rstrip("/")
    default_rate_limit = flask_env != "testing"
    raw_rate_limit = _pick(overrides, "ENABLE_RATE_LIMIT", "")
    enable_rate_limit = _parse_bool(raw_rate_limit, default_rate_limit) if raw_rate_limit != "" else default_rate_limit

    return Settings(
        database_url=normalized_db_url,
        api_key=_str_opt(_pick(overrides, "API_KEY")),
        api_key_owner_id=_str_opt(_pick(overrides, "API_KEY_USER_ID")),
        resend_api_key=_str_opt(_pick(overrides, "RESEND_API_KEY")),
        resend_from=_str_opt(_pick(overrides, "RESEND_FROM")) or "PulseHook <noreply@pulsehook.bagos.web.id>",
        auth_token_secret=configured_secret or _EPHEMERAL_TOKEN_SECRET,
        app_base_url=app_base_url.rstrip("/") if app_base_url else None,
        flask_env=flask_env,
        enable_scheduler=_parse_bool(_pick(overrides, "ENABLE_SCHEDULER", "true"), True),
        allow_registration=_parse_bool(_pick(overrides, "ALLOW_REGISTRATION", "true"), True),
        discord_timeout_seconds=_parse_float(_pick(overrides, "DISCORD_TIMEOUT_SECONDS", "10"), 10.0, minimum=1.0),
        cors_origins=_str_opt(_pick(overrides, "CORS_ORIGINS")) or "http://localhost:3000",
        qstash_url=qstash_url,
        qstash_token=_str_opt(_pick(overrides, "QSTASH_TOKEN")),
        qstash_max_retries=_parse_int(_pick(overrides, "QSTASH_MAX_RETRIES", "3"), 3, minimum=0),
        qstash_log_sync_ttl_seconds=_parse_float(_pick(overrides, "QSTASH_LOG_SYNC_TTL_SECONDS", "15"), 15.0, minimum=0.0),
        vps_keepalive_cron=_str_opt(_pick(overrides, "VPS_KEEPALIVE_CRON")),
        vps_keepalive_url=_str_opt(_pick(overrides, "VPS_KEEPALIVE_URL")),
        vps_keepalive_bearer_token=_str_opt(_pick(overrides, "VPS_KEEPALIVE_BEARER_TOKEN")),
        gunicorn_workers=_parse_int(_pick(overrides, "GUNICORN_WORKERS", "1"), 1, minimum=1),
        enable_rate_limit=enable_rate_limit,
    )
