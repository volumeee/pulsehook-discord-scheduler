"""Discord Webhook HTTP POST dispatcher with SSRF allowlist guard and timeout handling."""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import requests

from app.schemas.task_schema import normalize_discord_webhook_url, validate_discord_webhook_url

_WEBHOOK_TOKEN_RE = re.compile(r"(/webhooks/\d+/)([^/\s?#;]+)")


def _redact_webhook_secrets(text: str) -> str:
    return _WEBHOOK_TOKEN_RE.sub(r"\1[REDACTED]", text)


@dataclass(frozen=True)
class DiscordDispatchResult:
    ok: bool
    http_status: int | None
    duration_ms: int
    message: str
    retry_after_ms: int | None = None


HttpPostFn = Callable[..., requests.Response]


def send_discord_webhook(
    webhook_url: str,
    payload: dict[str, Any],
    *,
    timeout_seconds: float = 10.0,
    post_fn: HttpPostFn | None = None,
) -> DiscordDispatchResult:
    """Send a validated JSON payload to an official Discord Webhook endpoint."""
    started = time.perf_counter()
    valid, reason = validate_discord_webhook_url(webhook_url)
    if not valid:
        elapsed = max(1, int((time.perf_counter() - started) * 1000))
        return DiscordDispatchResult(
            ok=False,
            http_status=None,
            duration_ms=elapsed,
            message=f"Blocked invalid webhook URL: {reason}",
        )

    canonical_url = normalize_discord_webhook_url(webhook_url)
    sender = post_fn or requests.post
    try:
        response = sender(
            canonical_url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "PulseHook-Scheduler/1.0",
            },
            timeout=timeout_seconds,
            allow_redirects=False,
        )
        elapsed = max(1, int((time.perf_counter() - started) * 1000))

        if 200 <= response.status_code < 300:
            return DiscordDispatchResult(
                ok=True,
                http_status=response.status_code,
                duration_ms=elapsed,
                message=f"Delivered to Discord webhook (HTTP {response.status_code})",
            )

        detail = response.reason or "Webhook request failed"
        try:
            body = response.json()
            if isinstance(body, dict) and body.get("message"):
                code = body.get("code")
                detail = f"{body['message']} (code {code})" if code else str(body["message"])
        except Exception:
            if response.text:
                detail = response.text[:240]

        retry_after_ms: int | None = None
        if response.status_code == 429:
            retry_header = response.headers.get("Retry-After") or response.headers.get(
                "retry-after"
            )
            if retry_header:
                try:
                    parsed_sec = float(retry_header)
                    if parsed_sec > 0:
                        retry_after_ms = round(min(parsed_sec, 30.0) * 1000)
                except ValueError:
                    retry_after_ms = None

        return DiscordDispatchResult(
            ok=False,
            http_status=response.status_code,
            duration_ms=elapsed,
            message=(
                f"Discord rejected payload (HTTP {response.status_code}): "
                f"{_redact_webhook_secrets(detail)}"
            ),
            retry_after_ms=retry_after_ms,
        )
    except requests.Timeout:
        elapsed = max(1, int((time.perf_counter() - started) * 1000))
        return DiscordDispatchResult(
            ok=False,
            http_status=None,
            duration_ms=elapsed,
            message=f"Discord webhook timed out after {int(timeout_seconds * 1000)}ms",
        )
    except requests.RequestException as exc:
        elapsed = max(1, int((time.perf_counter() - started) * 1000))
        safe_detail = _redact_webhook_secrets(str(exc))[:200]
        return DiscordDispatchResult(
            ok=False,
            http_status=None,
            duration_ms=elapsed,
            message=f"Network error contacting Discord ({type(exc).__name__}): {safe_detail}",
        )
