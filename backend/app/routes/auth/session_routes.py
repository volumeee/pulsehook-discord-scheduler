"""Account registration, login, OTP verification, cookie refresh/logout, and API key bootstrap routes."""

from __future__ import annotations

from flask import current_app, g, jsonify, make_response, request

from app.middleware.auth import has_valid_env_api_key, require_api_auth
from app.routes.auth import auth_bp
from app.routes.http_helpers import enforce_rate_limit, parse_json_body, require_csrf
from app.schemas.auth_schema import LoginSchema, RegisterSchema, ResendOtpSchema, VerifyOtpSchema
from app.services.api_key_service import generate_api_key, hash_api_key
from app.services.auth import AuthServiceError
from app.services.security import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    set_auth_cookies,
)


@auth_bp.get("/auth/status")
def auth_status():
    email_service = current_app.extensions["email_service"]
    has_cookie = bool(
        request.cookies.get(ACCESS_COOKIE_NAME) or request.cookies.get(REFRESH_COOKIE_NAME)
    )
    return jsonify(
        {
            "authMode": "account_otp",
            "sessionTransport": "http_only_cookies",
            "hasSessionCookie": has_cookie,
            "resendConfigured": email_service.is_configured,
            "registrationEnabled": bool(current_app.config.get("ALLOW_REGISTRATION", True)),
        }
    )


@auth_bp.post("/auth/register")
def register_account():
    if limited := enforce_rate_limit("register", limit=10, window_seconds=300):
        return limited
    if not current_app.config.get("ALLOW_REGISTRATION", True):
        return jsonify({"error": "New account registration is disabled on this workspace."}), 403

    validated = parse_json_body(RegisterSchema)
    result = current_app.extensions["auth_service"].register_account(
        username=validated.username,
        email=validated.email,
        password=validated.password,
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify(result), 201


@auth_bp.post("/auth/login")
def login_account():
    if limited := enforce_rate_limit("login", limit=15, window_seconds=300):
        return limited

    validated = parse_json_body(LoginSchema)
    result = current_app.extensions["auth_service"].start_login(
        identifier=validated.identifier,
        password=validated.password,
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify(result), 200


@auth_bp.post("/auth/verify-otp")
def verify_otp():
    if limited := enforce_rate_limit("verify_otp", limit=20, window_seconds=300):
        return limited

    validated = parse_json_body(VerifyOtpSchema)
    result = current_app.extensions["auth_service"].verify_otp(
        challenge_token=validated.challengeToken,
        code=validated.code,
        user_agent=request.headers.get("User-Agent"),
    )
    response = make_response(
        jsonify(
            {
                "authenticated": True,
                "expiresAt": result["expiresAt"],
                "principal": result["principal"],
            }
        ),
        200,
    )
    return set_auth_cookies(
        response,
        access_token=result["accessToken"],
        refresh_token=result["refreshToken"],
    )


@auth_bp.post("/auth/resend-otp")
def resend_otp():
    if limited := enforce_rate_limit("resend_otp", limit=10, window_seconds=300):
        return limited

    validated = parse_json_body(ResendOtpSchema)
    result = current_app.extensions["auth_service"].resend_otp(
        challenge_token=validated.challengeToken,
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify(result), 200


@auth_bp.post("/auth/refresh")
def refresh_session():
    if limited := enforce_rate_limit("refresh", limit=30, window_seconds=300):
        return limited
    if csrf_err := require_csrf():
        return csrf_err

    raw_refresh = (request.cookies.get(REFRESH_COOKIE_NAME) or "").strip()
    if not raw_refresh:
        return clear_auth_cookies(
            make_response(jsonify({"error": "No refresh session found. Please sign in."}), 401)
        )

    try:
        result = current_app.extensions["auth_service"].rotate_refresh_token(
            raw_refresh, user_agent=request.headers.get("User-Agent")
        )
    except AuthServiceError as exc:
        return clear_auth_cookies(
            make_response(jsonify({"error": str(exc), **exc.extra}), exc.status_code)
        )

    response = make_response(
        jsonify(
            {
                "refreshed": True,
                "expiresAt": result["expiresAt"],
                "principal": result["principal"],
            }
        ),
        200,
    )
    return set_auth_cookies(
        response,
        access_token=result["accessToken"],
        refresh_token=result["refreshToken"],
    )


@auth_bp.post("/auth/logout")
def logout_account():
    if limited := enforce_rate_limit("logout", limit=30, window_seconds=300):
        return limited
    if csrf_err := require_csrf():
        return csrf_err

    access_cookie = (request.cookies.get(ACCESS_COOKIE_NAME) or "").strip() or None
    refresh_cookie = (request.cookies.get(REFRESH_COOKIE_NAME) or "").strip() or None
    revoked = (
        current_app.extensions["auth_service"].revoke_session_from_cookies(
            access_token=access_cookie, refresh_token=refresh_cookie
        )
        if (access_cookie or refresh_cookie)
        else False
    )
    return clear_auth_cookies(make_response(jsonify({"signedOut": True, "revoked": revoked}), 200))


@auth_bp.post("/auth/bootstrap")
@require_api_auth
def bootstrap_workspace_key():
    """One-time atomic per-user API key initialization for headless/CI setups."""
    if has_valid_env_api_key(current_app.config):
        return jsonify({"error": "API_KEY is already configured via server environment variables."}), 409

    raw_body = request.get_json(silent=True)
    if raw_body is not None and not isinstance(raw_body, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    body = raw_body or {}

    raw_name = str(body.get("name") or "").strip()
    label = raw_name[:80] if len(raw_name) >= 2 else "Initial Workspace Key"
    custom_key = str(body.get("customKey") or "").strip()

    if custom_key:
        if len(custom_key) < 12:
            return jsonify({"error": "Custom API key must be at least 12 characters long."}), 400
        raw_key, key_prefix, key_hash = custom_key, f"{custom_key[:4]}…", hash_api_key(custom_key)
    else:
        raw_key, key_prefix, key_hash = generate_api_key()

    record = current_app.extensions["api_key_service"].bootstrap_api_key(
        user_id=g.principal["userId"],
        name=label,
        key_prefix=key_prefix,
        key_hash=key_hash,
    )
    if record is None:
        return (
            jsonify(
                {
                    "error": (
                        "Workspace API access has already been initialized. "
                        "Manage additional keys inside the API Access tab."
                    )
                }
            ),
            409,
        )
    return jsonify({"key": record, "rawKey": raw_key}), 201


@auth_bp.get("/auth/me")
@require_api_auth
def current_session():
    return jsonify({"authenticated": True, "principal": g.principal})
