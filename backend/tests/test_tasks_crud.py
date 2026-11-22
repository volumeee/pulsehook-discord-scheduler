"""Unit tests covering Task CRUD endpoints, validation, duplication, and manual Run Now."""

from __future__ import annotations

from tests.conftest import VALID_DISCORD_WEBHOOK


def test_task_crud_lifecycle_and_run_now(app_factory, auth_headers):
    app = app_factory()
    client = app.test_client()
    scheduler = app.extensions["scheduler"]

    # 1. CREATE
    create_resp = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={
            "name": "Morning Standup Ping",
            "schedule": "0 9 * * 1-5",
            "webhookUrl": VALID_DISCORD_WEBHOOK,
            "maxRetry": 3,
            "payload": {
                "content": "Task executed successfully!",
                "username": "Task Bot",
                "embeds": [
                    {
                        "title": "Task Completed",
                        "description": "Task #123 has been completed",
                        "color": 3066993,
                    }
                ],
            },
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.get_json()["data"]
    task_id = created["id"]
    assert created["name"] == "Morning Standup Ping"
    assert created["status"] == "active"
    assert scheduler.is_scheduled(task_id) is True

    # 2. LIST
    list_resp = client.get("/api/tasks", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.get_json()["data"]) == 1

    # 3. GET single task
    get_resp = client.get(f"/api/tasks/{task_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.get_json()["data"]["id"] == task_id

    # 4. UPDATE (pause removes job from scheduler)
    patch_resp = client.patch(
        f"/api/tasks/{task_id}",
        headers=auth_headers,
        json={"name": "Updated Standup Ping", "status": "paused", "maxRetry": 5},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.get_json()["data"]
    assert updated["name"] == "Updated Standup Ping"
    assert updated["maxRetry"] == 5
    assert updated["status"] == "paused"
    assert scheduler.is_scheduled(task_id) is False

    # 5. RUN NOW triggers mocked Discord webhook and persists log
    run_resp = client.post(f"/api/tasks/{task_id}/run", headers=auth_headers)
    assert run_resp.status_code == 200
    run_json = run_resp.get_json()
    assert run_json["outcome"]["succeeded"] is True
    assert run_json["outcome"]["httpStatus"] == 204

    logs_resp = client.get(f"/api/logs?taskId={task_id}", headers=auth_headers)
    assert logs_resp.status_code == 200
    assert len(logs_resp.get_json()["data"]) == 1

    # 6. DUPLICATE creates paused clone
    dup_resp = client.post(f"/api/tasks/{task_id}/duplicate", headers=auth_headers)
    assert dup_resp.status_code == 201
    assert dup_resp.get_json()["data"]["status"] == "paused"

    # 7. Reject invalid SSRF webhook URL
    bad_resp = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={
            "name": "SSRF Attempt",
            "schedule": "* * * * *",
            "webhookUrl": "http://127.0.0.1:5001/api/health",
            "payload": {"content": "Should be rejected"},
        },
    )
    assert bad_resp.status_code == 400

    # 8. DELETE removes task cleanly
    del_resp = client.delete(f"/api/tasks/{task_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert client.get(f"/api/tasks/{task_id}", headers=auth_headers).status_code == 404
