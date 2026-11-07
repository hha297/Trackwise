"""Unit coverage for concurrent-safe import job item claiming."""

from __future__ import annotations

import inspect
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.repositories import ingestion as repo


def test_claim_next_job_item_sql_uses_skip_locked() -> None:
    source = inspect.getsource(repo.claim_next_job_item)
    assert "for update skip locked" in source.lower()
    assert "status = 'queued'" in source
    assert "status = 'running'" in source


def test_claim_job_item_sql_is_conditional_on_queued() -> None:
    source = inspect.getsource(repo.claim_job_item)
    assert "status = 'queued'" in source
    assert "status = 'running'" in source


@pytest.mark.asyncio
async def test_claim_next_job_item_returns_row_from_fetchrow() -> None:
    job_id = uuid.uuid4()
    item_id = uuid.uuid4()
    expected = {"id": item_id, "external_id": "3017620425035"}
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=expected)

    row = await repo.claim_next_job_item(conn, job_id)

    assert row == expected
    conn.fetchrow.assert_awaited_once()
    args = conn.fetchrow.await_args
    assert args is not None
    assert args.args[1] == job_id
    assert "skip locked" in args.args[0].lower()


@pytest.mark.asyncio
async def test_claim_job_item_false_when_already_taken() -> None:
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=None)

    claimed = await repo.claim_job_item(conn, uuid.uuid4())

    assert claimed is False


@pytest.mark.asyncio
async def test_claim_job_item_true_when_update_returns_row() -> None:
    item_id = uuid.uuid4()
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": item_id})

    claimed = await repo.claim_job_item(conn, item_id)

    assert claimed is True


def test_process_job_uses_claim_next_not_preselect() -> None:
    from app.ingestion import pipeline as pipeline_mod

    source = inspect.getsource(pipeline_mod.IngestionPipeline.process_job)
    assert "claim_next_job_item" in source
    assert "select id, external_id from public.food_import_job_items" not in source
