"""Job status / finalize lifecycle unit tests."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.repositories import ingestion as repo


def test_job_status_all_succeeded() -> None:
    assert repo.job_status_from_counts({"succeeded": 3, "failed": 0, "skipped": 0}) == "succeeded"


def test_job_status_all_failed() -> None:
    assert repo.job_status_from_counts({"succeeded": 0, "failed": 4, "skipped": 0}) == "failed"


def test_job_status_mixed_partial() -> None:
    assert repo.job_status_from_counts({"succeeded": 2, "failed": 1, "skipped": 0}) == "partial"


def test_job_status_all_skipped() -> None:
    # No failures → succeeded with skipped-only checkpoint.
    assert repo.job_status_from_counts({"succeeded": 0, "failed": 0, "skipped": 5}) == "succeeded"


def test_job_status_empty() -> None:
    assert repo.job_status_from_counts({"succeeded": 0, "failed": 0, "skipped": 0}) == "succeeded"


@pytest.mark.asyncio
async def test_finalize_leaves_running_when_work_remains() -> None:
    conn = MagicMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"status": "succeeded", "n": 1},
            {"status": "queued", "n": 2},
        ]
    )
    conn.execute = AsyncMock()
    status, checkpoint = await repo.finalize_import_job(
        conn, uuid.uuid4(), provider="open_food_facts", duration_ms=10
    )
    assert status == "running"
    assert checkpoint["queued"] == 2
    assert checkpoint["succeeded"] == 1
    conn.execute.assert_awaited()


@pytest.mark.asyncio
async def test_finalize_partial_when_complete() -> None:
    conn = MagicMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"status": "succeeded", "n": 2},
            {"status": "failed", "n": 1},
            {"status": "skipped", "n": 1},
        ]
    )
    conn.execute = AsyncMock()
    status, checkpoint = await repo.finalize_import_job(
        conn, uuid.uuid4(), provider="fineli", duration_ms=42
    )
    assert status == "partial"
    assert checkpoint["failed"] == 1
    assert checkpoint["skipped"] == 1


@pytest.mark.asyncio
async def test_reclaim_stale_running_items_sql() -> None:
    conn = MagicMock()
    conn.fetchval = AsyncMock(return_value=3)
    n = await repo.reclaim_stale_running_items(conn, uuid.uuid4(), stale_after_seconds=120)
    assert n == 3
    sql = conn.fetchval.await_args.args[0].lower()
    assert "status = 'running'" in sql
    assert "queued" in sql


@pytest.mark.asyncio
async def test_insert_observation_unique_violation_returns_existing() -> None:
    import asyncpg

    from app.sources.base import SourceProduct

    product = SourceProduct(
        source_system="usda",
        external_id="1",
        barcode_raw=None,
        name_original="X",
        brand_original=None,
        ingredients_original=None,
        nutrition_original={},
        nutrition_basis_original="per_100g",
        raw_payload={"fdcId": 1},
    )
    existing = uuid.uuid4()
    conn = MagicMock()
    conn.fetchval = AsyncMock(side_effect=[asyncpg.UniqueViolationError(), existing])

    observation_id, created = await repo.insert_observation(conn, product, import_job_item_id=None)
    assert created is False
    assert observation_id == existing
