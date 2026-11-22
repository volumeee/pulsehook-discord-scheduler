"""Public health check blueprint for container orchestration and keep-alive pings."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from app.extensions import utc_now

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    scheduler = current_app.extensions.get("scheduler")
    scheduler_name = getattr(scheduler, "backend_name", "unknown")
    try:
        with current_app.extensions["engine"].connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return (
            jsonify(
                {
                    "status": "degraded",
                    "service": "pulsehook-flask-api",
                    "database": "unreachable",
                    "scheduler": scheduler_name,
                    "timestamp": utc_now().isoformat(),
                }
            ),
            503,
        )

    return jsonify(
        {
            "status": "ok",
            "service": "pulsehook-flask-api",
            "database": "ok",
            "scheduler": scheduler_name,
            "timestamp": utc_now().isoformat(),
        }
    )
