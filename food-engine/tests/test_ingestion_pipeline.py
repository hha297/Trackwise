"""Ingestion pipeline unit tests — mocked adapters and DB helpers."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import Settings
from app.ingestion.pipeline import IngestionPipeline, _job_status_from_stats
from app.sources.base import SourceProduct


def test_job_status_partial_and_failed() -> None:
    assert _job_status_from_stats({"succeeded": 2, "failed": 1}) == "partial"
    assert _job_status_from_stats({"succeeded": 0, "failed": 3}) == "failed"
    assert _job_status_from_stats({"succeeded": 2, "failed": 0}) == "succeeded"


def _product(external_id: str = "1") -> SourceProduct:
    return SourceProduct(
        source_system="open_food_facts",
        external_id=external_id,
        barcode_raw=external_id,
        name_original="Test",
        brand_original=None,
        ingredients_original=None,
        nutrition_original={"proteins_100g": 1},
        nutrition_basis_original="per_100g",
        raw_payload={"code": external_id, "product_name": "Test"},
        license_tag="ODbL-1.0",
    )


@pytest.mark.asyncio
async def test_process_item_idempotent_skip() -> None:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        off_enabled=True,
        fineli_enabled=False,
        usda_enabled=False,
    )
    pipeline = IngestionPipeline(settings)
    adapter = MagicMock()
    adapter.fetch_by_external_id = AsyncMock(return_value=_product("99"))

    existing_id = uuid.uuid4()
    conn = MagicMock()
    pool = MagicMock()
    pool.acquire = MagicMock()
    # async context manager for pool.acquire()
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire.return_value = acquire_cm
    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_cm)

    with (
        patch("app.ingestion.pipeline.get_pool", return_value=pool),
        patch("app.ingestion.pipeline.repo.find_observation_by_content_hash", new=AsyncMock(return_value=existing_id)),
        patch("app.ingestion.pipeline.repo.mark_item", new=AsyncMock()) as mark,
        patch("app.ingestion.pipeline.repo.insert_observation", new=AsyncMock()) as insert,
    ):
        outcome = await pipeline._process_item(adapter, uuid.uuid4(), "99")

    assert outcome == "skipped"
    insert.assert_not_awaited()
    mark.assert_awaited()
    kwargs = mark.await_args.kwargs
    assert kwargs["status"] == "skipped"
    assert kwargs["error"]["reason"] == "duplicate_content_hash"


@pytest.mark.asyncio
async def test_process_item_not_found_skipped() -> None:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        off_enabled=True,
        fineli_enabled=False,
        usda_enabled=False,
    )
    pipeline = IngestionPipeline(settings)
    adapter = MagicMock()
    adapter.fetch_by_external_id = AsyncMock(return_value=None)

    conn = MagicMock()
    pool = MagicMock()
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire.return_value = acquire_cm

    with (
        patch("app.ingestion.pipeline.get_pool", return_value=pool),
        patch("app.ingestion.pipeline.repo.mark_item", new=AsyncMock()) as mark,
    ):
        outcome = await pipeline._process_item(adapter, uuid.uuid4(), "missing")

    assert outcome == "skipped"
    assert mark.await_args.kwargs["status"] == "skipped"


@pytest.mark.asyncio
async def test_process_item_success_persists_observation() -> None:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        off_enabled=True,
        fineli_enabled=False,
        usda_enabled=False,
        ingest_download_images=False,
    )
    pipeline = IngestionPipeline(settings)
    adapter = MagicMock()
    adapter.fetch_by_external_id = AsyncMock(return_value=_product("55"))

    observation_id = uuid.uuid4()
    food_id = uuid.uuid4()
    conn = MagicMock()
    pool = MagicMock()
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire.return_value = acquire_cm
    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_cm)

    with (
        patch("app.ingestion.pipeline.get_pool", return_value=pool),
        patch("app.ingestion.pipeline.repo.find_observation_by_content_hash", new=AsyncMock(return_value=None)),
        patch(
            "app.ingestion.pipeline.repo.insert_observation",
            new=AsyncMock(return_value=(observation_id, True)),
        ),
        patch("app.ingestion.pipeline.repo.ensure_processing_row", new=AsyncMock()),
        patch("app.ingestion.pipeline.repo.find_catalog_food_by_barcode", new=AsyncMock(return_value=None)),
        patch("app.ingestion.pipeline.repo.create_draft_food_from_source", new=AsyncMock(return_value=food_id)),
        patch("app.ingestion.pipeline.repo.link_observation", new=AsyncMock()),
        patch("app.ingestion.pipeline.repo.mark_item", new=AsyncMock()) as mark,
    ):
        outcome = await pipeline._process_item(adapter, uuid.uuid4(), "55")

    assert outcome == "succeeded"
    assert mark.await_args.kwargs["status"] == "succeeded"
    assert mark.await_args.kwargs["observation_id"] == observation_id


@pytest.mark.asyncio
async def test_process_item_race_duplicate_skips() -> None:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        off_enabled=True,
        fineli_enabled=False,
        usda_enabled=False,
    )
    pipeline = IngestionPipeline(settings)
    adapter = MagicMock()
    adapter.fetch_by_external_id = AsyncMock(return_value=_product("77"))
    observation_id = uuid.uuid4()

    conn = MagicMock()
    pool = MagicMock()
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire.return_value = acquire_cm
    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_cm)

    with (
        patch("app.ingestion.pipeline.get_pool", return_value=pool),
        patch("app.ingestion.pipeline.repo.find_observation_by_content_hash", new=AsyncMock(return_value=None)),
        patch(
            "app.ingestion.pipeline.repo.insert_observation",
            new=AsyncMock(return_value=(observation_id, False)),
        ),
        patch("app.ingestion.pipeline.repo.mark_item", new=AsyncMock()) as mark,
        patch("app.ingestion.pipeline.repo.create_draft_food_from_source", new=AsyncMock()) as create,
    ):
        outcome = await pipeline._process_item(adapter, uuid.uuid4(), "77")

    assert outcome == "skipped"
    create.assert_not_awaited()
    assert mark.await_args.kwargs["error"]["reason"] == "duplicate_content_hash_race"


def test_registry_usda_disabled_without_key() -> None:
    from app.sources.registry import build_provider_registry, provider_statuses

    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        app_env="test",
        usda_enabled=True,
        usda_fdc_api_key=None,
        fineli_enabled=False,
        off_enabled=True,
    )
    registry = build_provider_registry(settings)
    statuses = {s.provider: s for s in provider_statuses(settings, registry)}
    assert statuses["usda"].enabled is True
    assert statuses["usda"].configured is False
