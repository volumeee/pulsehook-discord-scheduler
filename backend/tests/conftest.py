"""Shared pytest fixtures for PulseHook Flask backend unit tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure backend/ is importable as root package
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app
from app.extensions import Base
from app.models.user import User
from app.services.discord_client import DiscordDispatchResult

VALID_DISCORD_WEBHOOK = (
    "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz123456"
)


@pytest.fixture()
def test_api_key() -> str:
    return "test-pulsehook-api-key-998877"


@pytest.fixture()
def app_factory(tmp_path: Path, test_api_key: str):
    """Create isolated Flask app instances backed by a temporary SQLite DB with mocked webhook sender."""

    def _make_app(
        *,
        api_key: str | None = test_api_key,
        send_webhook_fn=None,
        sleep_fn=None,
        enable_scheduler: bool = False,
        email_service=None,
        app_base_url: str | None = None,
        cors_origins: str | None = None,
        allow_registration: bool | None = None,
        flask_env: str = "testing",
    ):
        db_file = tmp_path / "pulsehook_test.db"
        default_sender = send_webhook_fn or (
            lambda _url, _payload: DiscordDispatchResult(
                ok=True,
                http_status=204,
                duration_ms=42,
                message="Delivered to Discord webhook (HTTP 204)",
            )
        )
        app = create_app(
            config_overrides={
                "FLASK_ENV": flask_env,
                "DATABASE_URL": f"sqlite:///{db_file}",
                "API_KEY": api_key,
                "API_KEY_USER_ID": "1" if api_key else None,
                "ENABLE_SCHEDULER": enable_scheduler,
                "APP_BASE_URL": app_base_url,
                **({"CORS_ORIGINS": cors_origins} if cors_origins is not None else {}),
                **(
                    {"ALLOW_REGISTRATION": allow_registration}
                    if allow_registration is not None
                    else {}
                ),
            },
            send_webhook_fn=default_sender,
            sleep_fn=sleep_fn or (lambda _sec: None),
            email_service=email_service,
        )
        engine = app.extensions["engine"]
        Base.metadata.create_all(engine)
        if api_key:
            with app.extensions["session_factory"]() as db:
                if db.get(User, 1) is None:
                    db.add(
                        User(
                            id=1,
                            username="fixture_owner",
                            username_lower="fixture_owner",
                            email="fixture@example.test",
                            password_hash="unused",
                            is_email_verified=True,
                        )
                    )
                    db.commit()
        return app

    return _make_app


@pytest.fixture()
def client(app_factory):
    app = app_factory()
    return app.test_client()


@pytest.fixture()
def auth_headers(test_api_key: str) -> dict[str, str]:
    return {"X-API-Key": test_api_key}
