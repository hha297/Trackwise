"""Source adapter protocol."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class SourceProduct:
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


class SourceAdapter(Protocol):
    source_system: str

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None: ...

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None: ...
