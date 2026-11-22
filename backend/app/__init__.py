"""Flask Application Factory for PulseHook Discord Webhook Scheduler."""

from __future__ import annotations

import atexit
import logging
from typing import Any
from urllib.parse import urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

from app.config import Settings, load_settings
from app.extensions import create_db_engine, create_session_factory
from app.routes import register_blueprints
from app.routes.http_helpers import BadRequestError, format_validation_error
from app.services.api_key_service import ApiKeyService
from app.services.auth import AuthService, AuthServiceError
from app.services.email import ResendEmailService
from app.services.executor import SendWebhookFn, SleepFn, TaskExecutor
from app.services.log_service import LogService
from app.services.qstash_scheduler import QStashSchedulerService
from app.services.scheduler import TaskSchedulerService
from app.services.security import SlidingWindowRateLimiter
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)


def _build_allowed_origins(settings: Settings) -> list[str]:
    origins = [
        origin.strip().rstrip("/")
        for origin in settings.cors_origins.split(",")
        if origin.strip() and origin.strip() != "*"
    ]
    if settings.app_base_url:
        parsed = urlparse(settings.app_base_url)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            canonical = f"{parsed.scheme}://{parsed.netloc}"
            if canonical not in origins:
                origins.append(canonical)
    return origins


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(BadRequestError)
    def handle_bad_request(err: BadRequestError):
        return jsonify({"error": str(err)}), 400

    @app.errorhandler(ValidationError)
    def handle_validation_error(err: ValidationError):
        payload, code = format_validation_error(err)
        return jsonify(payload), code

    @app.errorhandler(AuthServiceError)
    def handle_auth_error(err: AuthServiceError):
        return jsonify({"error": str(err), **err.extra}), err.status_code

    @app.errorhandler(404)
    def handle_not_found(_err):
        return jsonify({"error": "Endpoint not found."}), 404

    @app.errorhandler(500)
    def handle_server_error(err):
        logger.error("Unhandled backend exception: %s", err, exc_info=err)
        return jsonify({"error": "An unexpected server error occurred."}), 500


def create_app(
    config_overrides: dict[str, Any] | None = None,
    *,
    send_webhook_fn: SendWebhookFn | None = None,
    sleep_fn: SleepFn | None = None,
    email_service: ResendEmailService | None = None,
) -> Flask:
    """Build and wire the modular Flask application."""
    settings = load_settings(config_overrides)
    if settings.enable_scheduler and not settings.qstash_token and settings.gunicorn_workers > 1:
        raise RuntimeError("The in-process scheduler requires a single Gunicorn worker.")

    app = Flask(__name__)
    app.config["API_KEY"] = settings.api_key
    app.config["API_KEY_USER_ID"] = settings.api_key_owner_id
    app.config["FLASK_ENV"] = settings.flask_env
    app.config["APP_BASE_URL"] = settings.app_base_url
    app.config["ALLOW_REGISTRATION"] = settings.allow_registration
    app.config["ALLOWED_ORIGINS"] = _build_allowed_origins(settings)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["ALLOWED_ORIGINS"]}},
        supports_credentials=True,
        always_send=False,
        allow_headers=["Content-Type", "X-API-Key", "Authorization", "X-Requested-With"],
    )

    engine = create_db_engine(settings.database_url)
    session_factory = create_session_factory(engine)
    task_service = TaskService(session_factory)
    log_service = LogService(session_factory, task_service)
    api_key_service = ApiKeyService(session_factory)
    resolved_email_service = email_service or ResendEmailService(
        api_key=settings.resend_api_key, sender=settings.resend_from
    )
    auth_service = AuthService(
        session_factory, resolved_email_service, token_secret=settings.auth_token_secret
    )
    rate_limiter = SlidingWindowRateLimiter(enabled=settings.enable_rate_limit)
    executor = TaskExecutor(
        session_factory,
        send_fn=send_webhook_fn,
        sleep_fn=sleep_fn,
        timeout_seconds=settings.discord_timeout_seconds,
    )

    def _run_scheduled_task(task_id: int) -> None:
        try:
            task = task_service.get_task_for_scheduler(task_id)
            if task and task["status"] == "active":
                executor.execute_by_id(task_id)
        except Exception:
            logger.exception("Scheduled execution failed for task #%s", task_id)
        finally:
            task = task_service.get_task_for_scheduler(task_id)
            if not task or task["status"] != "active":
                scheduler.unschedule_task(task_id)

    scheduler: QStashSchedulerService | TaskSchedulerService = (
        QStashSchedulerService(
            session_factory=session_factory,
            qstash_url=settings.qstash_url,
            qstash_token=settings.qstash_token,
            max_retries=settings.qstash_max_retries,
            log_sync_ttl_seconds=settings.qstash_log_sync_ttl_seconds,
        )
        if settings.qstash_token
        else TaskSchedulerService(on_trigger=_run_scheduled_task)
    )

    app.extensions.update(
        {
            "engine": engine,
            "session_factory": session_factory,
            "task_service": task_service,
            "log_service": log_service,
            "api_key_service": api_key_service,
            "email_service": resolved_email_service,
            "auth_service": auth_service,
            "rate_limiter": rate_limiter,
            "executor": executor,
            "scheduler": scheduler,
        }
    )

    register_blueprints(app)
    _register_error_handlers(app)

    @app.after_request
    def apply_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if request.path.startswith("/api/auth"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
        return response

    if settings.enable_scheduler:
        scheduler.start()
        try:
            existing_tasks = task_service.list_tasks_for_scheduler(refresh_next_run=True)
            synced = scheduler.sync_tasks(existing_tasks)
            keepalive_url = settings.vps_keepalive_url or (
                f"{settings.app_base_url}/api/health" if settings.app_base_url else None
            )
            if settings.vps_keepalive_cron and keepalive_url:
                scheduler.ensure_keepalive(
                    health_url=keepalive_url,
                    cron=settings.vps_keepalive_cron,
                    bearer_token=settings.vps_keepalive_bearer_token,
                )
            logger.info(
                "PulseHook scheduler (%s) started with %d active cron job(s).",
                scheduler.backend_name,
                synced,
            )
        except Exception:
            logger.warning("Initial scheduler sync skipped (database migrations may still be pending).")
        atexit.register(scheduler.shutdown)

    return app
