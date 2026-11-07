"""Admin-only Food Intelligence operations."""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.db import get_pool
from app.dependencies.authentication import require_worker
from app.dependencies.authorization import AdminPrincipal, require_admin
from app.ingestion.pipeline import IngestionPipeline
from app.repositories import ingestion as ingest_repo
from app.schemas.foods import (
    CandidateFoodOut,
    ImageReviewRequest,
    ImportJobCreate,
    ImportJobOut,
    PublishRequest,
)
from app.storage.r2 import R2Storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/imports", response_model=ImportJobOut)
async def create_import(
    body: ImportJobCreate,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImportJobOut:
    pipeline = IngestionPipeline(settings)
    job_id = await pipeline.create_pilot_job(
        body.barcodes,
        created_by=UUID(admin.user_id),
    )
    return ImportJobOut(job_id=job_id, status="queued")


@router.post("/imports/{job_id}/run", response_model=ImportJobOut)
async def run_import(
    job_id: UUID,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImportJobOut:
    _ = admin
    pipeline = IngestionPipeline(settings)
    stats = await pipeline.process_job(job_id)
    return ImportJobOut(job_id=job_id, status="succeeded", stats=stats)


@router.get("/imports/{job_id}", response_model=ImportJobOut)
async def get_import(
    job_id: UUID,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> ImportJobOut:
    _ = admin
    pool = get_pool("worker")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "select id, status, checkpoint from public.food_import_jobs where id = $1",
            job_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    stats = row["checkpoint"]
    if isinstance(stats, str):
        stats = json.loads(stats)
    return ImportJobOut(job_id=row["id"], status=row["status"], stats=stats)


@router.get("/candidates", response_model=list[CandidateFoodOut])
async def list_candidates(
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
    limit: int = 50,
) -> list[CandidateFoodOut]:
    _ = admin
    limit = max(1, min(limit, 100))
    pool = get_pool("admin")
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            select f.id as food_id, f.name, f.brand, f.barcode, f.catalog_status,
                   i.id as image_id, i.status as image_status, i.quality_score
            from public.foods f
            left join lateral (
              select id, status, quality_score
              from public.food_images
              where food_id = f.id
              order by created_at desc
              limit 1
            ) i on true
            where f.user_id is null
              and f.catalog_status in ('draft', 'pending_review')
            order by f.updated_at desc nulls last
            limit $1
            """,
            limit,
        )
    return [CandidateFoodOut.model_validate(dict(r)) for r in rows]


@router.post("/foods/{food_id}/publish")
async def publish_food(
    food_id: UUID,
    body: PublishRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    pool = get_pool("admin")
    async with pool.acquire() as conn:
        try:
            await ingest_repo.publish_food_as_admin(
                conn,
                food_id=food_id,
                actor_id=UUID(admin.user_id),
                reason=body.reason,
            )
        except Exception as exc:
            logger.warning("publish_failed food_id=%s", food_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Publish failed",
            ) from exc
    return {"status": "published", "food_id": str(food_id)}


@router.post("/images/{image_id}/approve")
async def approve_image(
    image_id: UUID,
    body: ImageReviewRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    _ = body
    pool = get_pool("admin")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            select id, food_id, status, private_r2_bucket, private_object_key, content_hash
            from public.food_images
            where id = $1
            """,
            image_id,
        )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    if row["status"] == "approved":
        return {"status": "approved", "image_id": str(image_id)}
    if not row["private_object_key"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image has no private object to publish",
        )
    if not settings.r2_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="R2 not configured",
        )

    r2 = R2Storage(settings)
    try:
        blob = r2.get_bytes(kind="private", key=row["private_object_key"])
    except Exception as exc:
        logger.warning("approve_image_private_read_failed image_id=%s", image_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Private image storage unavailable",
        ) from exc

    public_key = f"approved/{row['food_id']}/{image_id}.webp"
    stored = r2.put_bytes(
        kind="public",
        key=public_key,
        body=blob,
        content_type="image/webp",
        metadata={
            "lifecycle": "approved",
            "approved_by": admin.user_id,
        },
    )

    async with pool.acquire() as conn:
        await conn.execute(
            """
            update public.food_images
            set status = 'approved',
                public_object_key = $2,
                public_url = $3,
                updated_at = timezone('utc', now())
            where id = $1
            """,
            image_id,
            stored.key,
            stored.public_url,
        )
        await conn.execute(
            """
            update public.foods
            set image_url = $2, updated_at = timezone('utc', now())
            where id = $1
            """,
            row["food_id"],
            stored.public_url,
        )
    return {
        "status": "approved",
        "image_id": str(image_id),
        "public_url": stored.public_url,
    }


@router.post("/images/{image_id}/reject")
async def reject_image(
    image_id: UUID,
    body: ImageReviewRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    _ = admin
    pool = get_pool("admin")
    async with pool.acquire() as conn:
        updated = await conn.fetchval(
            """
            update public.food_images
            set status = 'rejected',
                attribution_text = coalesce($2, attribution_text),
                updated_at = timezone('utc', now())
            where id = $1
            returning id
            """,
            image_id,
            body.reason,
        )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return {"status": "rejected", "image_id": str(image_id)}


@router.post("/worker/imports/{job_id}/run", response_model=ImportJobOut)
async def worker_run_import(
    job_id: UUID,
    settings: Annotated[Settings, Depends(get_settings)],
    _worker: Annotated[dict[str, str], Depends(require_worker)],
) -> ImportJobOut:
    pipeline = IngestionPipeline(settings)
    stats = await pipeline.process_job(job_id)
    return ImportJobOut(job_id=job_id, status="succeeded", stats=stats)
