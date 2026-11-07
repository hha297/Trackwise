"""Authentication dependencies (identity only — not authorization)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.core.security import (
    AuthenticatedUser,
    AuthenticationError,
    JwtVerifier,
    constant_time_equals,
)


def get_jwt_verifier(settings: Annotated[Settings, Depends(get_settings)]) -> JwtVerifier:
    return JwtVerifier(settings)


def _extract_bearer_token(authorization: str | None) -> str:
    if authorization is None or authorization.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.strip()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    *,
    verifier: Annotated[JwtVerifier, Depends(get_jwt_verifier)],
) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    try:
        return verifier.verify_access_token(token)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def require_worker(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_food_engine_worker_token: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """
    Authenticate a service worker via dedicated server-side token.

    Accepts `Authorization: Bearer <token>` or `X-Food-Engine-Worker-Token`.
    Never logs or returns the configured secret.
    """
    _ = request
    expected = settings.food_engine_worker_token
    if expected is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Worker authentication is not configured",
        )

    provided: str | None = None
    if x_food_engine_worker_token:
        provided = x_food_engine_worker_token.strip()
    elif authorization:
        scheme, _, credentials = authorization.partition(" ")
        if scheme.lower() == "bearer" and credentials.strip():
            provided = credentials.strip()

    if provided is None or provided == "":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing worker credentials",
        )

    if not constant_time_equals(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid worker credentials",
        )

    return {"principal": "worker"}
