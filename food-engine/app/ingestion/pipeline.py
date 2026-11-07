"""Controlled ingestion pipeline — workers never publish."""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import httpx

from app.core.config import Settings
from app.core.db import get_pool
from app.domain.barcodes import normalize_barcode
from app.domain.nutrition import facts_from_off_nutriments
from app.repositories import ingestion as repo
from app.sources.open_food_facts import OpenFoodFactsAdapter
from app.storage.images import validate_and_normalize
from app.storage.r2 import R2Storage

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._off = OpenFoodFactsAdapter(
            base_url=settings.off_base_url,
            user_agent=settings.off_user_agent,
        )
        self._r2 = R2Storage(settings) if settings.r2_configured else None

    async def create_pilot_job(
        self,
        barcodes: list[str],
        *,
        created_by: uuid.UUID | None = None,
    ) -> uuid.UUID:
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            job_id = await repo.create_import_job(
                conn, source_system="open_food_facts", created_by=created_by
            )
            for code in barcodes[: self._settings.ingest_pilot_batch_size]:
                await repo.add_job_item(
                    conn,
                    job_id=job_id,
                    external_id=normalize_barcode(code) or code,
                    content_hash=None,
                )
            await conn.execute(
                """
                update public.food_import_jobs
                set status = 'running', started_at = timezone('utc', now())
                where id = $1
                """,
                job_id,
            )
            return job_id

    async def process_job(self, job_id: uuid.UUID) -> dict[str, Any]:
        pool = get_pool("worker")
        stats = {"succeeded": 0, "failed": 0, "skipped": 0}
        delay = 1.0 / max(self._settings.ingest_rate_limit_per_second, 0.1)

        while True:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    item = await repo.claim_next_job_item(conn, job_id)
            if item is None:
                break

            item_id: uuid.UUID = item["id"]
            external_id: str = item["external_id"]
            try:
                outcome = await self._process_item(item_id, external_id)
                stats[outcome] += 1
            except Exception as exc:
                logger.exception("ingest_item_failed item=%s", item_id)
                async with pool.acquire() as conn:
                    await repo.mark_item(
                        conn,
                        item_id,
                        status="failed",
                        error={"error": type(exc).__name__, "message": str(exc)[:500]},
                    )
                stats["failed"] += 1
            await asyncio.sleep(delay)

        # Partial success stays succeeded + checkpoint (queued|running|succeeded|failed|cancelled).
        job_status = "failed" if stats["failed"] and not stats["succeeded"] else "succeeded"

        async with pool.acquire() as conn:
            await conn.execute(
                """
                update public.food_import_jobs
                set status = $3, finished_at = timezone('utc', now()),
                    checkpoint = $2::jsonb
                where id = $1
                """,
                job_id,
                __import__("json").dumps(stats),
                job_status,
            )
        return stats

    async def _process_item(self, item_id: uuid.UUID, external_id: str) -> str:
        product = await self._off.fetch_by_barcode(external_id)
        if product is None:
            pool = get_pool("worker")
            async with pool.acquire() as conn:
                await repo.mark_item(
                    conn, item_id, status="skipped", error={"reason": "not_found"}
                )
            return "skipped"

        facts = facts_from_off_nutriments(product.nutrition_original)
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            async with conn.transaction():
                observation_id = await repo.insert_observation(
                    conn, product, import_job_item_id=item_id
                )
                await repo.ensure_processing_row(conn, observation_id)

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
                await repo.mark_item(
                    conn, item_id, status="succeeded", observation_id=observation_id
                )

        # Image candidates are best-effort; missing private R2 must not fail the food draft.
        if self._r2 and product.image_urls:
            try:
                await self._store_candidate_image(food_id, product.image_urls[0], observation_id)
            except Exception as exc:
                # Private bucket may be missing until ops creates it; food draft still succeeds.
                logger.warning(
                    "candidate_image_store_failed food_id=%s observation_id=%s err=%s",
                    food_id,
                    observation_id,
                    type(exc).__name__,
                )

        return "succeeded"

    async def _store_candidate_image(
        self,
        food_id: uuid.UUID,
        url: str,
        observation_id: uuid.UUID,
    ) -> None:
        assert self._r2 is not None
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers={"User-Agent": self._settings.off_user_agent})
            if resp.status_code != 200:
                return
            data = resp.content
        result = validate_and_normalize(
            data,
            max_bytes=self._settings.image_max_bytes,
            min_dim=self._settings.image_min_dimension,
            max_dim=self._settings.image_max_dimension,
            declared_content_type=resp.headers.get("content-type"),
            identity_confidence=0.5,
        )
        if not result.ok or not result.normalized_webp:
            return
        key = f"candidates/{food_id}/{observation_id}.webp"
        stored = self._r2.put_bytes(
            kind="private",
            key=key,
            body=result.normalized_webp,
            content_type="image/webp",
            metadata={"lifecycle": "candidate", "source": "open_food_facts"},
        )
        pool = get_pool("worker")
        async with pool.acquire() as conn:
            await conn.execute(
                """
                insert into public.food_images (
                  food_id, status, private_r2_bucket, private_object_key,
                  content_hash, quality_score, source_observation_id
                ) values ($1, 'candidate', $2, $3, $4, $5, $6)
                """,
                food_id,
                stored.bucket,
                stored.key,
                result.content_hash,
                result.technical_score,
                observation_id,
            )
