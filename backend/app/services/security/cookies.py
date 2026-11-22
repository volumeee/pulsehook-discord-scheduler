"""Hardened HttpOnly first-party authentication cookie helpers."""

from __future__ import annotations

from flask import Response

from app.services.security.tokens import ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS

ACCESS_COOKIE_NAME = "ph_access"
REFRESH_COOKIE_NAME = "ph_refresh"


def format_cookie_header(
    name: str,
    value: str,
    *,
    path: str,
    max_age: int,
    http_only: bool = True,
    secure: bool = True,
    same_site: str = "Lax",
) -> str:
    """Build a hardened first-party Set-Cookie header string."""
    parts = [f"{name}={value}", f"Path={path}", f"Max-Age={max_age}"]
    if max_age <= 0:
        parts.append("Expires=Thu, 01 Jan 1970 00:00:00 GMT")
    if http_only:
        parts.append("HttpOnly")
    if secure:
        parts.append("Secure")
    if same_site:
        parts.append(f"SameSite={same_site}")
    return "; ".join(parts)


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    access_max_age: int = ACCESS_TOKEN_TTL_SECONDS,
    refresh_max_age: int = REFRESH_TOKEN_TTL_SECONDS,
    secure: bool = True,
) -> Response:
    """Attach both HttpOnly access and path-scoped rotating refresh cookies."""
    response.headers.add(
        "Set-Cookie",
        format_cookie_header(
            ACCESS_COOKIE_NAME,
            access_token,
            path="/api",
            max_age=access_max_age,
            http_only=True,
            secure=secure,
            same_site="Lax",
        ),
    )
    response.headers.add(
        "Set-Cookie",
        format_cookie_header(
            REFRESH_COOKIE_NAME,
            refresh_token,
            path="/api/auth",
            max_age=refresh_max_age,
            http_only=True,
            secure=secure,
            same_site="Lax",
        ),
    )
    return response


def clear_auth_cookies(response: Response, *, secure: bool = True) -> Response:
    """Expire both HttpOnly auth cookies cleanly."""
    response.headers.add(
        "Set-Cookie",
        format_cookie_header(
            ACCESS_COOKIE_NAME,
            "",
            path="/api",
            max_age=0,
            http_only=True,
            secure=secure,
            same_site="Lax",
        ),
    )
    response.headers.add(
        "Set-Cookie",
        format_cookie_header(
            REFRESH_COOKIE_NAME,
            "",
            path="/api/auth",
            max_age=0,
            http_only=True,
            secure=secure,
            same_site="Lax",
        ),
    )
    return response
