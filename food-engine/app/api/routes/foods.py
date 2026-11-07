"""Published catalog REST API (food_engine_app pool)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.core.db import get_pool
from app.repositories import catalog
from app.schemas.foods import (
    FoodDetail,
    FoodSummary,
    ImageOut,
    NutritionFactOut,
    ServingOut,
)

router = APIRouter(prefix="/foods", tags=["foods"])


@router.get("", response_model=list[FoodSummary])
async def list_foods(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
    catalog_status: Annotated[str | None, Query(max_length=32)] = None,
) -> list[FoodSummary]:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        rows = await catalog.list_foods(
            conn, limit=limit, offset=offset, catalog_status=catalog_status
        )
    return [FoodSummary.model_validate(r) for r in rows]


@router.get("/search", response_model=list[FoodSummary])
async def search_foods(
    q: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
) -> list[FoodSummary]:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        rows = await catalog.search_foods(conn, query=q, limit=limit, offset=offset)
    return [FoodSummary.model_validate(r) for r in rows]


@router.get("/barcode/{barcode}", response_model=FoodDetail)
async def food_by_barcode(barcode: str) -> FoodDetail:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        row = await catalog.get_food_by_barcode(conn, barcode)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    return FoodDetail.model_validate(row)


@router.get("/{food_id}", response_model=FoodDetail)
async def food_by_id(food_id: UUID) -> FoodDetail:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        row = await catalog.get_food_by_id(conn, food_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    return FoodDetail.model_validate(row)


@router.get("/{food_id}/nutrition", response_model=list[NutritionFactOut])
async def food_nutrition(food_id: UUID) -> list[NutritionFactOut]:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        food = await catalog.get_food_by_id(conn, food_id)
        if not food:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
        rows = await catalog.list_nutrition(conn, food_id)
    return [NutritionFactOut.model_validate(r) for r in rows]


@router.get("/{food_id}/servings", response_model=list[ServingOut])
async def food_servings(food_id: UUID) -> list[ServingOut]:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        food = await catalog.get_food_by_id(conn, food_id)
        if not food:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
        rows = await catalog.list_servings(conn, food_id)
    return [ServingOut.model_validate(r) for r in rows]


@router.get("/{food_id}/images", response_model=list[ImageOut])
async def food_images(food_id: UUID) -> list[ImageOut]:
    pool = get_pool("app")
    async with pool.acquire() as conn:
        food = await catalog.get_food_by_id(conn, food_id)
        if not food:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
        rows = await catalog.list_images(conn, food_id)
    return [ImageOut.model_validate(r) for r in rows]
