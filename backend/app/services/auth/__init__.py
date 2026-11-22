"""Modular authentication service, password hashing, and domain errors."""

from app.services.auth.crypto import (
    AuthServiceError,
    hash_password,
    hash_secret,
    mask_email,
    verify_password,
)
from app.services.auth.service import AuthService

__all__ = [
    "AuthService",
    "AuthServiceError",
    "hash_password",
    "hash_secret",
    "mask_email",
    "verify_password",
]
