"""Fineli CSV adapter + decimal parsing tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.sources.fineli import FineliAdapter, FineliDataset, _parse_fineli_number

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "fineli"


def test_parse_fineli_comma_decimal() -> None:
    assert _parse_fineli_number("0,3") == pytest.approx(0.3)
    assert _parse_fineli_number("") is None
    assert _parse_fineli_number("NA") is None


def test_fineli_dataset_from_fixture() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    product = ds.to_source_product("1001")
    assert product is not None
    assert product.source_system == "fineli"
    assert product.name_original == "Omena"
    assert product.nutrition_original.get("protein_g") == pytest.approx(0.3)
    assert product.nutrition_original.get("energy_kj") == pytest.approx(218)
    assert product.license_tag == "CC-BY-4.0"
    assert "fi" in (product.raw_payload.get("labels") or {})


@pytest.mark.asyncio
async def test_fineli_adapter_fetch_and_search() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    adapter = FineliAdapter(dataset=ds, api_enabled=False)
    product = await adapter.fetch_by_external_id("1002")
    assert product is not None
    assert product.name_original == "Banaani"
    assert await adapter.fetch_by_barcode("123") is None
    page = await adapter.search("omena")
    assert any(p.external_id == "1001" for p in page.items)


@pytest.mark.asyncio
async def test_fineli_iter_ids_respects_limit() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    adapter = FineliAdapter(dataset=ds)
    ids = [i async for i in adapter.iter_external_ids(limit=1)]
    assert len(ids) == 1
