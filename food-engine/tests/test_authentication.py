"""JWT and worker authentication tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import clear_settings_cache
from app.main import create_app
from tests.conftest import (
    TEST_JWT_SECRET,
    TEST_WORKER_TOKEN,
    make_access_token,
)


def test_missing_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "token" not in response.text.lower() or "missing" in response.text.lower()
    assert TEST_JWT_SECRET not in response.text
    assert TEST_WORKER_TOKEN not in response.text


def test_malformed_token_returns_401(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert response.status_code == 401
    assert TEST_JWT_SECRET not in response.text


def test_invalid_signature_returns_401(client: TestClient) -> None:
    token = make_access_token(secret="wrong-secret-value-xxxxxxxx-32b!!")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_expired_token_returns_401(client: TestClient) -> None:
    token = make_access_token(expires_in=-30)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_invalid_issuer_returns_401(client: TestClient) -> None:
    token = make_access_token(issuer="http://evil.example/auth/v1")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_valid_token_accepted(client: TestClient) -> None:
    user_id = "22222222-2222-2222-2222-222222222222"
    token = make_access_token(sub=user_id)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == {"user_id": user_id}


def test_unconfigured_jwt_fails_closed(unconfigured_auth_env: None) -> None:
    application = create_app()
    with TestClient(application) as client:
        token = make_access_token()
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert "not configured" in response.json()["detail"].lower()


def test_worker_missing_token_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/internal/worker/ping")
    assert response.status_code == 401
    assert TEST_WORKER_TOKEN not in response.text


def test_worker_incorrect_token_rejected(client: TestClient) -> None:
    response = client.get(
        "/api/v1/internal/worker/ping",
        headers={"X-Food-Engine-Worker-Token": "incorrect-token"},
    )
    assert response.status_code == 401
    assert TEST_WORKER_TOKEN not in response.text
    assert "incorrect-token" not in response.text


def test_worker_valid_token_accepted(client: TestClient) -> None:
    response = client.get(
        "/api/v1/internal/worker/ping",
        headers={"X-Food-Engine-Worker-Token": TEST_WORKER_TOKEN},
    )
    assert response.status_code == 200
    assert response.json() == {"principal": "worker"}


def test_worker_unconfigured_fails_closed(
    monkeypatch: pytest.MonkeyPatch,
    auth_env: None,
) -> None:
    monkeypatch.delenv("FOOD_ENGINE_WORKER_TOKEN", raising=False)
    clear_settings_cache()
    application = create_app()
    with TestClient(application) as client:
        response = client.get(
            "/api/v1/internal/worker/ping",
            headers={"X-Food-Engine-Worker-Token": "anything"},
        )
        assert response.status_code == 503
        assert TEST_WORKER_TOKEN not in response.text
