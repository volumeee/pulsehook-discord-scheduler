"""Modular transactional email builders and Resend HTTPS delivery client."""

from app.services.email.client import (
    RESEND_API_URL,
    EmailDeliveryError,
    EmailDeliveryResult,
    ResendEmailService,
)
from app.services.email.layout import BRAND_LOGO_CONTENT_ID, RenderedEmail
from app.services.email.templates import (
    build_login_otp_email,
    build_password_reset_email,
    build_verification_email,
)

__all__ = [
    "BRAND_LOGO_CONTENT_ID",
    "RESEND_API_URL",
    "EmailDeliveryError",
    "EmailDeliveryResult",
    "RenderedEmail",
    "ResendEmailService",
    "build_login_otp_email",
    "build_password_reset_email",
    "build_verification_email",
]
