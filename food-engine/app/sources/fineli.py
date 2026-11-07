"""Fineli (THL) adapter — CC-BY 4.0 open data CSV primary; optional HTTP API."""

from __future__ import annotations

import csv
import io
import logging
import zipfile
from collections.abc import AsyncIterator, Iterable
from pathlib import Path
from typing import Any

import httpx

from app.sources.base import SourcePage, SourceProduct
from app.sources.http_retry import ProviderHttpError, request_json

logger = logging.getLogger(__name__)

# Common Fineli component codes → ingestion nutrition keys (per 100 g edible portion).
FINELI_COMPONENT_MAP: dict[str, tuple[str, str]] = {
    "ENERC": ("energy_kj", "kJ"),
    "ENERGY": ("energy_kcal", "kcal"),
    "PROT": ("protein_g", "g"),
    "CHOAVL": ("carbohydrates_g", "g"),
    "FAT": ("fat_g", "g"),
    "FASAT": ("saturated_fat_g", "g"),
    "SUGAR": ("sugars_g", "g"),
    "FIBC": ("fiber_g", "g"),
    "NA": ("sodium_mg", "mg"),
    "NACL": ("salt_g", "g"),
}


def _parse_fineli_number(raw: str | None) -> float | None:
    """Fineli CSVs may use comma decimals; empty/missing → None (never invent 0)."""
    if raw is None:
        return None
    text = str(raw).strip()
    if text == "" or text.upper() in {"NA", "NULL", "-", "."}:
        return None
    text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


class FineliDataset:
    """In-memory index built from official Fineli Open Data CSV files."""

    def __init__(self) -> None:
        self.foods: dict[str, dict[str, str]] = {}
        self.values: dict[str, dict[str, float | None]] = {}
        self.component_units: dict[str, str] = {}

    @classmethod
    def from_directory(cls, directory: Path) -> FineliDataset:
        ds = cls()
        food_path = _find_csv(directory, ("food.csv", "FOOD.csv"))
        if food_path is None:
            raise FileNotFoundError(f"Fineli food.csv not found under {directory}")
        ds._load_foods(food_path)
        comp_path = _find_csv(directory, ("component.csv", "COMPONENT.csv"))
        if comp_path is not None:
            ds._load_components(comp_path)
        value_path = _find_csv(
            directory,
            ("component_value.csv", "COMPONENT_VALUE.csv", "componentvalue.csv"),
        )
        if value_path is not None:
            ds._load_values(value_path)
        return ds

    @classmethod
    def from_zip_bytes(cls, data: bytes) -> FineliDataset:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
            ds = cls()
            food_name = next((n for n in names if Path(n).name.lower() == "food.csv"), None)
            if food_name is None:
                raise FileNotFoundError("food.csv missing from Fineli zip")
            with zf.open(food_name) as fh:
                ds._load_foods_text(fh.read().decode("utf-8-sig", errors="replace"))
            for n in names:
                lower = Path(n).name.lower()
                with zf.open(n) as fh:
                    text = fh.read().decode("utf-8-sig", errors="replace")
                if lower == "component.csv":
                    ds._load_components_text(text)
                elif lower in {"component_value.csv", "componentvalue.csv"}:
                    ds._load_values_text(text)
            return ds

    def _load_foods(self, path: Path) -> None:
        self._load_foods_text(path.read_text(encoding="utf-8-sig", errors="replace"))

    def _load_foods_text(self, text: str) -> None:
        reader = csv.DictReader(_csv_stream(text), delimiter=_detect_delimiter(text))
        for row in reader:
            food_id = _row_get(row, ("FOODID", "foodid", "FoodID", "id"))
            if not food_id:
                continue
            self.foods[str(food_id)] = {k: (v or "") for k, v in row.items() if k}

    def _load_components(self, path: Path) -> None:
        self._load_components_text(path.read_text(encoding="utf-8-sig", errors="replace"))

    def _load_components_text(self, text: str) -> None:
        reader = csv.DictReader(_csv_stream(text), delimiter=_detect_delimiter(text))
        for row in reader:
            code = _row_get(row, ("EUFDNAME", "eufdname", "COMPUNIT", "COMPID", "code"))
            unit = _row_get(row, ("COMPUNIT", "unit", "UNIT"))
            # Prefer EUFDNAME as component code when present
            eufd = _row_get(row, ("EUFDNAME", "eufdname"))
            key = eufd or code
            if key and unit:
                self.component_units[key] = unit

    def _load_values(self, path: Path) -> None:
        self._load_values_text(path.read_text(encoding="utf-8-sig", errors="replace"))

    def _load_values_text(self, text: str) -> None:
        reader = csv.DictReader(_csv_stream(text), delimiter=_detect_delimiter(text))
        for row in reader:
            food_id = _row_get(row, ("FOODID", "foodid"))
            comp = _row_get(row, ("EUFDNAME", "eufdname", "COMPID", "compid"))
            raw_val = _row_get(row, ("BESTLOC", "bestloc", "VALUE", "value", "AVG"))
            if not food_id or not comp:
                continue
            bucket = self.values.setdefault(str(food_id), {})
            bucket[comp] = _parse_fineli_number(raw_val)

    def to_source_product(self, food_id: str) -> SourceProduct | None:
        row = self.foods.get(str(food_id))
        if row is None:
            return None
        name = (
            _row_get(row, ("FOODNAME", "foodname", "NAME", "name"))
            or _row_get(row, ("ENGLISH", "english", "ENNAME"))
        )
        name_fi = _row_get(row, ("FOODNAME", "foodname"))
        name_sv = _row_get(row, ("SWEDISH", "swedish", "SVNAME"))
        name_en = _row_get(row, ("ENGLISH", "english", "ENNAME"))
        comps = self.values.get(str(food_id), {})
        nutrition: dict[str, Any] = {"fineli_components": comps}
        for code, (canon, unit) in FINELI_COMPONENT_MAP.items():
            if code in comps and comps[code] is not None:
                nutrition[canon] = comps[code]
                nutrition[f"{canon}_unit"] = unit
        labels = {
            "fi": name_fi,
            "sv": name_sv,
            "en": name_en,
        }
        return SourceProduct(
            source_system="fineli",
            external_id=str(food_id),
            barcode_raw=None,
            name_original=name,
            brand_original=None,
            ingredients_original=None,
            nutrition_original=nutrition,
            nutrition_basis_original="per_100g",
            raw_payload={"food": row, "components": comps, "labels": labels},
            license_tag="CC-BY-4.0",
            attribution_text="Finnish Institute for Health and Welfare (THL), Fineli",
            redistribution_class="cc-by-4.0",
            source_url=f"https://fineli.fi/fineli/en/elintarvikkeet/{food_id}",
            provider_data_version=None,
        )


class FineliAdapter:
    source_system = "fineli"

    def __init__(
        self,
        *,
        dataset: FineliDataset | None = None,
        api_base_url: str = "https://fineli.fi/fineli",
        user_agent: str = "TrackwiseFoodEngine/0.4 (https://trackwise.one)",
        client: httpx.AsyncClient | None = None,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        api_enabled: bool = False,
    ) -> None:
        self._dataset = dataset
        self._api_base = api_base_url.rstrip("/")
        self._user_agent = user_agent
        self._client = client
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._api_enabled = api_enabled

    @property
    def configured(self) -> bool:
        return self._dataset is not None or self._api_enabled

    async def fetch_by_external_id(self, external_id: str) -> SourceProduct | None:
        if self._dataset is not None:
            product = self._dataset.to_source_product(str(external_id))
            if product is not None:
                return product
        if not self._api_enabled:
            return None
        return await self._fetch_api_food(str(external_id))

    async def fetch_by_barcode(self, barcode: str) -> SourceProduct | None:
        # Fineli composition foods are not barcode-keyed.
        _ = barcode
        return None

    async def search(self, query: str, *, page: int = 1, page_size: int = 20) -> SourcePage:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        q = query.strip().lower()
        if self._dataset is not None and q:
            matches: list[SourceProduct] = []
            for food_id, row in self._dataset.foods.items():
                blob = " ".join(row.values()).lower()
                if q in blob:
                    product = self._dataset.to_source_product(food_id)
                    if product is not None:
                        matches.append(product)
            start = (page - 1) * page_size
            slice_ = matches[start : start + page_size]
            next_page = page + 1 if start + page_size < len(matches) else None
            return SourcePage(
                items=slice_,
                page=page,
                page_size=page_size,
                total_hint=len(matches),
                next_page=next_page,
            )
        if not self._api_enabled:
            return SourcePage(items=[], page=page, page_size=page_size)
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        owns = self._client is None
        try:
            data = await request_json(
                client,
                "GET",
                f"{self._api_base}/api/v1/foods",
                headers={"User-Agent": self._user_agent, "Accept": "application/json"},
                params={"q": query},
                max_retries=self._max_retries,
            )
        except ProviderHttpError:
            logger.warning("fineli_api_search_unavailable")
            return SourcePage(items=[], page=page, page_size=page_size)
        finally:
            if owns:
                await client.aclose()
        items: list[SourceProduct] = []
        rows: Iterable[Any]
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            raw = data.get("foods") or data.get("content") or []
            rows = raw if isinstance(raw, list) else []
        else:
            rows = []
        for raw in rows:
            if isinstance(raw, dict) and raw.get("id") is not None:
                mapped = self._map_api_food(raw)
                if mapped is not None:
                    items.append(mapped)
        start = (page - 1) * page_size
        slice_ = items[start : start + page_size]
        return SourcePage(
            items=slice_,
            page=page,
            page_size=page_size,
            total_hint=len(items),
            next_page=page + 1 if start + page_size < len(items) else None,
        )

    async def iter_external_ids(self, *, limit: int | None = None) -> AsyncIterator[str]:
        if self._dataset is None:
            return
        count = 0
        for food_id in self._dataset.foods:
            yield food_id
            count += 1
            if limit is not None and count >= limit:
                return

    async def _fetch_api_food(self, food_id: str) -> SourceProduct | None:
        client = self._client or httpx.AsyncClient(timeout=self._timeout)
        owns = self._client is None
        try:
            data = await request_json(
                client,
                "GET",
                f"{self._api_base}/api/v1/foods/{food_id}",
                headers={"User-Agent": self._user_agent, "Accept": "application/json"},
                max_retries=self._max_retries,
            )
        except ProviderHttpError:
            logger.warning("fineli_api_food_unavailable id=%s", food_id)
            return None
        finally:
            if owns:
                await client.aclose()
        if not isinstance(data, dict):
            return None
        return self._map_api_food(data)

    def _map_api_food(self, data: dict[str, Any]) -> SourceProduct | None:
        food_id = data.get("id")
        if food_id is None:
            return None
        name = None
        labels = data.get("name") or data.get("names")
        if isinstance(labels, dict):
            name = labels.get("fi") or labels.get("en") or labels.get("sv")
        elif isinstance(labels, str):
            name = labels
        name = name or data.get("type") or str(food_id)
        return SourceProduct(
            source_system=self.source_system,
            external_id=str(food_id),
            barcode_raw=None,
            name_original=str(name) if name else None,
            brand_original=None,
            ingredients_original=None,
            nutrition_original={},
            nutrition_basis_original="per_100g",
            raw_payload=data,
            license_tag="CC-BY-4.0",
            attribution_text="Finnish Institute for Health and Welfare (THL), Fineli",
            redistribution_class="cc-by-4.0",
            source_url=f"https://fineli.fi/fineli/en/elintarvikkeet/{food_id}",
        )


def _csv_stream(text: str) -> io.StringIO:
    return io.StringIO(text)


def _detect_delimiter(sample: str) -> str:
    header = sample.splitlines()[0] if sample else ""
    if header.count(";") >= header.count(","):
        return ";"
    return ","


def _find_csv(directory: Path, names: tuple[str, ...]) -> Path | None:
    lower_map = {p.name.lower(): p for p in directory.rglob("*.csv")}
    for name in names:
        hit = lower_map.get(name.lower())
        if hit is not None:
            return hit
    return None


def _row_get(row: dict[str, str], keys: tuple[str, ...]) -> str | None:
    lower = {k.lower(): v for k, v in row.items() if k}
    for key in keys:
        val = lower.get(key.lower())
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return None
