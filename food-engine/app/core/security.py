"""JWT verification and credential comparison helpers."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol, cast

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError

from app.core.config import (
    JWKS_ALGORITHMS,
    LEGACY_HMAC_ALGORITHMS,
    Settings,
)

logger = logging.getLogger(__name__)

_UNSUPPORTED_OR_NONE = frozenset({"none", "None", "NONE", ""})

# JWKS metadata policy for Trackwise ES256 (P-256) keys:
# - kty, crv, and alg are required and must match exactly (missing → reject).
# - use, if present, must be "sig" (missing use is allowed; wrong use → reject).
# - key_ops, if present, must include "verify" (missing key_ops allowed; verify
#   absent → reject). Inconsistent or incompatible metadata never skips checks.
REQUIRED_JWK_KTY = "EC"
REQUIRED_JWK_CRV = "P-256"
REQUIRED_JWK_ALG = "ES256"
REQUIRED_JWK_USE = "sig"
REQUIRED_JWK_KEY_OP = "verify"


class AuthenticationError(Exception):
    """Raised when a credential cannot be authenticated."""


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """Verified identity derived only from a validated access token."""

    user_id: str
    role: str | None
    email: str | None
    token_issuer: str | None
    raw_claims: dict[str, Any]


class AsymmetricKeyResolver(Protocol):
    """Resolves the public key for asymmetric JWT verification (JWKS or test doubles)."""

    def resolve_public_key(self, token: str) -> Any: ...


def validate_es256_jwk_metadata(jwk_data: dict[str, Any]) -> None:
    """
    Reject JWKs that are incompatible with Trackwise ES256 verification.

    Fail closed when required fields are missing or values are wrong.
    """
    kty = jwk_data.get("kty")
    crv = jwk_data.get("crv")
    alg = jwk_data.get("alg")

    if kty != REQUIRED_JWK_KTY:
        raise AuthenticationError("Incompatible JWKS key metadata")
    if crv != REQUIRED_JWK_CRV:
        raise AuthenticationError("Incompatible JWKS key metadata")
    if alg != REQUIRED_JWK_ALG:
        raise AuthenticationError("Incompatible JWKS key metadata")

    if "use" in jwk_data and jwk_data.get("use") != REQUIRED_JWK_USE:
        raise AuthenticationError("Incompatible JWKS key metadata")

    if "key_ops" in jwk_data:
        key_ops = jwk_data.get("key_ops")
        if not isinstance(key_ops, list) or REQUIRED_JWK_KEY_OP not in key_ops:
            raise AuthenticationError("Incompatible JWKS key metadata")


class JwksAsymmetricKeyResolver:
    """
    Production resolver: fetch signing key from JWKS, validate metadata, return public key.

    Does not fall back to HMAC secrets under any error condition.
    """

    def __init__(self, jwks_url: str, *, jwk_client: PyJWKClient | None = None) -> None:
        self._client = jwk_client or PyJWKClient(jwks_url, cache_keys=True)

    def resolve_public_key(self, token: str) -> Any:
        try:
            signing_key = self._client.get_signing_key_from_jwt(token)
        except PyJWKClientError as exc:
            # Unknown kid, empty JWKS, etc. — fail closed, no HS256 fallback.
            raise AuthenticationError("Unable to resolve signing key") from exc
        except Exception as exc:
            # Network/refresh failures from the JWKS client must not fall through to HS256.
            raise AuthenticationError("Unable to resolve signing key") from exc

        jwk_data = getattr(signing_key, "_jwk_data", None)
        if not isinstance(jwk_data, dict):
            # PyJWT versions expose key material on PyJWK; refuse if metadata cannot be read.
            raise AuthenticationError("Incompatible JWKS key metadata")

        validate_es256_jwk_metadata(jwk_data)
        return signing_key.key


class StaticAsymmetricKeyResolver:
    """Test helper: returns a fixed public key (never used in production wiring)."""

    def __init__(self, public_key: Any) -> None:
        self._public_key = public_key

    def resolve_public_key(self, token: str) -> Any:
        _ = token
        return self._public_key


class JwtVerifier:
    """
    Verifies Supabase access tokens with explicit algorithm/key separation.

    Transition strategy (Trackwise live Auth):
    - ES256 tokens → JWKS public keys only (algorithms allowlist: ES256).
    - HS256 tokens → legacy HMAC secret only when configured (algorithms: HS256).
    - Never verify ES256 with the HMAC secret.
    - Never verify HS256 with JWKS public keys.
    - Algorithm from the unprotected header is used only to select a path; each
      path re-verifies with a fixed allowlist and the matching key material.
    - JWKS/key resolution errors never fall back to the HS256 path.
    """

    def __init__(
        self,
        settings: Settings,
        *,
        asymmetric_key_resolver: AsymmetricKeyResolver | None = None,
    ) -> None:
        self._settings = settings
        if asymmetric_key_resolver is not None:
            self._asymmetric_resolver: AsymmetricKeyResolver | None = asymmetric_key_resolver
        elif settings.jwks_enabled and settings.supabase_jwks_url:
            self._asymmetric_resolver = JwksAsymmetricKeyResolver(settings.supabase_jwks_url)
        else:
            self._asymmetric_resolver = None

    def verify_access_token(self, token: str) -> AuthenticatedUser:
        settings = self._settings
        try:
            settings.require_jwt_configuration()
        except RuntimeError as exc:
            logger.error("JWT configuration error")
            raise AuthenticationError("Authentication is not configured") from exc

        try:
            payload = self._decode(token)
        except AuthenticationError:
            raise
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token has expired") from exc
        except jwt.InvalidIssuerError as exc:
            raise AuthenticationError("Invalid token issuer") from exc
        except jwt.InvalidAudienceError as exc:
            raise AuthenticationError("Invalid token audience") from exc
        except jwt.PyJWTError as exc:
            raise AuthenticationError("Invalid token") from exc

        # Subject is validated here (PyJWT 2.9 has no dedicated InvalidSubjectError).
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not user_id:
            raise AuthenticationError("Token missing subject")

        role = payload.get("role")
        email = payload.get("email")
        return AuthenticatedUser(
            user_id=user_id,
            role=role if isinstance(role, str) else None,
            email=email if isinstance(email, str) else None,
            token_issuer=payload.get("iss") if isinstance(payload.get("iss"), str) else None,
            raw_claims=payload,
        )

    def _decode(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise AuthenticationError("Invalid token") from exc

        alg = header.get("alg")
        if not isinstance(alg, str) or alg in _UNSUPPORTED_OR_NONE:
            raise AuthenticationError("Unsupported token algorithm")

        if alg in JWKS_ALGORITHMS:
            return self._decode_es256_via_jwks(token)

        if alg in LEGACY_HMAC_ALGORITHMS:
            return self._decode_legacy_hs256(token)

        raise AuthenticationError("Unsupported token algorithm")

    def _claim_decode_kwargs(self) -> dict[str, Any]:
        settings = self._settings
        decode_kwargs: dict[str, Any] = {
            "issuer": settings.supabase_jwt_issuer,
            "options": {
                "require": ["exp", "sub", "iss"],
                "verify_aud": settings.supabase_jwt_audience is not None,
            },
        }
        if settings.supabase_jwt_audience is not None:
            decode_kwargs["audience"] = settings.supabase_jwt_audience
        return decode_kwargs

    def _decode_es256_via_jwks(self, token: str) -> dict[str, Any]:
        """Verify current Auth tokens. Uses JWKS public key + ES256 allowlist only."""
        if self._asymmetric_resolver is None:
            raise AuthenticationError("Asymmetric JWT verification is not configured")

        public_key = self._asymmetric_resolver.resolve_public_key(token)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=list(JWKS_ALGORITHMS),
            **self._claim_decode_kwargs(),
        )
        return cast(dict[str, Any], payload)

    def _decode_legacy_hs256(self, token: str) -> dict[str, Any]:
        """
        Verify unexpired legacy HS256 tokens during the ES256 transition.

        Requires an explicit legacy secret. Rejects safely when unset.
        Never used for ES256 tokens.
        """
        secret = self._settings.supabase_jwt_secret
        if secret is None:
            raise AuthenticationError("Legacy HS256 verification is disabled")

        payload = jwt.decode(
            token,
            secret,
            algorithms=list(LEGACY_HMAC_ALGORITHMS),
            **self._claim_decode_kwargs(),
        )
        return cast(dict[str, Any], payload)


def constant_time_equals(left: str, right: str) -> bool:
    """Compare strings in roughly constant time without logging values."""
    import hmac

    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))
