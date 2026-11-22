"""Resend HTTPS API transactional email dispatcher for PulseHook."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import requests

from app.services.email.layout import RenderedEmail

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class EmailDeliveryError(RuntimeError):
    """Raised when Resend cannot dispatch a transactional email."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class EmailDeliveryResult:
    delivered: bool
    message_id: str | None
    recipient: str
    subject: str


class ResendEmailService:
    """Sends HTML + plain-text transactional emails over HTTPS using Resend."""

    def __init__(
        self,
        *,
        api_key: str | None,
        sender: str = "PulseHook <onboarding@resend.dev>",
        timeout_seconds: float = 10.0,
    ) -> None:
        self.api_key = (api_key or "").strip() or None
        self.sender = sender.strip() or "PulseHook <onboarding@resend.dev>"
        self.timeout_seconds = timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def send_email(self, *, to_email: str, rendered: RenderedEmail) -> EmailDeliveryResult:
        if not self.api_key:
            raise EmailDeliveryError(
                "Email delivery is not configured on the server yet. Set RESEND_API_KEY in .env to send OTP codes.",
                status_code=503,
            )

        payload: dict[str, Any] = {
            "from": self.sender,
            "to": [to_email],
            "subject": rendered.subject,
            "html": rendered.html_body,
            "text": rendered.text_body,
        }
        if rendered.attachments:
            payload["attachments"] = list(rendered.attachments)

        try:
            response = requests.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout_seconds,
                allow_redirects=False,
            )
        except requests.Timeout as exc:
            logger.warning("Resend API request timed out for %s", to_email)
            raise EmailDeliveryError(
                "Email delivery timed out while reaching Resend. Please try again in a moment.",
                status_code=504,
            ) from exc
        except requests.RequestException as exc:
            logger.warning("Resend API network failure: %s", exc)
            raise EmailDeliveryError(
                "Could not connect to Resend email service. Check server internet connectivity.",
                status_code=502,
            ) from exc

        try:
            raw_data = response.json() if response.content else {}
        except ValueError:
            raw_data = {}
        data = raw_data if isinstance(raw_data, dict) else {}

        if 200 <= response.status_code < 300:
            msg_id = str(data["id"]) if data.get("id") else None
            logger.info("Resend email dispatched (id=%s) to %s", msg_id, to_email)
            return EmailDeliveryResult(
                delivered=True,
                message_id=msg_id,
                recipient=to_email,
                subject=rendered.subject,
            )

        raw_err = str(data.get("message") or data.get("error") or "")
        lower_err = raw_err.lower()
        if response.status_code == 403 and ("testing emails" in lower_err or "verify a domain" in lower_err):
            raise EmailDeliveryError(
                "Resend's sandbox sender (onboarding@resend.dev) can only deliver to your verified Resend account email. "
                "Sign up using your verified Resend email address or configure a verified domain in RESEND_FROM.",
                status_code=400,
            )
        if response.status_code == 401:
            raise EmailDeliveryError(
                "Resend rejected the server RESEND_API_KEY. Verify your API key in .env.",
                status_code=502,
            )

        logger.warning("Resend delivery rejected (%s): %s", response.status_code, raw_err or f"HTTP {response.status_code}")
        raise EmailDeliveryError(
            "Could not send email right now. Please try again in a moment.",
            status_code=502,
        )
