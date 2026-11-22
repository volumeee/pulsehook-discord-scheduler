"""Unit tests for mocked Discord Webhook HTTP POST handling and SSRF URL blocking."""

from __future__ import annotations

import requests

from app.services.discord_client import send_discord_webhook
from tests.conftest import VALID_DISCORD_WEBHOOK


class _DummyResponse:
    def __init__(
        self,
        status_code: int,
        *,
        json_body=None,
        text: str = "",
        reason: str = "",
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self._json_body = json_body
        self.text = text
        self.reason = reason
        self.headers = headers or {}

    def json(self):
        if self._json_body is None:
            raise ValueError("No JSON body")
        return self._json_body


def test_discord_webhook_posts_json_and_handles_204():
    captured = {}

    def fake_post(url, *, json, headers, timeout, allow_redirects):
        assert allow_redirects is False
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        captured["timeout"] = timeout
        return _DummyResponse(204)

    payload = {
        "content": "Task executed successfully!",
        "username": "Task Bot",
        "embeds": [
            {
                "title": "Task Completed",
                "description": "Task #123 has been completed",
                "color": 3066993,
            }
        ],
    }

    res = send_discord_webhook(VALID_DISCORD_WEBHOOK, payload, post_fn=fake_post)
    assert res.ok is True
    assert res.http_status == 204
    assert captured["url"] == VALID_DISCORD_WEBHOOK
    assert captured["json"]["username"] == "Task Bot"
    assert captured["json"]["embeds"][0]["color"] == 3066993


def test_discord_webhook_parses_429_rate_limit():
    def rate_limited_post(*_args, **_kwargs):
        return _DummyResponse(
            429,
            json_body={"message": "You are being rate limited.", "code": 0},
            headers={"Retry-After": "2.5"},
        )

    res = send_discord_webhook(
        VALID_DISCORD_WEBHOOK, {"content": "Burst"}, post_fn=rate_limited_post
    )
    assert res.ok is False
    assert res.http_status == 429
    assert res.retry_after_ms == 2500
    assert "rate limited" in res.message.lower()


def test_discord_webhook_blocks_non_discord_and_ssrf_urls():
    called = {"count": 0}

    def should_not_call(*_args, **_kwargs):
        called["count"] += 1
        return _DummyResponse(204)

    blocked = [
        "http://127.0.0.1:5001/api/tasks",
        "http://169.254.169.254/latest/meta-data/",
        "https://evil.example.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
        "http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    ]
    for bad_url in blocked:
        res = send_discord_webhook(bad_url, {"content": "x"}, post_fn=should_not_call)
        assert res.ok is False
        assert res.http_status is None

    assert called["count"] == 0


def test_discord_webhook_handles_timeout_cleanly():
    def timeout_post(*_args, **_kwargs):
        raise requests.Timeout("Read timed out")

    res = send_discord_webhook(
        VALID_DISCORD_WEBHOOK, {"content": "Ping"}, timeout_seconds=2.0, post_fn=timeout_post
    )
    assert res.ok is False
    assert res.http_status is None
    assert "timed out" in res.message.lower()
