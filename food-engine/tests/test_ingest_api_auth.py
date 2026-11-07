"""Security tests for Phase 4 ingestion admin endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_ingest_jobs_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/ingest/jobs",
        json={"provider": "open_food_facts", "external_ids": ["1"]},
    )
    assert response.status_code in {401, 403}


def test_providers_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/admin/providers")
    assert response.status_code in {401, 403}


def test_ingest_single_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/ingest/single",
        json={"provider": "usda", "external_id": "1"},
    )
    assert response.status_code in {401, 403}


def test_worker_run_requires_token(client: TestClient) -> None:
    response = client.post("/api/v1/admin/worker/imports/00000000-0000-0000-0000-000000000001/run")
    assert response.status_code == 401


def test_ingest_endpoints_do_not_leak_secrets(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/ingest/jobs",
        json={"provider": "open_food_facts", "external_ids": ["1"]},
    )
    body = response.text.lower()
    for needle in ("password", "database_url", "api_key", "secret_access"):
        assert needle not in body
