"""USDA FoodData Central adapter — optional; disabled without API key."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.sources.base import SourcePage, SourceProduct
from app.sources.http_retry import ProviderAuthError, ProviderHttpError, request_json

logger = logging.getLogger(__name__)

# FDC nutrient number → ingestion keys (analytical foods are typically per 100 g).
USDA_NUTRIENT_MAP: dict[int, tuple[str, str]] = {
    1008: ("energy_kcal", "kcal"),
    1062: ("energy_kj", "kJ"),
    1003: ("protein_g", "g"),
    1005: ("carbohydrates_g", "g"),
    1004: ("fat_g", "g"),
    1258: ("saturated_fat_g", "g"),
    2000: ("sugars_g", "g"),
    1079: ("fiber_g", "g"),
    1093: ("sodium_mg", "mg"),
}


class UsdaFdcAdapter:
    source_system = "usda"

    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str = "https://api.nal.usda.gov/fdc/v1",
        client: httpx.AsyncClient | None = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        default_data_types: list[str] | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = client
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._data_types = default_data_types or ["Foundation", "SR Legacy", "Branded"]

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    def _require_key(self) -> str:
        if not self._api_key:
            raise ProviderAuthError("USDA_FDC_API_KEY is not configured", status_code=None)
        return self._api_key

    async def _client_ctx(self) -> tuple[httpx.AsyncClient, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.AsyncClient(timeout=self._timeout), True

    def _map_food(self, data: dict[str, Any]) -> SourceProduct | None:
        fdc_id = data.get("fdcId")
        if fdc_id is None:
            return None
        description = data.get("description") or data.get("lowercaseDescription")
        brand = data.get("brandOwner") or data.get("brandName")
        barcode = data.get("gtinUpc") or data.get("gtin")
        nutrients_out: dict[str, Any] = {}
        raw_nutrients = data.get("foodNutrients")
        if isinstance(raw_nutrients, list):
            for entry in raw_nutrients:
                if not isinstance(entry, dict):
                    continue
                number = entry.get("nutrientNumber") or entry.get("number")
                nutrient = entry.get("nutrient") if isinstance(entry.get("nutrient"), dict) else {}
                if number is None and nutrient:
                    number = nutrient.get("number")
                try:
                    number_i = int(float(str(number)))
                except (TypeError, ValueError):
                    continue
                amount = entry.get("amount")
                if amount is None:
                    amount = entry.get("value")
                mapped = USDA_NUTRIENT_MAP.get(number_i)
                if mapped and amount is not None:
                    key, unit = mapped
                    try:
                        nutrients_out[key] = float(amount)
                        nutrients_out[f"{key}_unit"] = unit
                    except (TypeError, ValueError):
                        continue
        published = data.get("publishedDate") or data.get("modifiedDate")
        return SourceProduct(
            source_system=self.source_system,
            external_id=str(fdc_id),
            barcode_raw=str(barcode) if barcode else None,
            name_original=str(description) if description else None,
            brand_original=str(brand) if brand else None,
            ingredients_original=_str_or_none(data.get("ingredients")),
            nutrition_original=nutrients_out,
            nutrition_basis_original="per_100g",
            raw_payload=data,
            license_tag="USDA-public-domain",
            attribution_text="U.S. Department of Agriculture, FoodData Central",
            redistribution_class="public-domain",
            source_url=f"https://fdc.nal.usda.gov/fdc-app.html#/food-details/{fdc_id}/nutrients",
            provider_data_version=str(published) if published else None,
        )

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None:
        key = self._require_key()
        client, owns = await self._client_ctx()
        try:
            data = await request_json(
                client,
                "GET",
                f"{self._base_url}/food/{external_id}",
                params={"api_key": key},
                max_retries=self._max_retries,
            )
        finally:
            if owns:
                await client.aclose()
        if not isinstance(data, dict):
            return None
        return self._map_food(data)

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None:
        page = await self.search(barcode, page=1, page_size=5)
        for item in page.items:
            if item.barcode_raw and item.barcode_raw.replace(" ", "") == barcode.replace(" ", ""):
                # Prefer full detail
                detailed = await self.fetch_by_external_id(item.external_id)
                return detailed or item
        return page.items[0] if page.items else None

    async def search(self, query: str, *, page: int = 1, page_size: int = 20) -> SourcePage:
        key = self._require_key()
        page = max(1, page)
        page_size = max(1, min(page_size, 50))
        client, owns = await self._client_ctx()
        try:
            data = await request_json(
                client,
                "POST",
                f"{self._base_url}/foods/search",
                params={"api_key": key},
                json_body={
                    "query": query,
                    "pageSize": page_size,
                    "pageNumber": page,
                    "dataType": self._data_types,
                },
                max_retries=self._max_retries,
            )
        except ProviderHttpError:
            raise
        finally:
            if owns:
                await client.aclose()
        if not isinstance(data, dict):
            return SourcePage(items=[], page=page, page_size=page_size)
        foods = data.get("foods")
        items: list[SourceProduct] = []
        if isinstance(foods, list):
            for raw in foods:
                if isinstance(raw, dict):
                    mapped = self._map_food(raw)
                    if mapped is not None:
                        items.append(mapped)
        total = data.get("totalHits")
        total_i = int(total) if isinstance(total, int) else None
        next_page = page + 1 if items and (total_i is None or page * page_size < total_i) else None
        return SourcePage(
            items=items,
            page=page,
            page_size=page_size,
            total_hint=total_i,
            next_page=next_page,
        )

    async def iter_external_ids(self, *, limit: int | None = None) -> AsyncIterator[str]:
        """USDA full dump is out of scope; empty iterator for Phase 4."""
        if limit is not None and limit <= 0:
            return
        if False:  # pragma: no cover
            yield ""
        return


def _str_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
