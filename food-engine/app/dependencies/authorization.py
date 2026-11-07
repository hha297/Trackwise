"""Authorization dependencies (privileges after authentication)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser
from app.dependencies.authentication import get_current_user
from app.services.admin_access import (
    AdminAccessChecker,
    AdminAccessError,
    build_admin_access_checker,
)


@dataclass(frozen=True, slots=True)
class AdminPrincipal:
    user_id: str
    account_status: str


def get_admin_access_checker(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AdminAccessChecker:
    # Prefer dedicated app DSN; never use worker/admin publish credentials for authz lookup.
    return build_admin_access_checker(settings.database_app_url or settings.database_url)


async def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    checker: Annotated[AdminAccessChecker, Depends(get_admin_access_checker)],
) -> AdminPrincipal:
    """
    Authorize an authenticated user as an active admin.

    Never trusts JWT `role` / app_metadata claims as proof of admin.
    Fail closed when lookup is unconfigured or backend errors occur.
    """
    # Explicitly ignore token role claim for authorization decisions.
    _ = user.role

    try:
        result = await checker.check(user.user_id)
    except AdminAccessError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authorization unavailable",
        ) from exc

    if result.reason == "admin_lookup_unconfigured":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authorization is not configured",
        )

    if not result.is_admin or result.reason == "not_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    if result.reason in {"suspended", "inactive", "profile_missing"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )

    if result.reason != "ok" or result.account_status is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    return AdminPrincipal(user_id=user.user_id, account_status=result.account_status)
