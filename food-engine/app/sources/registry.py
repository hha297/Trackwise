"""Provider registry — construct enabled adapters from settings."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.sources.base import ProviderStatus, SourceAdapter
from app.sources.fineli import FineliAdapter, FineliDataset
from app.sources.open_food_facts import OpenFoodFactsAdapter
from app.sources.usda import UsdaFdcAdapter

logger = logging.getLogger(__name__)

KNOWN_PROVIDERS = ("open_food_facts", "fineli", "usda")


def build_provider_registry(settings: Settings) -> dict[str, Any]:
    """Return mapping of provider name → adapter instance (may be disabled)."""
    registry: dict[str, Any] = {}

    if settings.off_enabled:
        registry["open_food_facts"] = OpenFoodFactsAdapter(
            base_url=settings.off_base_url,
            user_agent=settings.off_user_agent,
            timeout_seconds=settings.provider_timeout_seconds,
            max_retries=settings.provider_max_retries,
        )

    fineli_dataset = None
    if settings.fineli_dataset_path:
        path = Path(settings.fineli_dataset_path)
        try:
            if path.is_file() and path.suffix.lower() == ".zip":
                fineli_dataset = FineliDataset.from_zip_bytes(path.read_bytes())
            elif path.is_dir():
                fineli_dataset = FineliDataset.from_directory(path)
            else:
                logger.warning("fineli_dataset_path_invalid path=%s", path.name)
        except Exception:
            logger.exception("fineli_dataset_load_failed")

    if settings.fineli_enabled:
        registry["fineli"] = FineliAdapter(
            dataset=fineli_dataset,
            api_base_url=settings.fineli_api_base_url,
            user_agent=settings.off_user_agent,
            timeout_seconds=settings.provider_timeout_seconds,
            max_retries=settings.provider_max_retries,
            api_enabled=settings.fineli_api_enabled,
        )

    if settings.usda_enabled:
        registry["usda"] = UsdaFdcAdapter(
            api_key=settings.usda_fdc_api_key,
            base_url=settings.usda_fdc_base_url,
            timeout_seconds=settings.provider_timeout_seconds,
            max_retries=settings.provider_max_retries,
        )

    return registry


def get_adapter(registry: dict[str, Any], provider: str) -> SourceAdapter:
    adapter = registry.get(provider)
    if adapter is None:
        raise KeyError(f"Provider not registered or disabled: {provider}")
    if provider == "usda" and hasattr(adapter, "configured") and not adapter.configured:
        raise KeyError("USDA provider is not configured (missing API key)")
    if provider == "fineli" and hasattr(adapter, "configured") and not adapter.configured:
        raise KeyError("Fineli provider is not configured (dataset/API unavailable)")
    return adapter  # type: ignore[no-any-return]


def provider_statuses(settings: Settings, registry: dict[str, Any]) -> list[ProviderStatus]:
    statuses: list[ProviderStatus] = []
    for name in KNOWN_PROVIDERS:
        enabled_flag = {
            "open_food_facts": settings.off_enabled,
            "fineli": settings.fineli_enabled,
            "usda": settings.usda_enabled,
        }[name]
        adapter = registry.get(name)
        configured = False
        detail: str | None = None
        if name == "open_food_facts":
            configured = adapter is not None
        elif name == "fineli":
            configured = bool(adapter and getattr(adapter, "configured", False))
            if settings.fineli_enabled and not configured:
                detail = "Set FINELI_DATASET_PATH or enable FINELI_API_ENABLED"
            if settings.fineli_api_enabled:
                detail = (detail + "; " if detail else "") + "API may be Cloudflare-blocked"
        elif name == "usda":
            configured = bool(settings.usda_fdc_api_key)
            if settings.usda_enabled and not configured:
                detail = "Set USDA_FDC_API_KEY"
        statuses.append(
            ProviderStatus(
                provider=name,
                enabled=enabled_flag,
                configured=configured,
                detail=detail,
            )
        )
    return statuses
