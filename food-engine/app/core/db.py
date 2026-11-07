"""Async Postgres pools for least-privilege Food Engine roles."""

from __future__ import annotations

import logging
from typing import Literal

import asyncpg

from app.core.config import Settings

logger = logging.getLogger(__name__)

PoolKind = Literal["app", "worker", "admin"]

_pools: dict[PoolKind, asyncpg.Pool | None] = {
    "app": None,
    "worker": None,
    "admin": None,
}


def _dsn_for(settings: Settings, kind: PoolKind) -> str | None:
    if kind == "app":
        return settings.database_app_url or settings.database_url
    if kind == "worker":
        return settings.database_worker_url
    return settings.database_admin_url


async def init_pools(settings: Settings) -> None:
    """Create pools for configured DSNs. Missing optional pools are skipped."""
    kinds: tuple[PoolKind, ...] = ("app", "worker", "admin")
    for kind in kinds:
        dsn = _dsn_for(settings, kind)
        if not dsn:
            logger.info("db_pool_skip kind=%s reason=unconfigured", kind)
            continue
        if _pools[kind] is not None:
            continue
        _pools[kind] = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=settings.db_pool_max_size,
            command_timeout=settings.db_command_timeout_seconds,
            timeout=settings.db_connect_timeout_seconds,
        )
        logger.info("db_pool_ready kind=%s", kind)


async def close_pools() -> None:
    for kind, pool in list(_pools.items()):
        if pool is not None:
            await pool.close()
            _pools[kind] = None
            logger.info("db_pool_closed kind=%s", kind)


def get_pool(kind: PoolKind) -> asyncpg.Pool:
    pool = _pools.get(kind)
    if pool is None:
        raise RuntimeError(f"Database pool '{kind}' is not configured")
    return pool


async def ping_pool(kind: PoolKind) -> bool:
    pool = _pools.get(kind)
    if pool is None:
        return False
    async with pool.acquire() as conn:
        val = await conn.fetchval("select 1")
        return bool(val == 1)
