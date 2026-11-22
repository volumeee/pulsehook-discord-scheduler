"""Flask route blueprints registration."""

from __future__ import annotations

from flask import Flask

from app.routes.auth import auth_bp
from app.routes.health_routes import health_bp
from app.routes.key_routes import key_bp
from app.routes.log_routes import log_bp
from app.routes.task_routes import task_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(task_bp, url_prefix="/api")
    app.register_blueprint(log_bp, url_prefix="/api")
    app.register_blueprint(key_bp, url_prefix="/api")
