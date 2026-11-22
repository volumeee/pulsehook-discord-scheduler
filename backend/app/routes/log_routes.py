"""Execution logs query and dashboard summary routes."""

from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_api_auth

log_bp = Blueprint("logs", __name__)


def _parse_int_arg(raw: str | None) -> int | None:
    if raw is None:
        return None
    try:
        return int(raw.strip())
    except ValueError:
        return None


@log_bp.get("/dashboard/summary")
@require_api_auth
def dashboard_summary():
    current_app.extensions["scheduler"].sync_logs()
    return jsonify(
        current_app.extensions["log_service"].get_dashboard_summary(
            user_id=g.principal["userId"]
        )
    )


@log_bp.get("/logs")
@require_api_auth
def list_logs():
    current_app.extensions["scheduler"].sync_logs()

    raw_task_id = request.args.get("taskId")
    task_id = _parse_int_arg(raw_task_id) if raw_task_id else None
    if raw_task_id and task_id is None:
        return jsonify({"error": "taskId must be an integer."}), 400

    page = _parse_int_arg(request.args.get("page", "1"))
    if page is None or page < 1:
        return jsonify({"error": "page must be a positive integer."}), 400

    limit = _parse_int_arg(request.args.get("limit", "100")) or 100
    result = current_app.extensions["log_service"].query_logs(
        user_id=g.principal["userId"],
        task_id=task_id,
        status=request.args.get("status"),
        search=request.args.get("search"),
        page=page,
        limit=limit,
    )
    return jsonify(result)
