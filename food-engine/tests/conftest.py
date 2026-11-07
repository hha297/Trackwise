"""Shared pytest fixtures with isolated test configuration."""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.core.config import Settings, clear_settings_cache
from app.core.security import JwtVerifier, StaticAsymmetricKeyResolver
from app.main import create_app
from app.services.admin_access import AdminAccessResult

TEST_JWT_SECRET = "test-only-hmac-secret-not-for-production-32b"
TEST_ISSUER = "https://xdslsulhgknbocvbnufl.supabase.co/auth/v1"
TEST_AUDIENCE = "authenticated"
TEST_WORKER_TOKEN = "test-worker-token-not-for-production"
TEST_JWKS_URL = "https://example.test/auth/v1/.well-known/jwks.json"


@pytest.fixture(scope="session")
def es256_keypair() -> tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    return private_key, private_key.public_key()


@pytest.fixture
def auth_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Legacy-HS256-only settings (local/dev and HMAC path coverage)."""
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", TEST_ISSUER)
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", TEST_AUDIENCE)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("FOOD_ENGINE_WORKER_TOKEN", TEST_WORKER_TOKEN)
    clear_settings_cache()
    yield
    clear_settings_cache()


@pytest.fixture
def dual_auth_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """JWKS + legacy HS256 secret (Trackwise transition configuration)."""
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SUPABASE_JWKS_URL", TEST_JWKS_URL)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", TEST_ISSUER)
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", TEST_AUDIENCE)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("FOOD_ENGINE_WORKER_TOKEN", TEST_WORKER_TOKEN)
    clear_settings_cache()
    yield
    clear_settings_cache()


@pytest.fixture
def jwks_only_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Production end-state: ES256/JWKS only (legacy HS256 disabled)."""
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("SUPABASE_JWKS_URL", TEST_JWKS_URL)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_LEGACY_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", TEST_ISSUER)
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", TEST_AUDIENCE)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("FOOD_ENGINE_WORKER_TOKEN", TEST_WORKER_TOKEN)
    clear_settings_cache()
    yield
    clear_settings_cache()


@pytest.fixture
def unconfigured_auth_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_LEGACY_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("FOOD_ENGINE_WORKER_TOKEN", TEST_WORKER_TOKEN)
    clear_settings_cache()
    yield
    clear_settings_cache()


def make_hs256_token(
    *,
    sub: str = "11111111-1111-1111-1111-111111111111",
    expires_in: int = 3600,
    issuer: str = TEST_ISSUER,
    audience: str = TEST_AUDIENCE,
    secret: str = TEST_JWT_SECRET,
    extra_claims: dict[str, Any] | None = None,
    headers: dict[str, Any] | None = None,
) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "role": "authenticated",
        "aud": audience,
        "iss": issuer,
        "iat": now,
        "exp": now + expires_in,
        "email": "user@example.com",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm="HS256", headers=headers)


def make_es256_token(
    private_key: ec.EllipticCurvePrivateKey,
    *,
    sub: Any = "11111111-1111-1111-1111-111111111111",
    expires_in: int = 3600,
    issuer: str = TEST_ISSUER,
    audience: Any = TEST_AUDIENCE,
    kid: str = "5bdb9b97-fd5e-41f0-8436-511a6b49dc29",
    omit_sub: bool = False,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "role": "authenticated",
        "aud": audience,
        "iss": issuer,
        "iat": now,
        "exp": now + expires_in,
        "email": "user@example.com",
    }
    if not omit_sub:
        payload["sub"] = sub
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(
        payload,
        private_key,
        algorithm="ES256",
        headers={"kid": kid},
    )


def ec_public_jwk(
    public_key: ec.EllipticCurvePublicKey,
    *,
    kid: str,
    alg: str | None = "ES256",
    use: str | None = "sig",
    key_ops: list[str] | None = None,
    kty: str | None = None,
    crv: str | None = None,
) -> dict[str, Any]:
    """Build a JWKS key dict for controlled PyJWKClient tests."""
    from jwt.algorithms import ECAlgorithm

    data = json.loads(ECAlgorithm.to_jwk(public_key))
    data["kid"] = kid
    if alg is not None:
        data["alg"] = alg
    elif "alg" in data:
        del data["alg"]
    if use is not None:
        data["use"] = use
    if key_ops is not None:
        data["key_ops"] = key_ops
    if kty is not None:
        data["kty"] = kty
    if crv is not None:
        data["crv"] = crv
    return data


# Backwards-compatible alias used by older Phase 1 tests.
make_access_token = make_hs256_token


def dual_mode_verifier(
    public_key: ec.EllipticCurvePublicKey,
    *,
    legacy_secret: str | None = TEST_JWT_SECRET,
) -> JwtVerifier:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        supabase_jwks_url=TEST_JWKS_URL,
        supabase_jwt_secret=legacy_secret,
        supabase_jwt_issuer=TEST_ISSUER,
        supabase_jwt_audience=TEST_AUDIENCE,
        food_engine_worker_token=TEST_WORKER_TOKEN,
    )
    return JwtVerifier(
        settings,
        asymmetric_key_resolver=StaticAsymmetricKeyResolver(public_key),
    )


@pytest.fixture
def client(auth_env: None) -> Iterator[TestClient]:
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client


class FakeAdminChecker:
    def __init__(self, result: AdminAccessResult) -> None:
        self._result = result

    async def check(self, user_id: str) -> AdminAccessResult:
        _ = user_id
        return self._result
