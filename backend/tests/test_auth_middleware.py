"""Unit tests for API authentication middleware (X-API-Key, Bearer token, DB hashed keys)."""

from __future__ import annotations

from app.services.api_key_service import generate_api_key


def test_rejects_public_unauthenticated_requests(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 401
    assert "Unauthorized" in resp.get_json()["error"]


def test_accepts_valid_env_api_key_and_rejects_invalid(client, test_api_key):
    ok_resp = client.get("/api/tasks", headers={"X-API-Key": test_api_key})
    assert ok_resp.status_code == 200

    bearer_resp = client.get("/api/tasks", headers={"Authorization": f"Bearer {test_api_key}"})
    assert bearer_resp.status_code == 200

    bad_resp = client.get("/api/tasks", headers={"X-API-Key": "wrong-key"})
    assert bad_resp.status_code == 401


def test_verifies_hashed_database_api_keys_and_bootstrap_lock(app_factory, monkeypatch):
    app = app_factory()
    app.config["API_KEY"] = None
    client = app.test_client()

    assert client.post("/api/auth/bootstrap", json={"name": "Hijack"}).status_code == 401
    status_json = client.get("/api/auth/status").get_json()
    assert "needsBootstrapKey" not in status_json
    assert "hasEnvApiKey" not in status_json

    monkeypatch.setattr(
        app.extensions["auth_service"],
        "verify_access_token_cookie",
        lambda _token: {"method": "cookie", "userId": 1},
    )
    client.set_cookie("ph_access", "test-session")
    headers = {"X-Requested-With": "PulseHook"}
    assert (
        client.post("/api/auth/bootstrap", json=["not-a-dict"], headers=headers).status_code == 400
    )
    boot_resp = client.post(
        "/api/auth/bootstrap",
        json={"name": "Evaluation Key", "customKey": "my-super-secret-custom-key-9999"},
        headers=headers,
    )
    assert boot_resp.status_code == 201
    boot_data = boot_resp.get_json()
    raw_key = boot_data["rawKey"]
    assert boot_data["key"]["keyPrefix"] == "my-s…"
    assert (
        client.post("/api/auth/bootstrap", json={"name": "Again"}, headers=headers).status_code
        == 409
    )
    client.delete_cookie("ph_access")
    me_resp = client.get("/api/auth/me", headers={"X-API-Key": raw_key})
    assert me_resp.status_code == 200
    assert me_resp.get_json()["principal"]["userId"] == 1

    raw2, prefix2, hash2 = generate_api_key()
    app.extensions["api_key_service"].create_api_key(
        user_id=1, name="Postman Key", key_prefix=prefix2, key_hash=hash2
    )
    assert client.get("/api/tasks", headers={"X-API-Key": raw2}).status_code == 200
