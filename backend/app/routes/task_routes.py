"""Scheduled Discord Webhook Tasks CRUD, duplication, sample seeding, and manual Run Now routes."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, g, jsonify, request

from app.middleware.auth import require_api_auth
from app.routes.http_helpers import parse_json_body
from app.schemas.task_schema import CreateTaskSchema, UpdateTaskSchema

task_bp = Blueprint("tasks", __name__)


def _sync_task_schedule(task: dict[str, Any]) -> None:
    scheduler = current_app.extensions["scheduler"]
    if task["status"] == "active":
        scheduler.schedule_task(
            task_id=task["id"],
            name=task["name"],
            schedule=task["schedule"],
            status=task["status"],
            webhook_url=task["webhookUrl"],
            payload=task["payload"],
            max_retry=task["maxRetry"],
        )
    else:
        scheduler.unschedule_task(task["id"])


@task_bp.get("/tasks")
@require_api_auth
def list_tasks():
    current_app.extensions["scheduler"].sync_logs()
    items = current_app.extensions["task_service"].list_tasks(
        user_id=g.principal["userId"],
        status=request.args.get("status"),
        search=request.args.get("search"),
    )
    return jsonify({"data": items})


@task_bp.post("/tasks")
@require_api_auth
def create_task():
    validated = parse_json_body(CreateTaskSchema)
    created = current_app.extensions["task_service"].create_task(
        validated, user_id=g.principal["userId"]
    )
    if created["status"] == "active":
        _sync_task_schedule(created)
    return jsonify({"data": created}), 201


@task_bp.post("/tasks/seed-samples")
@require_api_auth
def seed_sample_tasks():
    created = current_app.extensions["task_service"].seed_sample_tasks(
        user_id=g.principal["userId"]
    )
    return jsonify({"data": created}), 201


@task_bp.get("/tasks/<int:task_id>")
@require_api_auth
def get_task(task_id: int):
    current_app.extensions["scheduler"].sync_logs()
    task = current_app.extensions["task_service"].get_task(
        task_id, user_id=g.principal["userId"]
    )
    if task is None:
        return jsonify({"error": f"Task #{task_id} was not found."}), 404
    logs = current_app.extensions["log_service"].list_logs(
        user_id=g.principal["userId"], task_id=task_id, limit=25
    )
    return jsonify({"data": task, "logs": logs})


@task_bp.route("/tasks/<int:task_id>", methods=["PUT", "PATCH"])
@require_api_auth
def update_task(task_id: int):
    validated = parse_json_body(UpdateTaskSchema)
    updated = current_app.extensions["task_service"].update_task(
        task_id, validated, user_id=g.principal["userId"]
    )
    if updated is None:
        return jsonify({"error": f"Task #{task_id} was not found."}), 404
    _sync_task_schedule(updated)
    return jsonify({"data": updated})


@task_bp.delete("/tasks/<int:task_id>")
@require_api_auth
def delete_task(task_id: int):
    deleted = current_app.extensions["task_service"].delete_task(
        task_id, user_id=g.principal["userId"]
    )
    if not deleted:
        return jsonify({"error": f"Task #{task_id} was not found."}), 404
    current_app.extensions["scheduler"].unschedule_task(task_id)
    return jsonify({"deleted": True, "id": task_id})


@task_bp.post("/tasks/<int:task_id>/duplicate")
@require_api_auth
def duplicate_task(task_id: int):
    clone = current_app.extensions["task_service"].duplicate_task(
        task_id, user_id=g.principal["userId"]
    )
    if clone is None:
        return jsonify({"error": f"Task #{task_id} was not found."}), 404
    return jsonify({"data": clone}), 201


@task_bp.post("/tasks/<int:task_id>/run")
@require_api_auth
def run_task_now(task_id: int):
    outcome = current_app.extensions["executor"].execute_by_id(
        task_id,
        preserve_paused_status=True,
        user_id=g.principal["userId"],
        max_retry_cap=2,
        max_wall_seconds=25.0,
    )
    if outcome is None:
        return jsonify({"error": f"Task #{task_id} was not found."}), 404

    refreshed = current_app.extensions["task_service"].get_task(
        task_id, user_id=g.principal["userId"]
    )
    if refreshed is not None:
        _sync_task_schedule(refreshed)
    return jsonify({"outcome": outcome.to_dict(), "task": refreshed})
