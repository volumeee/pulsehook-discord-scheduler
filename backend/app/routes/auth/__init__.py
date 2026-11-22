"""Auth blueprint combining session/OTP routes and password recovery routes."""

from __future__ import annotations

from flask import Blueprint

auth_bp = Blueprint("auth", __name__)

from app.routes.auth import recovery_routes as _recovery_routes  # noqa: E402, F401
from app.routes.auth import session_routes as _session_routes  # noqa: E402, F401

__all__ = ["auth_bp"]
