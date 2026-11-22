"""Shared HTTP request parsing, Pydantic error formatting, rate-limit, and CSRF helpers."""

from __future__ import annotations

import ipaddress

from flask import current_app, jsonify, make_response, request
from pydantic import BaseModel, ValidationError

from app.services.security import verify_csrf_for_cookie_request


class BadRequestError(RuntimeError):
    """Raised when a JSON request body is missing or malformed."""


def format_validation_error(exc: ValidationError) -> tuple[dict[str, object], int]:
    safe_issues = [
        {
            "loc": list(issue.get("loc", [])),
            "msg": str(issue.get("msg", "Invalid value")).replace("Value error, ", ""),
            "type": str(issue.get("type", "value_error")),
        }
        for issue in exc.errors()
    ]
    first_msg = safe_issues[0]["msg"] if safe_issues else "Please check your input."
    return {"error": first_msg, "issues": safe_issues}, 400


def parse_json_body[SchemaT: BaseModel](schema_cls: type[SchemaT], *, allow_empty: bool = False) -> SchemaT:
    body = request.get_json(silent=True)
    if body is None and allow_empty:
        body = {}
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be valid JSON.")
    return schema_cls.model_validate(body)


def allow_local_origin() -> bool:
    return current_app.config.get("FLASK_ENV", "production") in {"development", "testing"}


def _is_trusted_proxy_ip(raw_ip: str | None) -> bool:
    if not raw_ip:
        return False
    try:
        addr = ipaddress.ip_address(raw_ip.strip())
    except ValueError:
        return False
    return addr.is_loopback or addr.is_private or addr.is_link_local


def client_ip() -> str:
    remote = (request.remote_addr or "").strip()
    if not _is_trusted_proxy_ip(remote):
        return remote or "unknown"

    cf_ip = (request.headers.get("CF-Connecting-IP") or "").strip()
    if cf_ip:
        return cf_ip

    raw_xff = (request.headers.get("X-Forwarded-For") or "").strip()
    hops = [part.strip() for part in raw_xff.split(",") if part.strip()]
    for hop in reversed(hops):
        if not _is_trusted_proxy_ip(hop):
            return hop
    return hops[0] if hops else (remote or "unknown")


def enforce_rate_limit(bucket: str, *, limit: int, window_seconds: int):
    limiter = current_app.extensions.get("rate_limiter")
    if limiter is None:
        return None
    allowed, retry_after = limiter.check(
        f"{bucket}:{client_ip()}", limit=limit, window_seconds=window_seconds
    )
    if allowed:
        return None
    resp = make_response(
        jsonify(
            {
                "error": f"Too many requests. Please wait {retry_after}s before trying again.",
                "retryAfterSeconds": retry_after,
            }
        ),
        429,
    )
    resp.headers["Retry-After"] = str(retry_after)
    return resp


def require_csrf():
    ok, err = verify_csrf_for_cookie_request(
        request,
        allowed_origins=current_app.config.get("ALLOWED_ORIGINS", []),
        allow_local=allow_local_origin(),
    )
    return None if ok else (jsonify({"error": err or "Forbidden."}), 403)
