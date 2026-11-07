"""Catalog reads via food_engine_app pool (published only under RLS)."""

from __future__ import annotations

import uuid
from typing import Any

import asyncpg

from app.domain.barcodes import normalize_barcode


async def get_food_by_id(conn: asyncpg.Connection, food_id: uuid.UUID) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        select id, name, brand, barcode, serving_label, serving_grams,
               calories, protein_g, carbs_g, fat_g, source, image_url,
               is_public, catalog_status, nutrition_basis, basis_unit, basis_amount,
               published_at, created_at, updated_at
        from public.foods
        where id = $1
        """,
        food_id,
    )
    return dict(row) if row else None


async def get_food_by_barcode(conn: asyncpg.Connection, barcode: str) -> dict[str, Any] | None:
    normalized = normalize_barcode(barcode)
    if not normalized:
        return None
    row = await conn.fetchrow(
        """
        select f.id, f.name, f.brand, f.barcode, f.serving_label, f.serving_grams,
               f.calories, f.protein_g, f.carbs_g, f.fat_g, f.source, f.image_url,
               f.is_public, f.catalog_status, f.nutrition_basis, f.basis_unit, f.basis_amount,
               f.published_at, f.created_at, f.updated_at
        from public.food_barcodes b
        join public.foods f on f.id = b.food_id
        where b.barcode_normalized = $1 and b.is_active
        order by case when b.scope = 'catalog' then 0 else 1 end, b.is_primary desc
        limit 1
        """,
        normalized,
    )
    return dict(row) if row else None


async def list_foods(
    conn: asyncpg.Connection,
    *,
    limit: int = 20,
    offset: int = 0,
    catalog_status: str | None = None,
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    if catalog_status:
        rows = await conn.fetch(
            """
            select id, name, brand, barcode, image_url, catalog_status, calories, protein_g, carbs_g, fat_g
            from public.foods
            where catalog_status = $3
            order by updated_at desc nulls last, name
            limit $1 offset $2
            """,
            limit,
            offset,
            catalog_status,
        )
    else:
        rows = await conn.fetch(
            """
            select id, name, brand, barcode, image_url, catalog_status, calories, protein_g, carbs_g, fat_g
            from public.foods
            order by updated_at desc nulls last, name
            limit $1 offset $2
            """,
            limit,
            offset,
        )
    return [dict(r) for r in rows]


async def search_foods(
    conn: asyncpg.Connection,
    *,
    query: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    pattern = f"%{query.strip()}%"
    rows = await conn.fetch(
        """
        select id, name, brand, barcode, image_url, catalog_status, calories, protein_g, carbs_g, fat_g
        from public.foods
        where name ilike $1 or coalesce(brand, '') ilike $1
        order by name
        limit $2 offset $3
        """,
        pattern,
        limit,
        offset,
    )
    return [dict(r) for r in rows]


async def list_nutrition(conn: asyncpg.Connection, food_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        select nutrient_code, basis, serving_uid, value, value_status, unit, is_manual_override
        from public.food_nutrition_facts
        where food_id = $1
        order by nutrient_code, basis
        """,
        food_id,
    )
    return [dict(r) for r in rows]


async def list_servings(conn: asyncpg.Connection, food_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        select id, label, grams, ml, is_default
        from public.food_servings
        where food_id = $1
        order by is_default desc, label
        """,
        food_id,
    )
    return [dict(r) for r in rows]


async def list_images(conn: asyncpg.Connection, food_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        select id, status, public_url, content_hash, quality_score
        from public.food_images
        where food_id = $1 and status = 'approved' and public_url is not null
        order by created_at desc
        """,
        food_id,
    )
    return [dict(r) for r in rows]
