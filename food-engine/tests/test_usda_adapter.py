"""USDA FoodData Central adapter tests — mocked HTTP; optional key."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.sources.http_retry import ProviderAuthError
from app.sources.usda import UsdaFdcAdapter


def _resp(status: int, payload: object) -> httpx.Response:
    req = httpx.Request("GET", "https://api.nal.usda.gov/fdc/v1/x")
    return httpx.Response(status, json=payload, request=req)


@pytest.mark.asyncio
async def test_usda_requires_key() -> None:
    adapter = UsdaFdcAdapter(api_key=None)
    assert adapter.configured is False
    with pytest.raises(ProviderAuthError):
        await adapter.fetch_by_external_id("173944")


@pytest.mark.asyncio
async def test_usda_fetch_maps_nutrients() -> None:
    client = MagicMock()
    client.request = AsyncMock(
        return_value=_resp(
            200,
            {
                "fdcId": 173944,
                "description": "Banana, raw",
                "dataType": "SR Legacy",
                "publishedDate": "2019-04-01",
                "foodNutrients": [
                    {"nutrientNumber": "1008", "amount": 89},
                    {"nutrientNumber": "1003", "amount": 1.09},
                    {"nutrientNumber": "1005", "amount": 22.8},
                    {"nutrientNumber": "1004", "amount": 0.33},
                ],
            },
        )
    )
    adapter = UsdaFdcAdapter(api_key="test-key", client=client, max_retries=0)
    product = await adapter.fetch_by_external_id("173944")
    assert product is not None
    assert product.external_id == "173944"
    assert product.nutrition_original["energy_kcal"] == pytest.approx(89)
    assert product.attribution_text is not None


@pytest.mark.asyncio
async def test_usda_search() -> None:
    client = MagicMock()
    client.request = AsyncMock(
        return_value=_resp(
            200,
            {
                "totalHits": 1,
                "foods": [{"fdcId": 1, "description": "Cheese", "foodNutrients": []}],
            },
        )
    )
    adapter = UsdaFdcAdapter(api_key="test-key", client=client, max_retries=0)
    page = await adapter.search("cheese", page=1, page_size=10)
    assert len(page.items) == 1
    assert page.items[0].name_original == "Cheese"


@pytest.mark.asyncio
async def test_usda_404() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_resp(404, {"message": "not found"}))
    adapter = UsdaFdcAdapter(api_key="test-key", client=client, max_retries=0)
    assert await adapter.fetch_by_external_id("0") is None
