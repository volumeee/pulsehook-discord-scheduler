"""Account and automation-key isolation across tasks, logs, dashboard, and keys."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from app.models.task_log import TaskLog
from app.models.user import User
from app.services.discord_client import DiscordDispatchResult
from app.services.security import ACCESS_COOKIE_NAME
from tests.conftest import VALID_DISCORD_WEBHOOK

CSRF_HEADERS = {"X-Requested-With": "PulseHook", "Origin": "https://localhost:3000"}
BASE_URL = "https://localhost:3000"


def _account_client(app, username):
    auth_service = app.extensions["auth_service"]
    with app.extensions["session_factory"]() as db:
        user = User(
            username=username,
            username_lower=username,
            email=f"{username}@example.com",
            password_hash="unused",
            is_email_verified=True,
        )
        db.add(user)
        db.flush()
        _, access_token, _ = auth_service._mint_session_pair(
            db=db, user=user, now=datetime.now(UTC)
        )
        db.commit()
    client = app.test_client()
    client.set_cookie(ACCESS_COOKIE_NAME, access_token)
    return client


def _create_task(client, name, webhook_url):
    response = client.post(
        "/api/tasks",
        base_url=BASE_URL,
        headers=CSRF_HEADERS,
        json={
            "name": name,
            "schedule": "0 * * * *",
            "webhookUrl": webhook_url,
            "payload": {"content": name},
        },
    )
    assert response.status_code == 201
    return response.get_json()["data"]


def _create_key(client, name):
    response = client.post(
        "/api/keys", base_url=BASE_URL, headers=CSRF_HEADERS, json={"name": name}
    )
    assert response.status_code == 201
    return response.get_json()


def test_accounts_and_automation_keys_cannot_access_other_accounts(app_factory):
    app = app_factory(api_key=None)
    alice = _account_client(app, "alice")
    bob = _account_client(app, "bob")
    alice_task = _create_task(alice, "Alice task", VALID_DISCORD_WEBHOOK)
    bob_url = VALID_DISCORD_WEBHOOK.replace(
        "abcdefghijklmnopqrstuvwxyz123456", "zyxwvutsrqponmlkjihgfedcba654321"
    )
    bob_task = _create_task(bob, "Bob private task", bob_url)
    alice_key = _create_key(alice, "Alice automation")
    bob_key = _create_key(bob, "Bob automation")

    for client, task in ((alice, alice_task), (bob, bob_task)):
        run = client.post(f"/api/tasks/{task['id']}/run", base_url=BASE_URL, headers=CSRF_HEADERS)
        assert run.status_code == 200
        assert run.get_json()["outcome"]["succeeded"] is True

    task_list = alice.get("/api/tasks", base_url=BASE_URL).get_json()["data"]
    assert [task["id"] for task in task_list] == [alice_task["id"]]
    assert bob_url not in str(task_list)
    assert alice.get(f"/api/tasks/{bob_task['id']}", base_url=BASE_URL).status_code == 404
    assert (
        alice.patch(
            f"/api/tasks/{bob_task['id']}",
            base_url=BASE_URL,
            headers=CSRF_HEADERS,
            json={"status": "paused"},
        ).status_code
        == 404
    )
    assert (
        alice.post(
            f"/api/tasks/{bob_task['id']}/duplicate", base_url=BASE_URL, headers=CSRF_HEADERS
        ).status_code
        == 404
    )
    assert (
        alice.post(
            f"/api/tasks/{bob_task['id']}/run", base_url=BASE_URL, headers=CSRF_HEADERS
        ).status_code
        == 404
    )
    assert (
        alice.delete(
            f"/api/tasks/{bob_task['id']}", base_url=BASE_URL, headers=CSRF_HEADERS
        ).status_code
        == 404
    )
    assert app.extensions["scheduler"].is_scheduled(bob_task["id"])

    logs = alice.get("/api/logs", base_url=BASE_URL).get_json()["data"]
    assert [log["taskId"] for log in logs] == [alice_task["id"]]
    assert (
        alice.get(f"/api/logs?taskId={bob_task['id']}", base_url=BASE_URL).get_json()["data"] == []
    )
    summary = alice.get("/api/dashboard/summary", base_url=BASE_URL).get_json()
    assert summary["totalTasks"] == 1
    assert summary["totalExecutions"] == 1
    assert summary["successfulExecutions"] == 1
    assert [log["taskId"] for log in summary["recentLogs"]] == [alice_task["id"]]
    assert bob_url not in str(summary)

    alice_keys = alice.get("/api/keys", base_url=BASE_URL).get_json()["data"]
    assert [key["id"] for key in alice_keys] == [alice_key["data"]["id"]]
    assert (
        alice.delete(
            f"/api/keys/{bob_key['data']['id']}", base_url=BASE_URL, headers=CSRF_HEADERS
        ).status_code
        == 404
    )

    alice_headers = {"X-API-Key": alice_key["rawKey"]}
    bob_headers = {"X-API-Key": bob_key["rawKey"]}
    assert [
        task["id"]
        for task in alice.get("/api/tasks", base_url=BASE_URL, headers=alice_headers).get_json()[
            "data"
        ]
    ] == [alice_task["id"]]
    assert (
        alice.post(
            f"/api/tasks/{bob_task['id']}/run", base_url=BASE_URL, headers=alice_headers
        ).status_code
        == 404
    )
    assert [
        task["id"]
        for task in alice.get("/api/tasks", base_url=BASE_URL, headers=bob_headers).get_json()[
            "data"
        ]
    ] == [bob_task["id"]]
    assert bob.get("/api/keys", base_url=BASE_URL, headers=bob_headers).status_code == 200

    duplicate = alice.post(
        f"/api/tasks/{alice_task['id']}/duplicate", base_url=BASE_URL, headers=alice_headers
    )
    assert duplicate.status_code == 201
    samples = alice.post("/api/tasks/seed-samples", base_url=BASE_URL, headers=alice_headers)
    assert samples.status_code == 201
    assert (
        len(alice.get("/api/tasks", base_url=BASE_URL, headers=alice_headers).get_json()["data"])
        == 5
    )
    assert (
        len(bob.get("/api/tasks", base_url=BASE_URL, headers=bob_headers).get_json()["data"]) == 1
    )
    assert len(app.extensions["task_service"].list_tasks_for_scheduler()) == 6
    assert (
        app.extensions["task_service"].get_task_for_scheduler(bob_task["id"])["id"]
        == bob_task["id"]
    )

    with app.extensions["session_factory"]() as db:
        alice_user = db.execute(select(User).where(User.username_lower == "alice")).scalar_one()
        alice_user.is_email_verified = False
        db.commit()
    assert alice.get("/api/tasks", base_url=BASE_URL, headers=alice_headers).status_code == 401
    assert bob.get("/api/tasks", base_url=BASE_URL, headers=bob_headers).status_code == 200


def test_extra_discord_payload_fields_survive_save_update_and_dispatch(app_factory):
    sent_payloads = []

    def send_webhook(url, payload):
        sent_payloads.append(payload)
        return DiscordDispatchResult(ok=True, http_status=204, duration_ms=1, message="sent")

    app = app_factory(api_key=None, send_webhook_fn=send_webhook)
    client = _account_client(app, "alice")
    payload = {
        "content": "Initial message",
        "flags": 4096,
        "allowed_mentions": {"parse": [], "replied_user": False},
        "embeds": [
            {
                "title": "Title",
                "author": {"name": "Author", "url": "https://example.com"},
                "image": {"url": "https://example.com/image.png"},
                "footer": {"text": "Footer", "proxy_icon_url": "https://example.com/icon.png"},
                "fields": [{"name": "Field", "value": "Value", "extension": None}],
            }
        ],
    }
    create = client.post(
        "/api/tasks",
        base_url=BASE_URL,
        headers=CSRF_HEADERS,
        json={
            "name": "Webhook",
            "schedule": "0 * * * *",
            "webhookUrl": VALID_DISCORD_WEBHOOK,
            "payload": payload,
        },
    )
    assert create.status_code == 201
    task = create.get_json()["data"]
    assert task["payload"] == payload

    payload["content"] = "Updated message"
    payload["embeds"][0]["author"]["name"] = "Updated author"
    update = client.patch(
        f"/api/tasks/{task['id']}",
        base_url=BASE_URL,
        headers=CSRF_HEADERS,
        json={"payload": payload},
    )
    assert update.status_code == 200
    assert update.get_json()["data"]["payload"] == payload
    assert (
        client.get(f"/api/tasks/{task['id']}", base_url=BASE_URL).get_json()["data"]["payload"]
        == payload
    )
    duplicate = client.post(
        f"/api/tasks/{task['id']}/duplicate", base_url=BASE_URL, headers=CSRF_HEADERS
    )
    assert duplicate.get_json()["data"]["payload"] == payload
    run = client.post(f"/api/tasks/{task['id']}/run", base_url=BASE_URL, headers=CSRF_HEADERS)
    assert run.status_code == 200
    assert sent_payloads == [payload]


def test_filtered_logs_paginate_and_compute_metrics_before_pagination(app_factory):
    app = app_factory(api_key=None)
    alice = _account_client(app, "alice")
    bob = _account_client(app, "bob")
    alice_task = _create_task(alice, "Reports", VALID_DISCORD_WEBHOOK)
    bob_task = _create_task(bob, "Reports private", VALID_DISCORD_WEBHOOK)
    with app.extensions["session_factory"]() as db:
        db.add_all(
            [
                TaskLog(
                    task_id=alice_task["id"],
                    status="success",
                    duration_ms=100,
                    http_status=204,
                    message="Delivered",
                ),
                TaskLog(
                    task_id=alice_task["id"],
                    status="failed",
                    duration_ms=200,
                    http_status=503,
                    message="Unavailable",
                ),
                TaskLog(
                    task_id=alice_task["id"],
                    status="retrying",
                    duration_ms=300,
                    http_status=503,
                    message="Retrying",
                ),
                TaskLog(
                    task_id=bob_task["id"],
                    status="success",
                    duration_ms=999,
                    http_status=204,
                    message="Bob private",
                ),
            ]
        )
        db.commit()

    page = alice.get("/api/logs?limit=1&page=2&search=reports", base_url=BASE_URL).get_json()
    assert len(page["data"]) == 1
    assert page["meta"] == {
        "page": 2,
        "limit": 1,
        "total": 3,
        "totalPages": 3,
        "metrics": {"total": 3, "success": 1, "failed": 1, "retrying": 1, "avgDurationMs": 200},
    }
    assert page["data"][0]["taskId"] == alice_task["id"]
    filtered = alice.get("/api/logs?search=503&status=failed", base_url=BASE_URL).get_json()
    assert filtered["meta"]["metrics"] == {
        "total": 1,
        "success": 0,
        "failed": 1,
        "retrying": 0,
        "avgDurationMs": 200,
    }
    assert filtered["data"][0]["message"] == "Unavailable"
    assert alice.get("/api/logs?search=Bob", base_url=BASE_URL).get_json()["meta"]["total"] == 0
    assert alice.get("/api/logs?search=100%25", base_url=BASE_URL).get_json()["meta"]["total"] == 0
    last = alice.get("/api/logs?limit=2&page=99", base_url=BASE_URL).get_json()
    assert last["meta"]["page"] == 2
    assert last["meta"]["totalPages"] == 2
    empty = alice.get("/api/logs?search=missing&page=99", base_url=BASE_URL).get_json()
    assert empty["data"] == []
    assert empty["meta"]["page"] == empty["meta"]["totalPages"] == 1
    assert alice.get("/api/logs?page=0", base_url=BASE_URL).status_code == 400


def test_random_and_impossible_cron_schedules_are_rejected(app_factory):
    app = app_factory(api_key=None)
    client = _account_client(app, "alice")
    task = _create_task(client, "Cron task", VALID_DISCORD_WEBHOOK)
    for schedule in ("R * * * *", "r(1-5) * * * *", "0 0 31 2 *"):
        response = client.patch(
            f"/api/tasks/{task['id']}",
            base_url=BASE_URL,
            headers=CSRF_HEADERS,
            json={"schedule": schedule},
        )
        assert response.status_code == 400
    valid = client.patch(
        f"/api/tasks/{task['id']}",
        base_url=BASE_URL,
        headers=CSRF_HEADERS,
        json={"schedule": "0 0 1 mar *"},
    )
    assert valid.status_code == 200
