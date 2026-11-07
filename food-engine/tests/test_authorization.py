"""Admin authorization dependency tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.dependencies.authorization import get_admin_access_checker
from app.main import create_app
from app.services.admin_access import AdminAccessResult, UnconfiguredAdminAccessChecker
from tests.conftest import FakeAdminChecker, make_access_token


def _client_with_checker(checker: object) -> TestClient:
    application = create_app()
    application.dependency_overrides[get_admin_access_checker] = lambda: checker
    return TestClient(application)


def test_non_admin_rejected(auth_env: None) -> None:
    token = make_access_token()
    checker = FakeAdminChecker(
        AdminAccessResult(is_admin=False, account_status="active", reason="not_admin")
    )
    with _client_with_checker(checker) as client:
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin privileges required"


def test_suspended_admin_rejected(auth_env: None) -> None:
    token = make_access_token()
    checker = FakeAdminChecker(
        AdminAccessResult(
            is_admin=True,
            account_status="suspended",
            reason="suspended",
        )
    )
    with _client_with_checker(checker) as client:
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 403
    assert "not active" in response.json()["detail"].lower()


def test_active_admin_accepted(auth_env: None) -> None:
    user_id = "33333333-3333-3333-3333-333333333333"
    token = make_access_token(sub=user_id)
    checker = FakeAdminChecker(
        AdminAccessResult(is_admin=True, account_status="active", reason="ok")
    )
    with _client_with_checker(checker) as client:
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert response.json() == {"user_id": user_id, "account_status": "active"}


def test_jwt_role_claim_alone_does_not_grant_admin(auth_env: None) -> None:
    token = make_access_token(extra_claims={"role": "admin", "app_metadata": {"role": "admin"}})
    checker = FakeAdminChecker(
        AdminAccessResult(is_admin=False, account_status="active", reason="not_admin")
    )
    with _client_with_checker(checker) as client:
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 403


def test_unconfigured_admin_lookup_fails_closed(auth_env: None) -> None:
    token = make_access_token()
    with _client_with_checker(UnconfiguredAdminAccessChecker()) as client:
        response = client.get(
            "/api/v1/admin/ping",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()
