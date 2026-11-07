"""Worker-role ingestion writes — draft/pending only; never publish."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any, cast

import asyncpg

from app.domain.barcodes import normalize_barcode
from app.domain.names import display_name_preserved, normalize_search_name
from app.domain.nutrition import NutrientFact
from app.sources.base import SourceProduct


async def create_import_job(
    conn: asyncpg.Connection,
    *,
    source_system: str,
    created_by: uuid.UUID | None = None,
) -> uuid.UUID:
    return cast(
        uuid.UUID,
        await conn.fetchval(
            """
            insert into public.food_import_jobs (source_system, status, created_by)
            values ($1, 'queued', $2)
            returning id
            """,
            source_system,
            created_by,
        ),
    )


async def add_job_item(
    conn: asyncpg.Connection,
    *,
    job_id: uuid.UUID,
    external_id: str | None,
    content_hash: str | None,
) -> uuid.UUID | None:
    try:
        return cast(
            uuid.UUID,
            await conn.fetchval(
                """
                insert into public.food_import_job_items (job_id, external_id, content_hash, status)
                values ($1, $2, $3, 'queued')
                returning id
                """,
                job_id,
                external_id,
                content_hash,
            ),
        )
    except asyncpg.UniqueViolationError:
        return None


async def claim_job_item(conn: asyncpg.Connection, item_id: uuid.UUID) -> bool:
    """Atomically claim a specific queued item (safe under concurrent workers)."""
    row = await conn.fetchrow(
        """
        update public.food_import_job_items
        set status = 'running', updated_at = timezone('utc', now())
        where id = $1 and status = 'queued'
        returning id
        """,
        item_id,
    )
    return row is not None


async def claim_next_job_item(
    conn: asyncpg.Connection, job_id: uuid.UUID
) -> asyncpg.Record | None:
    """
    Atomically claim the next queued item for a job.

    Uses FOR UPDATE SKIP LOCKED so concurrent workers never process the same row.
    """
    return await conn.fetchrow(
        """
        with next_item as (
          select id
          from public.food_import_job_items
          where job_id = $1 and status = 'queued'
          order by created_at
          for update skip locked
          limit 1
        )
        update public.food_import_job_items as items
        set status = 'running', updated_at = timezone('utc', now())
        from next_item
        where items.id = next_item.id
        returning items.id, items.external_id
        """,
        job_id,
    )


def payload_hash(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


async def find_observation_by_content_hash(
    conn: asyncpg.Connection,
    *,
    source_system: str,
    external_id: str,
    content_hash: str,
) -> uuid.UUID | None:
    """Idempotency: reuse existing observation when content is unchanged."""
    value = await conn.fetchval(
        """
        select id
        from public.food_source_observations
        where source_system = $1
          and external_id = $2
          and content_hash = $3
        order by created_at desc
        limit 1
        """,
        source_system,
        external_id,
        content_hash,
    )
    return cast(uuid.UUID | None, value)


async def insert_observation(
    conn: asyncpg.Connection,
    product: SourceProduct,
    *,
    import_job_item_id: uuid.UUID | None,
) -> tuple[uuid.UUID, bool]:
    """
    Insert an append-only observation.

    Returns (observation_id, created). Concurrent identical payloads collapse via
    unique index + UniqueViolation → (existing_id, False).
    """
    content = payload_hash(product.raw_payload or product.nutrition_original)
    try:
        observation_id = await _insert_observation_row(
            conn, product, content_hash=content, import_job_item_id=import_job_item_id
        )
        return observation_id, True
    except asyncpg.UniqueViolationError:
        existing = await find_observation_by_content_hash(
            conn,
            source_system=product.source_system,
            external_id=product.external_id,
            content_hash=content,
        )
        if existing is None:
            raise
        return existing, False


async def _insert_observation_row(
    conn: asyncpg.Connection,
    product: SourceProduct,
    *,
    content_hash: str,
    import_job_item_id: uuid.UUID | None,
) -> uuid.UUID:
    # Prefer extended columns when migration applied; fall back for older DBs.
    try:
        return cast(
            uuid.UUID,
            await conn.fetchval(
                """
                insert into public.food_source_observations (
                  source_system, external_id, observation_version, content_hash,
                  barcode_raw, barcode_normalized, name_original, brand_original,
                  ingredients_original, nutrition_original, nutrition_basis_original,
                  license_tag, attribution_text, redistribution_class,
                  import_job_item_id, retrieved_at,
                  raw_payload, source_url, provider_data_version
                ) values (
                  $1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14, timezone('utc', now()),
                  $15::jsonb,$16,$17
                )
                returning id
                """,
                product.source_system,
                product.external_id,
                content_hash,
                product.barcode_raw,
                normalize_barcode(product.barcode_raw),
                display_name_preserved(product.name_original),
                display_name_preserved(product.brand_original),
                product.ingredients_original,
                json.dumps(product.nutrition_original),
                product.nutrition_basis_original,
                product.license_tag,
                product.attribution_text,
                product.redistribution_class,
                import_job_item_id,
                json.dumps(product.raw_payload or {}),
                product.source_url,
                product.provider_data_version,
            ),
        )
    except asyncpg.UndefinedColumnError:
        return cast(
            uuid.UUID,
            await conn.fetchval(
                """
                insert into public.food_source_observations (
                  source_system, external_id, observation_version, content_hash,
                  barcode_raw, barcode_normalized, name_original, brand_original,
                  ingredients_original, nutrition_original, nutrition_basis_original,
                  license_tag, attribution_text, redistribution_class,
                  import_job_item_id, retrieved_at
                ) values (
                  $1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14, timezone('utc', now())
                )
                returning id
                """,
                product.source_system,
                product.external_id,
                content_hash,
                product.barcode_raw,
                normalize_barcode(product.barcode_raw),
                display_name_preserved(product.name_original),
                display_name_preserved(product.brand_original),
                product.ingredients_original,
                json.dumps(product.nutrition_original),
                product.nutrition_basis_original,
                product.license_tag,
                product.attribution_text,
                product.redistribution_class,
                import_job_item_id,
            ),
        )


async def reclaim_stale_running_items(
    conn: asyncpg.Connection,
    job_id: uuid.UUID,
    *,
    stale_after_seconds: int = 900,
) -> int:
    """Re-queue items stuck in running after worker crash / interrupt."""
    stale_after_seconds = max(60, stale_after_seconds)
    value = await conn.fetchval(
        """
        with updated as (
          update public.food_import_job_items
          set status = 'queued',
              updated_at = timezone('utc', now()),
              error_payload = coalesce(error_payload, '{}'::jsonb)
                || jsonb_build_object('reclaimed', true)
          where job_id = $1
            and status = 'running'
            and updated_at < timezone('utc', now()) - make_interval(secs => $2)
          returning id
        )
        select count(*)::int from updated
        """,
        job_id,
        stale_after_seconds,
    )
    return int(value or 0)


async def count_job_item_stats(
    conn: asyncpg.Connection, job_id: uuid.UUID
) -> dict[str, int]:
    rows = await conn.fetch(
        """
        select status, count(*)::int as n
        from public.food_import_job_items
        where job_id = $1
        group by status
        """,
        job_id,
    )
    stats = {
        "queued": 0,
        "running": 0,
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "discovered": 0,
    }
    for row in rows:
        key = str(row["status"])
        n = int(row["n"])
        if key in stats:
            stats[key] = n
        stats["discovered"] += n
    return stats


async def finalize_import_job(
    conn: asyncpg.Connection,
    job_id: uuid.UUID,
    *,
    provider: str,
    duration_ms: int,
) -> tuple[str, dict[str, Any]]:
    """
    Finalize job status from durable item counts (safe under concurrent workers).

    Leaves job as running when queued/running items remain.
    """
    counts = await count_job_item_stats(conn, job_id)
    checkpoint: dict[str, Any] = {
        "provider": provider,
        "discovered": counts["discovered"],
        "succeeded": counts["succeeded"],
        "failed": counts["failed"],
        "skipped": counts["skipped"],
        "queued": counts["queued"],
        "running": counts["running"],
        "duration_ms": duration_ms,
    }
    if counts["queued"] > 0 or counts["running"] > 0:
        job_status = "running"
        await conn.execute(
            """
            update public.food_import_jobs
            set status = 'running',
                checkpoint = $2::jsonb,
                updated_at = timezone('utc', now())
            where id = $1
            """,
            job_id,
            json.dumps(checkpoint),
        )
        return job_status, checkpoint

    job_status = job_status_from_counts(counts)
    await conn.execute(
        """
        update public.food_import_jobs
        set status = $3,
            finished_at = timezone('utc', now()),
            checkpoint = $2::jsonb
        where id = $1
        """,
        job_id,
        json.dumps(checkpoint),
        job_status,
    )
    return job_status, checkpoint


def job_status_from_counts(counts: dict[str, int]) -> str:
    failed = int(counts.get("failed", 0))
    succeeded = int(counts.get("succeeded", 0))
    if failed and succeeded:
        return "partial"
    if failed and not succeeded:
        return "failed"
    # all succeeded, all skipped, or empty job → succeeded (no failures)
    return "succeeded"


async def ensure_processing_row(conn: asyncpg.Connection, observation_id: uuid.UUID) -> None:
    await conn.execute(
        """
        insert into public.food_source_observation_processing (observation_id)
        values ($1)
        on conflict (observation_id) do nothing
        """,
        observation_id,
    )


async def find_catalog_food_by_barcode(
    conn: asyncpg.Connection, barcode_normalized: str
) -> uuid.UUID | None:
    value = await conn.fetchval(
        """
        select food_id from public.food_barcodes
        where barcode_normalized = $1 and scope = 'catalog' and is_active
        limit 1
        """,
        barcode_normalized,
    )
    return cast(uuid.UUID | None, value)


async def create_draft_food_from_source(
    conn: asyncpg.Connection,
    product: SourceProduct,
    facts: list[NutrientFact],
) -> uuid.UUID:
    name = display_name_preserved(product.name_original) or "Unknown product"
    brand = display_name_preserved(product.brand_original)
    barcode = product.barcode_raw

    def macro(code: str) -> float | None:
        """Legacy foods.* columns: measured/zero only — never invent missing as zero."""
        for f in facts:
            if f.nutrient_code != code:
                continue
            if f.value_status == "measured" and f.value is not None:
                return float(f.value)
            if f.value_status == "zero":
                return 0.0
        return None

    norm = normalize_barcode(barcode)
    if norm:
        existing = await find_catalog_food_by_barcode(conn, norm)
        if existing is not None:
            return existing

    food_id = cast(
        uuid.UUID,
        await conn.fetchval(
            """
            insert into public.foods (
              user_id, name, brand, barcode, source, catalog_status,
              calories, protein_g, carbs_g, fat_g,
              nutrition_basis, basis_unit, basis_amount
            ) values (
              null, $1, $2, $3, $8, 'draft',
              coalesce($4, 0), coalesce($5, 0), coalesce($6, 0), coalesce($7, 0),
              'per100', 'g', 100
            )
            returning id
            """,
            name,
            brand,
            barcode,
            macro("energy_kcal"),
            macro("protein_g"),
            macro("carbohydrates_g"),
            macro("fat_g"),
            product.source_system,
        ),
    )

    if norm:
        try:
            await conn.execute(
                """
                insert into public.food_barcodes (
                  food_id, barcode_raw, barcode_normalized, is_primary, scope, owner_user_id, is_active
                ) values ($1, $2, $3, true, 'catalog', null, true)
                """,
                food_id,
                barcode,
                norm,
            )
        except asyncpg.UniqueViolationError:
            # Concurrent draft won the barcode race — use the existing catalog food.
            existing = await find_catalog_food_by_barcode(conn, norm)
            if existing is not None:
                return existing
            raise

    search = normalize_search_name(name)
    if search:
        await conn.execute(
            """
            insert into public.food_names (
              food_id, locale, name_original, name_normalized, is_primary, name_kind
            ) values ($1, 'und', $2, $3, true, 'primary')
            on conflict (food_id, locale, name_normalized) do nothing
            """,
            food_id,
            name,
            search,
        )

    for fact in facts:
        try:
            await conn.execute(
                """
                insert into public.food_nutrition_facts (
                  food_id, nutrient_code, basis, serving_uid, value, value_status, unit
                ) values ($1, $2, $3, null, $4, $5, $6)
                """,
                food_id,
                fact.nutrient_code,
                fact.basis,
                float(fact.value) if fact.value is not None else None,
                fact.value_status,
                fact.unit,
            )
        except asyncpg.UniqueViolationError:
            continue

    if product.ingredients_original:
        await conn.execute(
            """
            insert into public.food_ingredients (food_id, position, ingredient_text)
            values ($1, 0, $2)
            """,
            food_id,
            product.ingredients_original[:4000],
        )

    return food_id


async def link_observation(
    conn: asyncpg.Connection,
    *,
    observation_id: uuid.UUID,
    food_id: uuid.UUID,
    link_role: str,
) -> None:
    await conn.execute(
        """
        insert into public.food_observation_links (observation_id, food_id, link_role)
        values ($1, $2, $3)
        on conflict do nothing
        """,
        observation_id,
        food_id,
        link_role,
    )


async def mark_item(
    conn: asyncpg.Connection,
    item_id: uuid.UUID,
    *,
    status: str,
    observation_id: uuid.UUID | None = None,
    error: dict[str, Any] | None = None,
) -> None:
    await conn.execute(
        """
        update public.food_import_job_items
        set status = $2,
            observation_id = coalesce($3, observation_id),
            error_payload = coalesce($4::jsonb, error_payload),
            updated_at = timezone('utc', now())
        where id = $1
        """,
        item_id,
        status,
        observation_id,
        json.dumps(error) if error else None,
    )


async def publish_food_as_admin(
    conn: asyncpg.Connection,
    *,
    food_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: str | None = None,
) -> None:
    """Must be called on food_engine_admin pool."""
    await conn.fetchval(
        "select public.publish_food_for_service($1, $2, $3)",
        food_id,
        actor_id,
        reason,
    )
