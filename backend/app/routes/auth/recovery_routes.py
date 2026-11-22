"""Password recovery routes (forgot password, reset token validation, password reset)."""

from __future__ import annotations

from flask import current_app, jsonify, make_response, request

from app.routes.auth import auth_bp
from app.routes.http_helpers import (
    allow_local_origin,
    client_ip,
    enforce_rate_limit,
    parse_json_body,
)
from app.schemas.auth_schema import (
    ForgotPasswordSchema,
    ResetPasswordSchema,
    ValidateResetTokenSchema,
)
from app.services.security import clear_auth_cookies, resolve_safe_app_base_url


@auth_bp.post("/auth/forgot-password")
def forgot_password():
    if limited := enforce_rate_limit("forgot_password", limit=8, window_seconds=300):
        return limited

    validated = parse_json_body(ForgotPasswordSchema)
    app_base_url = resolve_safe_app_base_url(
        request,
        configured_base_url=current_app.config.get("APP_BASE_URL"),
        allowed_origins=current_app.config.get("ALLOWED_ORIGINS", []),
        allow_local=allow_local_origin(),
    )
    result = current_app.extensions["auth_service"].request_password_reset(
        identifier=validated.identifier,
        app_base_url=app_base_url,
        user_agent=request.headers.get("User-Agent"),
        requested_ip=client_ip(),
    )
    return jsonify(result), 200


@auth_bp.post("/auth/reset-password/validate")
def validate_reset_token():
    if limited := enforce_rate_limit("validate_reset", limit=20, window_seconds=300):
        return limited

    validated = parse_json_body(ValidateResetTokenSchema)
    result = current_app.extensions["auth_service"].validate_password_reset_token(validated.token)
    return jsonify(result), 200


@auth_bp.post("/auth/reset-password")
def reset_password():
    if limited := enforce_rate_limit("reset_password", limit=10, window_seconds=300):
        return limited

    validated = parse_json_body(ResetPasswordSchema)
    result = current_app.extensions["auth_service"].reset_password_with_token(
        raw_token=validated.token,
        new_password=validated.newPassword,
    )
    return clear_auth_cookies(make_response(jsonify(result), 200))
