"""API schemas for catalog endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FoodSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str
    brand: str | None = None
    barcode: str | None = None
    image_url: str | None = None
    catalog_status: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class FoodDetail(FoodSummary):
    serving_label: str | None = None
    serving_grams: float | None = None
    source: str | None = None
    is_public: bool | None = None
    nutrition_basis: str | None = None
    basis_unit: str | None = None
    basis_amount: float | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class NutritionFactOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nutrient_code: str
    basis: str
    serving_uid: UUID | None = None
    value: float | None = None
    value_status: str
    unit: str
    is_manual_override: bool = False


class ServingOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    label: str
    grams: float | None = None
    ml: float | None = None
    is_default: bool = False


class ImageOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    status: str
    public_url: str | None = None
    content_hash: str | None = None
    quality_score: float | None = None


class ImportJobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    barcodes: list[str] = Field(min_length=1, max_length=100)


class ImportJobOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    status: str
    stats: dict[str, Any] | None = None


class PublishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = None


class ImageReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = None


class CandidateFoodOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_id: UUID
    name: str
    brand: str | None = None
    barcode: str | None = None
    catalog_status: str | None = None
    image_id: UUID | None = None
    image_status: str | None = None
    quality_score: float | None = None
