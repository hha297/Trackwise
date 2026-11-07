"""Open Food Facts adapter — UA, rate limits, provenance; Phase 4 skips image download in pipeline."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.sources.base import SourcePage, SourceProduct
from app.sources.http_retry import request_json

logger = logging.getLogger(__name__)


class OpenFoodFactsAdapter:
    source_system = "open_food_facts"

    def __init__(
        self,
        *,
        base_url: str,
        user_agent: str,
        client: httpx.AsyncClient | None = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._user_agent = user_agent
        self._client = client
        self._timeout = timeout_seconds
        self._max_retries = max_retries

    def _headers(self) -> dict[str, str]:
        return {"User-Agent": self._user_agent, "Accept": "application/json"}

    async def _client_ctx(self) -> tuple[httpx.AsyncClient, bool]:
        if self._client is not None:
            return self._client, False
        return httpx.AsyncClient(timeout=self._timeout), True

    def _map_product(self, product: dict[str, Any], *, external_id: str) -> SourceProduct:
        nutriments = product.get("nutriments")
        if not isinstance(nutriments, dict):
            nutriments = {}
        # Collect URLs for provenance only — Phase 4 pipeline must not download them.
        images: list[str] = []
        for key in ("image_front_url", "image_url", "image_front_small_url"):
            url = product.get(key)
            if isinstance(url, str) and url.startswith("http"):
                images.append(url)
        code = str(product.get("code") or external_id)
        return SourceProduct(
            source_system=self.source_system,
            external_id=code,
            barcode_raw=code,
            name_original=_str_or_none(product.get("product_name") or product.get("product_name_en")),
            brand_original=_str_or_none(product.get("brands")),
            ingredients_original=_str_or_none(product.get("ingredients_text")),
            nutrition_original=nutriments,
            nutrition_basis_original="per_100g",
            image_urls=images,
            raw_payload=product,
            license_tag="ODbL-1.0",
            attribution_text="Open Food Facts contributors",
            redistribution_class="odbl",
            source_url=f"https://world.openfoodfacts.org/product/{code}",
            provider_data_version=_str_or_none(product.get("last_modified_t")),
        )

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None:
        client, owns = await self._client_ctx()
        try:
            data = await request_json(
                client,
                "GET",
                f"{self._base_url}/api/v2/product/{barcode}.json",
                headers=self._headers(),
                max_retries=self._max_retries,
            )
        finally:
            if owns:
                await client.aclose()
        if not isinstance(data, dict) or data.get("status") != 1:
            return None
        product = data.get("product")
        if not isinstance(product, dict):
            return None
        return self._map_product(product, external_id=str(product.get("code") or barcode))

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None:
        return await self.fetch_by_barcode(external_id)

    async def search(self, query: str, *, page: int = 1, page_size: int = 20) -> SourcePage:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        client, owns = await self._client_ctx()
        try:
            data = await request_json(
                client,
                "GET",
                f"{self._base_url}/cgi/search.pl",
                headers=self._headers(),
                params={
                    "search_terms": query,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page": page,
                    "page_size": page_size,
                },
                max_retries=self._max_retries,
            )
        finally:
            if owns:
                await client.aclose()
        if not isinstance(data, dict):
            return SourcePage(items=[], page=page, page_size=page_size)
        products = data.get("products")
        items: list[SourceProduct] = []
        if isinstance(products, list):
            for raw in products:
                if not isinstance(raw, dict):
                    continue
                code = raw.get("code")
                if not code:
                    continue
                items.append(self._map_product(raw, external_id=str(code)))
        count = data.get("count")
        total = int(count) if isinstance(count, int) else None
        next_page = page + 1 if items and (total is None or page * page_size < total) else None
        return SourcePage(
            items=items,
            page=page,
            page_size=page_size,
            total_hint=total,
            next_page=next_page,
        )

    async def iter_external_ids(self, *, limit: int | None = None) -> AsyncIterator[str]:
        """OFF does not expose a full-catalog ID dump here — empty iterator."""
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
