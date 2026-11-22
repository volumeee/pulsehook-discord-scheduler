"""Pydantic v2 validation schemas, cron validation, and SSRF-safe Discord Webhook URL guard."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlsplit

from croniter import CroniterBadDateError, croniter
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.extensions import ensure_utc, utc_now

ALLOWED_DISCORD_HOSTS = frozenset(
    {
        "discord.com",
        "discordapp.com",
        "ptb.discord.com",
        "canary.discord.com",
    }
)

DISCORD_WEBHOOK_PATH_RE = re.compile(r"^/api(?:/v\d+)?/webhooks/\d{15,22}/[A-Za-z0-9_-]{20,120}/?$")


def normalize_discord_webhook_url(raw_url: str) -> str:
    """Return canonical https://{host}{path} for an already-validated Discord webhook URL."""
    parsed = urlsplit(raw_url.strip())
    return f"https://{(parsed.hostname or '').lower()}{parsed.path}"


def validate_discord_webhook_url(raw_url: str) -> tuple[bool, str | None]:
    """Validate that a webhook URL strictly targets official HTTPS Discord Webhook endpoints."""
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in raw_url):
        return False, "Webhook URL must not contain whitespace or control characters."
    url = raw_url.strip()
    if not url:
        return False, "Discord Webhook URL is required."
    if any(ch.isspace() for ch in url):
        return False, "Webhook URL must not contain whitespace or control characters."

    parsed = urlsplit(url)
    if parsed.scheme.lower() != "https":
        return (
            False,
            "Discord webhooks require HTTPS (https://discord.com/api/webhooks/...).",
        )

    if (
        "@" in parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
    ):
        return (
            False,
            "Webhook URL must not include custom ports or embedded credentials.",
        )

    hostname = (parsed.hostname or "").lower()
    if hostname not in ALLOWED_DISCORD_HOSTS:
        return (
            False,
            "Only official Discord webhook URLs (discord.com or discordapp.com) are allowed.",
        )

    if parsed.query or parsed.fragment or "?" in url or "#" in url or ";" in parsed.path:
        return False, "Webhook URL must not include query parameters, fragments, or path params."

    if not DISCORD_WEBHOOK_PATH_RE.match(parsed.path):
        return (
            False,
            "Webhook path must match /api/webhooks/{webhook_id}/{webhook_token}.",
        )

    return True, None


def is_valid_cron_expression(expression: str) -> bool:
    """Validate a standard 5-field cron expression."""
    trimmed = expression.strip()
    if (
        len(trimmed.split()) != 5
        or re.search(r"(?<![A-Za-z])r(?![A-Za-z])", trimmed, re.IGNORECASE)
        or not croniter.is_valid(trimmed)
    ):
        return False
    try:
        croniter(trimmed, utc_now()).get_next(datetime)
    except CroniterBadDateError:
        return False
    return True


def compute_next_run(expression: str, base_time: datetime | None = None) -> datetime | None:
    """Compute the next UTC execution timestamp for a valid 5-field cron expression."""
    if not is_valid_cron_expression(expression):
        return None
    base = ensure_utc(base_time) if base_time is not None else utc_now()
    next_dt = croniter(expression.strip(), base).get_next(datetime)
    return ensure_utc(next_dt)


class DiscordEmbedFieldSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = Field(..., min_length=1, max_length=256)
    value: str = Field(..., min_length=1, max_length=1024)
    inline: bool | None = None


class DiscordEmbedFooterSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    text: str = Field(..., min_length=1, max_length=2048)
    icon_url: str | None = None


class DiscordEmbedSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str | None = Field(default=None, max_length=256)
    description: str | None = Field(default=None, max_length=4096)
    url: str | None = None
    color: int | None = Field(default=None, ge=0, le=0xFFFFFF)
    timestamp: str | None = None
    footer: DiscordEmbedFooterSchema | None = None
    fields: list[DiscordEmbedFieldSchema] | None = Field(default=None, max_length=25)


class DiscordPayloadSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    content: str | None = Field(default=None, max_length=2000)
    username: str | None = Field(default=None, max_length=80)
    avatar_url: str | None = None
    tts: bool | None = None
    embeds: list[DiscordEmbedSchema] | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def require_content_or_embeds(self) -> DiscordPayloadSchema:
        has_content = bool(self.content and self.content.strip())
        has_embeds = bool(self.embeds and len(self.embeds) > 0)
        if not has_content and not has_embeds:
            raise ValueError("Payload must include either non-empty content or at least one embed.")
        return self

    def to_clean_dict(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class CreateTaskSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=2, max_length=120)
    schedule: str
    webhook_url: str = Field(..., alias="webhookUrl")
    payload: DiscordPayloadSchema
    max_retry: int = Field(default=3, ge=0, le=10, alias="maxRetry")
    retry_delay_ms: int = Field(default=1000, ge=100, le=60000, alias="retryDelayMs")
    status: Literal["active", "paused", "failed"] = "active"

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 2:
            raise ValueError("Task name must be at least 2 characters.")
        return trimmed

    @field_validator("schedule")
    @classmethod
    def check_schedule(cls, value: str) -> str:
        trimmed = value.strip()
        if not is_valid_cron_expression(trimmed):
            raise ValueError("Enter a valid 5-field cron expression (e.g. 0 9 * * 1-5).")
        return trimmed

    @field_validator("webhook_url")
    @classmethod
    def check_webhook_url(cls, value: str) -> str:
        ok, reason = validate_discord_webhook_url(value)
        if not ok:
            raise ValueError(reason or "Invalid Discord Webhook URL.")
        return normalize_discord_webhook_url(value)


class UpdateTaskSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=2, max_length=120)
    schedule: str | None = None
    webhook_url: str | None = Field(default=None, alias="webhookUrl")
    payload: DiscordPayloadSchema | None = None
    max_retry: int | None = Field(default=None, ge=0, le=10, alias="maxRetry")
    retry_delay_ms: int | None = Field(default=None, ge=100, le=60000, alias="retryDelayMs")
    status: Literal["active", "paused", "failed"] | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if len(trimmed) < 2:
            raise ValueError("Task name must be at least 2 characters.")
        return trimmed

    @field_validator("schedule")
    @classmethod
    def check_schedule(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not is_valid_cron_expression(trimmed):
            raise ValueError("Enter a valid 5-field cron expression (e.g. 0 9 * * 1-5).")
        return trimmed

    @field_validator("webhook_url")
    @classmethod
    def check_webhook_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        ok, reason = validate_discord_webhook_url(value)
        if not ok:
            raise ValueError(reason or "Invalid Discord Webhook URL.")
        return normalize_discord_webhook_url(value)


