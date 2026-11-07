"""Open Food Facts adapter — respects UA / rate limits; preserves raw payload."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.sources.base import SourceProduct

logger = logging.getLogger(__name__)


class OpenFoodFactsAdapter:
    source_system = "open_food_facts"

    def __init__(
        self,
        *,
        base_url: str,
        user_agent: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._user_agent = user_agent
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {"User-Agent": self._user_agent, "Accept": "application/json"}

    async def _get(self, path: str) -> dict[str, Any] | None:
        owns = self._client is None
        client = self._client or httpx.AsyncClient(timeout=30.0)
        try:
            resp = await client.get(
                f"{self._base_url}{path}",
                headers=self._headers(),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                return None
            return data
        finally:
            if owns:
                await client.aclose()

    def _map_product(self, product: dict[str, Any], *, external_id: str) -> SourceProduct:
        nutriments = product.get("nutriments")
        if not isinstance(nutriments, dict):
            nutriments = {}
        images: list[str] = []
        for key in ("image_front_url", "image_url", "image_front_small_url"):
            url = product.get(key)
            if isinstance(url, str) and url.startswith("http"):
                images.append(url)
        return SourceProduct(
            source_system=self.source_system,
            external_id=external_id,
            barcode_raw=str(product.get("code") or external_id),
            name_original=product.get("product_name") or product.get("product_name_en"),
            brand_original=product.get("brands"),
            ingredients_original=product.get("ingredients_text"),
            nutrition_original=nutriments,
            nutrition_basis_original="per_100g",
            image_urls=images,
            raw_payload=product,
            license_tag="ODbL-1.0",
            attribution_text="Open Food Facts contributors",
            redistribution_class="odbl",
        )

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None:
        data = await self._get(f"/api/v2/product/{barcode}.json")
        if not data or data.get("status") != 1:
            return None
        product = data.get("product")
        if not isinstance(product, dict):
            return None
        code = str(product.get("code") or barcode)
        return self._map_product(product, external_id=code)

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None:
        return await self.fetch_by_barcode(external_id)
