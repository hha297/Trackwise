"""Fineli encoding, Finnish characters, missing values — fixture-based (not live package)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.sources.fineli import FineliAdapter, FineliDataset, _parse_fineli_number

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "fineli"


def test_fineli_utf8_finnish_swedish_names() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    angelica = ds.to_source_product("1003")
    assert angelica is not None
    assert angelica.name_original == "Väinönputki"
    labels = angelica.raw_payload["labels"]
    assert labels["sv"] == "Kvanne"
    bilberry = ds.to_source_product("1004")
    assert bilberry is not None
    assert "ä" in (bilberry.raw_payload["labels"]["sv"] or "")


def test_fineli_missing_values_not_zero() -> None:
    assert _parse_fineli_number("") is None
    assert _parse_fineli_number(None) is None
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    apple = ds.to_source_product("1001")
    assert apple is not None
    # Empty NACL cell must not invent salt_g=0
    assert "salt_g" not in apple.nutrition_original or apple.nutrition_original.get("salt_g") is None
    comps = apple.nutrition_original.get("fineli_components") or {}
    assert comps.get("NACL") is None


def test_fineli_attribution_cc_by() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    product = ds.to_source_product("1001")
    assert product is not None
    assert product.license_tag == "CC-BY-4.0"
    assert "Fineli" in (product.attribution_text or "")


@pytest.mark.asyncio
async def test_fineli_search_unicode_query() -> None:
    ds = FineliDataset.from_directory(FIXTURE_DIR)
    adapter = FineliAdapter(dataset=ds)
    page = await adapter.search("väinön")
    assert any(p.external_id == "1003" for p in page.items)


def test_fineli_fixture_not_official_package_disclaimer() -> None:
    """Fixtures are synthetic column samples — not a validated THL zip extract."""
    # Official packages document food.csv + component_value.csv; our parser accepts those
    # names but real column sets may include additional fields (IGCLASS, etc.).
    assert (FIXTURE_DIR / "food.csv").exists()
    text = (FIXTURE_DIR / "food.csv").read_text(encoding="utf-8")
    assert "FOODID" in text
    assert "FOODNAME" in text
