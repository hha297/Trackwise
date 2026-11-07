"""Open Food Facts adapter tests — mocked HTTP only."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.sources.open_food_facts import OpenFoodFactsAdapter


def _resp(status: int, payload: object) -> httpx.Response:
    req = httpx.Request("GET", "https://world.openfoodfacts.org/x")
    if isinstance(payload, dict):
        return httpx.Response(status, json=payload, request=req)
    return httpx.Response(status, text=str(payload), request=req)


@pytest.mark.asyncio
async def test_off_fetch_by_barcode_ok() -> None:
    client = MagicMock()
    client.request = AsyncMock(
        return_value=_resp(
            200,
            {
                "status": 1,
                "product": {
                    "code": "3017620422003",
                    "product_name": "Nutella",
                    "brands": "Ferrero",
                    "nutriments": {"proteins_100g": 6.3},
                    "image_front_url": "https://images.example/front.jpg",
                },
            },
        )
    )
    adapter = OpenFoodFactsAdapter(
        base_url="https://world.openfoodfacts.org",
        user_agent="test",
        client=client,
        max_retries=0,
    )
    product = await adapter.fetch_by_barcode("3017620422003")
    assert product is not None
    assert product.external_id == "3017620422003"
    assert product.name_original == "Nutella"
    assert product.image_urls  # provenance URLs retained
    assert product.license_tag == "ODbL-1.0"
    assert product.source_url is not None


@pytest.mark.asyncio
async def test_off_fetch_missing_product() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_resp(200, {"status": 0}))
    adapter = OpenFoodFactsAdapter(
        base_url="https://world.openfoodfacts.org",
        user_agent="test",
        client=client,
        max_retries=0,
    )
    assert await adapter.fetch_by_barcode("000") is None


@pytest.mark.asyncio
async def test_off_fetch_404() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_resp(404, {}))
    adapter = OpenFoodFactsAdapter(
        base_url="https://world.openfoodfacts.org",
        user_agent="test",
        client=client,
        max_retries=0,
    )
    assert await adapter.fetch_by_barcode("000") is None


@pytest.mark.asyncio
async def test_off_search_maps_products() -> None:
    client = MagicMock()
    client.request = AsyncMock(
        return_value=_resp(
            200,
            {
                "count": 1,
                "products": [{"code": "1", "product_name": "A", "nutriments": {}}],
            },
        )
    )
    adapter = OpenFoodFactsAdapter(
        base_url="https://world.openfoodfacts.org",
        user_agent="test",
        client=client,
        max_retries=0,
    )
    page = await adapter.search("nutella", page=1, page_size=10)
    assert len(page.items) == 1
    assert page.items[0].name_original == "A"
