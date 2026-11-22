"""Origin allowlist, safe public base URL resolution, and CSRF defense-in-depth."""

from __future__ import annotations

from urllib.parse import urlparse

from flask import Request

CSRF_HEADER_NAME = "X-Requested-With"
CSRF_HEADER_VALUE = "PulseHook"

_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _normalized_origin_tuple(raw_url: str) -> tuple[str, str, int] | None:
    parsed = urlparse(raw_url)
    if parsed.username is not None or parsed.password is not None:
        return None
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower().strip()
    if scheme not in {"http", "https"} or not host:
        return None
    try:
        port = parsed.port
    except ValueError:
        return None
    resolved_port = port if port is not None else (443 if scheme == "https" else 80)
    return scheme, host, resolved_port


def _format_origin(scheme: str, host: str, port: int) -> str:
    host_display = f"[{host}]" if ":" in host else host
    default_port = 443 if scheme == "https" else 80
    if port == default_port:
        return f"{scheme}://{host_display}"
    return f"{scheme}://{host_display}:{port}"


def _extract_allowed_origins(allowed_origins: list[str]) -> set[tuple[str, str, int]]:
    origins: set[tuple[str, str, int]] = set()
    for origin in allowed_origins:
        norm = _normalized_origin_tuple(origin)
        if norm is not None:
            origins.add(norm)
    return origins


def resolve_safe_app_base_url(
    req: Request,
    *,
    configured_base_url: str | None,
    allowed_origins: list[str],
    allow_local: bool = True,
) -> str:
    """Derive a trusted public base URL for password reset links, blocking Host Header Injection."""
    # 1. Prefer explicitly configured APP_BASE_URL so request headers can never poison reset links
    if configured_base_url:
        cfg_tuple = _normalized_origin_tuple(configured_base_url)
        if cfg_tuple is not None:
            return _format_origin(*cfg_tuple)

    allowed_tuples = _extract_allowed_origins(allowed_origins)

    # 2. When APP_BASE_URL is unset (local dev/tests), inspect Origin against exact allowlist
    origin = (req.headers.get("Origin") or "").strip()
    if origin:
        origin_tuple = _normalized_origin_tuple(origin)
        if origin_tuple is not None:
            scheme, host, port = origin_tuple
            if allow_local and host in _LOCAL_HOSTS:
                return _format_origin(scheme, host, port)
            if origin_tuple in allowed_tuples and scheme == "https":
                return _format_origin(scheme, host, port)

    # 3. Inspect X-Forwarded-Host against explicit allowlist (exact host+port match for non-local)
    fwd_host = (req.headers.get("X-Forwarded-Host") or "").split(",")[0].strip()
    if fwd_host and "/" not in fwd_host and "@" not in fwd_host:
        parsed_https = _normalized_origin_tuple(f"https://{fwd_host}")
        if parsed_https is not None:
            _, host, port = parsed_https
            if allow_local and host in _LOCAL_HOSTS:
                # Re-parse with http so default port maps to 80 when unspecified
                parsed_http = _normalized_origin_tuple(f"http://{fwd_host}")
                if parsed_http is not None:
                    return _format_origin(*parsed_http)
            if parsed_https in allowed_tuples:
                return _format_origin(*parsed_https)

    # 4. Safe fallback to first configured HTTPS allowlist origin if any, else localhost
    for scheme, host, port in sorted(allowed_tuples):
        if scheme == "https" and host not in _LOCAL_HOSTS:
            return _format_origin(scheme, host, port)
    return "http://localhost:3000"


def verify_csrf_for_cookie_request(
    req: Request,
    *,
    allowed_origins: list[str],
    allow_local: bool = True,
) -> tuple[bool, str | None]:
    """Enforce CSRF defense-in-depth on cookie-authenticated state-changing requests."""
    if req.method in {"GET", "HEAD", "OPTIONS"}:
        return True, None

    if (req.headers.get(CSRF_HEADER_NAME) or "").strip() != CSRF_HEADER_VALUE:
        return (
            False,
            "Forbidden: Missing or invalid anti-CSRF request header.",
        )

    allowed_tuples = _extract_allowed_origins(allowed_origins)

    origin = (req.headers.get("Origin") or "").strip()
    referer = (req.headers.get("Referer") or "").strip()
    source_url = origin or referer
    if not source_url:
        if not allow_local:
            return False, "Forbidden: Missing request origin."
        return True, None

    src_tuple = _normalized_origin_tuple(source_url)
    if src_tuple is None:
        return False, "Forbidden: Invalid request origin."

    _scheme, src_host, _port = src_tuple
    if allow_local and src_host in _LOCAL_HOSTS:
        return True, None
    if src_tuple in allowed_tuples:
        return True, None

    return False, "Forbidden: Cross-site request origin rejected."
