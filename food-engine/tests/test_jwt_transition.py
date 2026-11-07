"""ES256 JWKS + legacy HS256 transition verification tests."""

from __future__ import annotations

import base64
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from app.core.config import Settings
from app.core.security import AuthenticationError, JwtVerifier
from tests.conftest import (
    TEST_AUDIENCE,
    TEST_ISSUER,
    TEST_JWKS_URL,
    TEST_JWT_SECRET,
    dual_mode_verifier,
    make_es256_token,
    make_hs256_token,
)


def test_valid_es256_token_accepted(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    token = make_es256_token(private_key, sub=user_id)
    user = dual_mode_verifier(public_key).verify_access_token(token)
    assert user.user_id == user_id


def test_invalid_es256_signature_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, _public_key = es256_keypair
    other_public = ec.generate_private_key(ec.SECP256R1()).public_key()
    token = make_es256_token(private_key)
    with pytest.raises(AuthenticationError, match="Invalid token"):
        dual_mode_verifier(other_public).verify_access_token(token)


def test_valid_legacy_hs256_when_secret_configured(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    _private_key, public_key = es256_keypair
    user_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    token = make_hs256_token(sub=user_id)
    user = dual_mode_verifier(public_key).verify_access_token(token)
    assert user.user_id == user_id


def test_invalid_hs256_signature_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    _private_key, public_key = es256_keypair
    token = make_hs256_token(secret="wrong-secret-value-xxxxxxxx-32b!!")
    with pytest.raises(AuthenticationError, match="Invalid token"):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_hs256_rejected_when_legacy_verification_disabled(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    _private_key, public_key = es256_keypair
    token = make_hs256_token()
    verifier = dual_mode_verifier(public_key, legacy_secret=None)
    with pytest.raises(AuthenticationError, match="Legacy HS256 verification is disabled"):
        verifier.verify_access_token(token)


def test_es256_cannot_be_verified_with_hs256_secret(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """HMAC-only config must not accept ES256 tokens (no alg confusion)."""
    private_key, _public_key = es256_keypair
    token = make_es256_token(private_key)
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        supabase_jwks_url=None,
        supabase_jwt_secret=TEST_JWT_SECRET,
        supabase_jwt_issuer=TEST_ISSUER,
        supabase_jwt_audience=TEST_AUDIENCE,
    )
    verifier = JwtVerifier(settings)
    with pytest.raises(AuthenticationError, match="Asymmetric JWT verification is not configured"):
        verifier.verify_access_token(token)


def test_es256_not_verified_by_passing_hmac_secret_into_decode(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    """
    Even with dual config, ES256 path never uses the HMAC secret.
    Wrong public key fails; presence of legacy secret must not rescue the token.
    """
    private_key, _public_key = es256_keypair
    wrong_public = ec.generate_private_key(ec.SECP256R1()).public_key()
    token = make_es256_token(private_key)
    with pytest.raises(AuthenticationError, match="Invalid token"):
        dual_mode_verifier(wrong_public, legacy_secret=TEST_JWT_SECRET).verify_access_token(token)


def test_unsupported_algorithm_rejected(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    _private_key, public_key = es256_keypair
    # Craft a token header claiming alg=none (unsigned) — must be rejected.
    header = (
        base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        .rstrip(b"=")
        .decode()
    )
    payload = (
        base64.urlsafe_b64encode(
            json.dumps(
                {
                    "sub": "11111111-1111-1111-1111-111111111111",
                    "iss": TEST_ISSUER,
                    "aud": TEST_AUDIENCE,
                    "exp": 9999999999,
                }
            ).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    token = f"{header}.{payload}."
    with pytest.raises(AuthenticationError, match="Unsupported"):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_rs256_unsupported_even_if_signed(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    _ec_private, public_key = es256_keypair
    rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "iat": now,
            "exp": now + 3600,
        },
        rsa_key,
        algorithm="RS256",
    )
    with pytest.raises(AuthenticationError, match="Unsupported"):
        dual_mode_verifier(public_key).verify_access_token(token)


def test_invalid_issuer_rejected_for_es256_and_hs256(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    verifier = dual_mode_verifier(public_key)

    with pytest.raises(AuthenticationError, match="issuer"):
        verifier.verify_access_token(
            make_es256_token(private_key, issuer="https://evil.example/auth/v1")
        )
    with pytest.raises(AuthenticationError, match="issuer"):
        verifier.verify_access_token(make_hs256_token(issuer="https://evil.example/auth/v1"))


def test_invalid_audience_rejected_for_es256_and_hs256(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    verifier = dual_mode_verifier(public_key)

    with pytest.raises(AuthenticationError, match="audience"):
        verifier.verify_access_token(make_es256_token(private_key, audience="wrong-aud"))
    with pytest.raises(AuthenticationError, match="audience"):
        verifier.verify_access_token(make_hs256_token(audience="wrong-aud"))


def test_expired_rejected_for_es256_and_hs256(
    es256_keypair: tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey],
) -> None:
    private_key, public_key = es256_keypair
    verifier = dual_mode_verifier(public_key)

    with pytest.raises(AuthenticationError, match="expired"):
        verifier.verify_access_token(make_es256_token(private_key, expires_in=-60))
    with pytest.raises(AuthenticationError, match="expired"):
        verifier.verify_access_token(make_hs256_token(expires_in=-60))


def test_jwks_only_settings_mode(jwks_only_env: None) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    assert settings.jwt_verification_mode == "jwks"
    assert settings.jwks_enabled is True
    assert settings.legacy_hs256_enabled is False


def test_dual_settings_mode(dual_auth_env: None) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    assert settings.jwt_verification_mode == "dual"
    assert settings.supabase_jwks_url == TEST_JWKS_URL
