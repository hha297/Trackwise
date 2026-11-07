"""Multi-provider ingestion pipeline — workers never publish; Phase 4 skips images by default."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from app.core.config import Settings
from app.core.db import get_pool
from app.domain.barcodes import normalize_barcode
from app.domain.nutrition import facts_from_mapped_nutrition, facts_from_off_nutriments
from app.repositories import ingestion as repo
from app.sources.base import SourceAdapter, SourceProduct
from app.sources.http_retry import ProviderHttpError
from app.sources.registry import build_provider_registry, get_adapter

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._registry = build_provider_registry(settings)

    def adapter_for(self, provider: str) -> SourceAdapter:
        return get_adapter(self._registry, provider)

    async def create_job(
        self,
        *,
        provider: str,
        external_ids: list[str],
        created_by: uuid.UUID | None = None,
    ) -> uuid.UUID:
        # Ensure provider is registered before creating a job.
        self.adapter_for(provider)
        limit = min(len(external_ids), self._settings.ingest_batch_max_size)
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            job_id = await repo.create_import_job(
                conn, source_system=provider, created_by=created_by
            )
            for external_id in external_ids[:limit]:
                cleaned = (
                    normalize_barcode(external_id) if provider == "open_food_facts" else None
                ) or external_id.strip()
                if not cleaned:
                    continue
                await repo.add_job_item(
                    conn,
                    job_id=job_id,
                    external_id=cleaned,
                    content_hash=None,
                )
            # Remain queued until process_job starts (create ≠ run).
            return job_id

    async def create_pilot_job(
        self,
        barcodes: list[str],
        *,
        created_by: uuid.UUID | None = None,
    ) -> uuid.UUID:
        """Backward-compatible OFF barcode pilot entrypoint."""
        return await self.create_job(
            provider="open_food_facts",
            external_ids=barcodes[: self._settings.ingest_pilot_batch_size],
            created_by=created_by,
        )

    async def process_job(self, job_id: uuid.UUID) -> dict[str, Any]:
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            job = await conn.fetchrow(
                "select id, source_system from public.food_import_jobs where id = $1",
                job_id,
            )
            if job is None:
                raise ValueError("Import job not found")
            provider = str(job["source_system"])
            reclaimed = await repo.reclaim_stale_running_items(conn, job_id)
            if reclaimed:
                logger.warning(
                    "ingest_reclaimed_stale_items job_id=%s count=%s", job_id, reclaimed
                )

        adapter = self.adapter_for(provider)
        started = time.perf_counter()
        delay = 1.0 / max(self._settings.ingest_rate_limit_per_second, 0.1)
        processed_locally = 0

        async with pool.acquire() as conn:
            await conn.execute(
                """
                update public.food_import_jobs
                set status = 'running',
                    started_at = coalesce(started_at, timezone('utc', now())),
                    updated_at = timezone('utc', now())
                where id = $1
                """,
                job_id,
            )

        while True:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    item = await repo.claim_next_job_item(conn, job_id)
            if item is None:
                break

            processed_locally += 1
            item_id: uuid.UUID = item["id"]
            external_id: str = item["external_id"]
            try:
                await self._process_item(adapter, item_id, external_id)
            except Exception as exc:
                logger.exception("ingest_item_failed item=%s provider=%s", item_id, provider)
                async with pool.acquire() as conn:
                    await repo.mark_item(
                        conn,
                        item_id,
                        status="failed",
                        error={"error": type(exc).__name__, "message": str(exc)[:500]},
                    )
            await asyncio.sleep(delay)

        duration_ms = int((time.perf_counter() - started) * 1000)
        async with pool.acquire() as conn:
            job_status, checkpoint = await repo.finalize_import_job(
                conn,
                job_id,
                provider=provider,
                duration_ms=duration_ms,
            )
        checkpoint["processed_locally"] = processed_locally
        checkpoint["status"] = job_status
        return checkpoint

    async def ingest_single(
        self,
        *,
        provider: str,
        external_id: str,
        created_by: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        job_id = await self.create_job(
            provider=provider,
            external_ids=[external_id],
            created_by=created_by,
        )
        stats = await self.process_job(job_id)
        return {"job_id": str(job_id), **stats}

    async def _process_item(
        self,
        adapter: SourceAdapter,
        item_id: uuid.UUID,
        external_id: str,
    ) -> str:
        try:
            product = await adapter.fetch_by_external_id(external_id)
        except ProviderHttpError as exc:
            pool = get_pool("worker")
            async with pool.acquire() as conn:
                await repo.mark_item(
                    conn,
                    item_id,
                    status="failed",
                    error={
                        "error": type(exc).__name__,
                        "message": str(exc)[:500],
                        "status_code": getattr(exc, "status_code", None),
                    },
                )
            return "failed"

        if product is None:
            pool = get_pool("worker")
            async with pool.acquire() as conn:
                await repo.mark_item(
                    conn, item_id, status="skipped", error={"reason": "not_found"}
                )
            return "skipped"

        content_hash = repo.payload_hash(product.raw_payload or product.nutrition_original)
        facts = _facts_for_product(product)
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            async with conn.transaction():
                existing = await repo.find_observation_by_content_hash(
                    conn,
                    source_system=product.source_system,
                    external_id=product.external_id,
                    content_hash=content_hash,
                )
                if existing is not None:
                    await repo.mark_item(
                        conn,
                        item_id,
                        status="skipped",
                        observation_id=existing,
                        error={"reason": "duplicate_content_hash"},
                    )
                    return "skipped"

                observation_id, created = await repo.insert_observation(
                    conn, product, import_job_item_id=item_id
                )
                if not created:
                    await repo.mark_item(
                        conn,
                        item_id,
                        status="skipped",
                        observation_id=observation_id,
                        error={"reason": "duplicate_content_hash_race"},
                    )
                    return "skipped"

                await repo.ensure_processing_row(conn, observation_id)
                await self._associate_draft(conn, product, facts, observation_id)
                await repo.mark_item(
                    conn, item_id, status="succeeded", observation_id=observation_id
                )

        # Phase 4: do not download images unless explicitly enabled (default false).
        if self._settings.ingest_download_images:
            logger.info("ingest_images_flag_enabled_but_phase4_pipeline_skips_download")

        return "succeeded"

    async def _associate_draft(
        self,
        conn: Any,
        product: SourceProduct,
        facts: list[Any],
        observation_id: uuid.UUID,
    ) -> None:
        """Link observation to an existing catalog food or create a draft. Never mutates published."""
        barcode_norm = normalize_barcode(product.barcode_raw)
        food_id = None
        if barcode_norm:
            food_id = await repo.find_catalog_food_by_barcode(conn, barcode_norm)

        if food_id is None:
            food_id = await repo.create_draft_food_from_source(conn, product, facts)
            link_role = "accepted"
        else:
            link_role = "candidate"

        await repo.link_observation(
            conn,
            observation_id=observation_id,
            food_id=food_id,
            link_role=link_role,
        )


def _facts_for_product(product: SourceProduct) -> list[Any]:
    if product.source_system == "open_food_facts":
        return facts_from_off_nutriments(product.nutrition_original)
    return facts_from_mapped_nutrition(product.nutrition_original)


def _job_status_from_stats(stats: dict[str, Any]) -> str:
    """Backward-compatible helper used by unit tests / thin API wrappers."""
    return repo.job_status_from_counts(
        {
            "failed": int(stats.get("failed", 0) or 0),
            "succeeded": int(stats.get("succeeded", 0) or 0),
            "skipped": int(stats.get("skipped", 0) or 0),
        }
    )
