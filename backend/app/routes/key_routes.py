"""API key management routes (list, generate, revoke)."""

from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify

from app.middleware.auth import require_api_auth
from app.routes.http_helpers import parse_json_body
from app.schemas.auth_schema import CreateApiKeySchema
from app.services.api_key_service import generate_api_key

key_bp = Blueprint("keys", __name__)


@key_bp.get("/keys")
@require_api_auth
def list_api_keys():
    return jsonify(
        {"data": current_app.extensions["api_key_service"].list_api_keys(user_id=g.principal["userId"])}
    )


@key_bp.post("/keys")
@require_api_auth
def create_api_key():
    validated = parse_json_body(CreateApiKeySchema, allow_empty=True)
    raw_key, key_prefix, key_hash = generate_api_key()
    created = current_app.extensions["api_key_service"].create_api_key(
        user_id=g.principal["userId"],
        name=validated.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
    )
    return jsonify({"data": created, "rawKey": raw_key}), 201


@key_bp.delete("/keys/<int:key_id>")
@require_api_auth
def revoke_api_key(key_id: int):
    deleted = current_app.extensions["api_key_service"].delete_api_key(
        key_id, user_id=g.principal["userId"]
    )
    if not deleted:
        return jsonify({"error": f"API key #{key_id} was not found."}), 404
    return jsonify({"deleted": True, "id": key_id})
