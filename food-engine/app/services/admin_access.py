"""
Admin authorization lookups against the existing Trackwise schema.

Verified from migrations + Admin app (not live DB introspection):
- public.user_roles(user_id, role) with role in ('user', 'admin', 'tester')
- Admin privilege = role 'admin' (see admin/src/lib/auth.ts requireAdmin)
- public.profiles.account_status in ('active', 'suspended')
- Suspended admins must be denied

Phase 1 does not create DB roles/migrations. When DATABASE_URL is unset, access
checks fail closed. When set, the DSN must be a least-privilege server credential
(future food_engine_app); never ship that credential to clients.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import asyncpg

logger = logging.getLogger(__name__)

ADMIN_ROLE = "admin"
ACTIVE_STATUS = "active"
SUSPENDED_STATUS = "suspended"


@dataclass(frozen=True, slots=True)
class AdminAccessResult:
    is_admin: bool
    account_status: str | None
    reason: str


class AdminAccessError(Exception):
    """Raised when admin access cannot be determined safely (fail closed)."""


class AdminAccessChecker(Protocol):
    async def check(self, user_id: str) -> AdminAccessResult: ...


class UnconfiguredAdminAccessChecker:
    """Fail-closed checker used when DATABASE_URL is not configured."""

    async def check(self, user_id: str) -> AdminAccessResult:
        _ = user_id
        return AdminAccessResult(
            is_admin=False,
            account_status=None,
            reason="admin_lookup_unconfigured",
        )


class DatabaseAdminAccessChecker:
    """
    Looks up admin role + account status via parameterized SQL.

    Uses a short-lived connection per check in Phase 1 (no pool yet).
    Does not SET JWT claims; does not rely on RLS auth.uid().
    """

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    async def check(self, user_id: str) -> AdminAccessResult:
        try:
            conn = await asyncpg.connect(self._database_url, timeout=5)
        except Exception as exc:
            logger.error("Admin lookup database connection failed")
            raise AdminAccessError("Admin authorization backend unavailable") from exc

        try:
            is_admin = await conn.fetchval(
                """
                select exists(
                  select 1
                  from public.user_roles
                  where user_id = $1::uuid
                    and role = $2
                )
                """,
                user_id,
                ADMIN_ROLE,
            )
            account_status = await conn.fetchval(
                """
                select account_status
                from public.profiles
                where id = $1::uuid
                """,
                user_id,
            )
        except Exception as exc:
            logger.error("Admin lookup query failed")
            raise AdminAccessError("Admin authorization backend unavailable") from exc
        finally:
            await conn.close()

        status = account_status if isinstance(account_status, str) else None
        if not bool(is_admin):
            return AdminAccessResult(
                is_admin=False,
                account_status=status,
                reason="not_admin",
            )
        if status == SUSPENDED_STATUS:
            return AdminAccessResult(
                is_admin=True,
                account_status=status,
                reason="suspended",
            )
        if status is not None and status != ACTIVE_STATUS:
            return AdminAccessResult(
                is_admin=True,
                account_status=status,
                reason="inactive",
            )
        # Missing profile row: fail closed (cannot confirm active).
        if status is None:
            return AdminAccessResult(
                is_admin=True,
                account_status=None,
                reason="profile_missing",
            )
        return AdminAccessResult(
            is_admin=True,
            account_status=status,
            reason="ok",
        )


def build_admin_access_checker(database_url: str | None) -> AdminAccessChecker:
    if database_url:
        return DatabaseAdminAccessChecker(database_url)
    return UnconfiguredAdminAccessChecker()
