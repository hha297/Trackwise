"""Health endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "status": "ok",
        "service": "trackwise-food-engine",
        "version": "0.3.0",
    }


def test_health_does_not_expose_secrets(client: TestClient) -> None:
    response = client.get("/health")
    body = response.text.lower()
    for needle in (
        "secret",
        "password",
        "token",
        "database_url",
        "jwt",
        "supabase_jwt",
        "worker",
    ):
        assert needle not in body


def test_ready_without_pools_returns_503(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "not_ready"
    assert payload["app_db"] is False
    assert "database_url" not in response.text.lower()
    assert "password" not in response.text.lower()


def test_openapi_available_in_test_env(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"]


def test_docs_available_in_test_env(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
