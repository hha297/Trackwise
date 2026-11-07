"""Source adapter protocol and shared ingestion contract (Phase 4)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class SourceProduct:
    """Normalized ingestion input — provenance first; not a canonical food."""

    source_system: str
    external_id: str
    barcode_raw: str | None
    name_original: str | None
    brand_original: str | None
    ingredients_original: str | None
    nutrition_original: dict[str, Any]
    nutrition_basis_original: str | None
    image_urls: list[str] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)
    license_tag: str | None = None
    attribution_text: str | None = None
    redistribution_class: str | None = None
    source_url: str | None = None
    source_updated_at: datetime | None = None
    provider_data_version: str | None = None


@dataclass(frozen=True, slots=True)
class SourcePage:
    items: list[SourceProduct]
    page: int
    page_size: int
    total_hint: int | None = None
    next_page: int | None = None


@dataclass(frozen=True, slots=True)
class ProviderStatus:
    provider: str
    enabled: bool
    configured: bool
    detail: str | None = None


class SourceAdapter(Protocol):
    source_system: str

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None: ...

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None: ...

    async def search(self, query: str, *, page: int = 1, page_size: int = 20) -> SourcePage: ...

    def iter_external_ids(self, *, limit: int | None = None) -> AsyncIterator[str]: ...
