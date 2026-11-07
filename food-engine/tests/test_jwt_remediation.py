"""M1–M5 security remediation tests (JWKS kid, sub, aud arrays, JWK metadata)."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClient

from app.core.config import Settings
from app.core.security import (
    AuthenticationError,
    JwksAsymmetricKeyResolver,
    JwtVerifier,
    validate_es256_jwk_metadata,
)
from tests.conftest import (
    TEST_AUDIENCE,
    TEST_ISSUER,
    TEST_JWKS_URL,
    TEST_JWT_SECRET,
    TEST_WORKER_TOKEN,
    dual_mode_verifier,
    ec_public_jwk,
    make_es256_token,
)

KNOWN_KID = "5bdb9b97-fd5e-41f0-8436-511a6b49dc29"
UNKNOWN_KID = "00000000-0000-0000-0000-000000000000"


def _dual_settings(*, legacy_secret: str | None = TEST_JWT_SECRET) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        supabase_jwks_url=TEST_JWKS_URL,
        supabase_jwt_secret=legacy_secret,
        supabase_jwt_issuer=TEST_ISSUER,
        supabase_jwt_audience=TEST_AUDIENCE,
        food_engine_worker_token=TEST_WORKER_TOKEN,
    )


# --- M1: unknown / known kid via production resolver ---


def test_jwks_known_kid_accepted(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    jwk = ec_public_jwk(public_key, kid=KNOWN_KID, key_ops=["verify"])
    token = make_es256_token(private_key, kid=KNOWN_KID)
    client = PyJWKClient(TEST_JWKS_URL, cache_keys=False)
    with patch.object(client, "fetch_data", return_value={"keys": [jwk]}):
        resolver = JwksAsymmetricKeyResolver(TEST_JWKS_URL, jwk_client=client)
        verifier = JwtVerifier(_dual_settings(), asymmetric_key_resolver=resolver)
        user = verifier.verify_access_token(token)
    assert user.user_id == "11111111-1111-1111-1111-111111111111"


def test_jwks_unknown_kid_fails_closed(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    jwk = ec_public_jwk(public_key, kid=KNOWN_KID, key_ops=["verify"])
    token = make_es256_token(private_key, kid=UNKNOWN_KID)
    client = PyJWKClient(TEST_JWKS_URL, cache_keys=False)
    with patch.object(client, "fetch_data", return_value={"keys": [jwk]}):
        resolver = JwksAsymmetricKeyResolver(TEST_JWKS_URL, jwk_client=client)
        verifier = JwtVerifier(_dual_settings(), asymmetric_key_resolver=resolver)
        with pytest.raises(AuthenticationError, match="Unable to resolve signing key"):
            verifier.verify_access_token(token)


def test_jwks_refresh_error_does_not_fall_back_to_hs256(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """ES256 path errors must not authenticate via the configured legacy HMAC secret."""
    private_key, _public_key = es256_keypair
    token = make_es256_token(private_key, kid=KNOWN_KID)
    client = PyJWKClient(TEST_JWKS_URL, cache_keys=False)
    with patch.object(client, "fetch_data", side_effect=OSError("jwks unreachable")):
        resolver = JwksAsymmetricKeyResolver(TEST_JWKS_URL, jwk_client=client)
        # Legacy secret is configured (dual mode) — still must not HS256-verify this ES256 token.
        verifier = JwtVerifier(
            _dual_settings(legacy_secret=TEST_JWT_SECRET),
            asymmetric_key_resolver=resolver,
        )
        with pytest.raises(AuthenticationError):
            verifier.verify_access_token(token)


# --- M2: missing / empty / non-string sub ---


def test_missing_sub_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, omit_sub=True)
    with pytest.raises(AuthenticationError):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_empty_sub_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, sub="")
    with pytest.raises(AuthenticationError, match="subject"):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_non_string_sub_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, sub=12345)
    with pytest.raises(AuthenticationError, match="subject"):
        dual_mode_verifier(public_key).verify_access_token(token)


# --- M3: array-valued audience (PyJWT validation) ---


def test_array_audience_containing_expected_accepted(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, audience=["authenticated"])
    user = dual_mode_verifier(public_key).verify_access_token(token)
    assert user.user_id == "11111111-1111-1111-1111-111111111111"


def test_array_audience_without_expected_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, audience=["other"])
    with pytest.raises(AuthenticationError, match="audience"):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_array_audience_with_other_and_expected_accepted(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """
    Intended policy: PyJWT accepts when the configured audience appears anywhere
    in the token's aud array (standard multi-audience JWT behavior).
    """
    private_key, public_key = es256_keypair
    token = make_es256_token(private_key, audience=["other", "authenticated"])
    user = dual_mode_verifier(public_key).verify_access_token(token)
    assert user.user_id == "11111111-1111-1111-1111-111111111111"


# --- M5: JWK metadata validation ---


def test_validate_es256_jwk_metadata_accepts_valid() -> None:
    validate_es256_jwk_metadata(
        {
            "kty": "EC",
            "crv": "P-256",
            "alg": "ES256",
            "use": "sig",
            "key_ops": ["verify"],
        }
    )


@pytest.mark.parametrize(
    "mutator",
    [
        pytest.param(lambda d: d.update({"kty": "RSA"}), id="kty-rsa"),
        pytest.param(lambda d: d.update({"crv": "P-384"}), id="crv-p384"),
        pytest.param(lambda d: d.update({"alg": "ES384"}), id="alg-es384"),
        pytest.param(lambda d: d.pop("alg", None), id="alg-missing"),
        pytest.param(lambda d: d.pop("crv", None), id="crv-missing"),
        pytest.param(lambda d: d.update({"use": "enc"}), id="use-enc"),
        pytest.param(lambda d: d.update({"key_ops": ["sign"]}), id="key-ops-sign-only"),
    ],
)
def test_validate_es256_jwk_metadata_rejects_incompatible(mutator: Any) -> None:
    data: dict[str, Any] = {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "use": "sig",
        "key_ops": ["verify"],
    }
    mutator(data)
    with pytest.raises(AuthenticationError, match="Incompatible JWKS key metadata"):
        validate_es256_jwk_metadata(data)


def test_jwks_resolver_rejects_incompatible_metadata_before_verify(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    # Omit alg so PyJWKClient still treats the key as a signing key, then our policy rejects.
    jwk = ec_public_jwk(public_key, kid=KNOWN_KID, alg=None, key_ops=["verify"])
    token = make_es256_token(private_key, kid=KNOWN_KID)
    client = PyJWKClient(TEST_JWKS_URL, cache_keys=False)
    with patch.object(client, "fetch_data", return_value={"keys": [jwk]}):
        resolver = JwksAsymmetricKeyResolver(TEST_JWKS_URL, jwk_client=client)
        verifier = JwtVerifier(_dual_settings(), asymmetric_key_resolver=resolver)
        with pytest.raises(AuthenticationError, match="Incompatible JWKS key metadata"):
            verifier.verify_access_token(token)
