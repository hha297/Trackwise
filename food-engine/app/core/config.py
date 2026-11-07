"""Centralized settings loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

JWKS_ALGORITHMS: tuple[str, ...] = ("ES256",)
LEGACY_HMAC_ALGORITHMS: tuple[str, ...] = ("HS256",)


class Settings(BaseSettings):
    """Application settings. Secrets must come from the environment / secret store."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_env: Literal["development", "test", "staging", "production"] = "development"
    app_name: str = "Trackwise Food Intelligence"
    app_version: str = "0.3.0"
    api_v1_prefix: str = "/api/v1"

    supabase_url: str | None = None
    supabase_jwt_issuer: str | None = None
    supabase_jwks_url: str | None = None
    supabase_jwt_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SUPABASE_JWT_SECRET",
            "SUPABASE_LEGACY_JWT_SECRET",
        ),
    )
    supabase_jwt_audience: str | None = Field(default="authenticated")

    # Least-privilege Postgres DSNs (Phase 3). DATABASE_URL aliases app pool.
    database_url: str | None = None
    database_app_url: str | None = None
    database_worker_url: str | None = None
    database_admin_url: str | None = None
    db_pool_max_size: int = 5
    db_connect_timeout_seconds: float = 10.0
    db_command_timeout_seconds: float = 30.0

    food_engine_worker_token: str | None = None

    # R2 — public approved images
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_endpoint: str | None = None
    r2_public_bucket: str = "trackwise-food-images"
    r2_public_url: str = "https://images.trackwise.one"
    # R2 — private ingestion (alias R2_PRIVATE_BUCKET_NAME accepted for ops checklists)
    r2_private_bucket: str = Field(
        default="trackwise-food-ingestion-private",
        validation_alias=AliasChoices("R2_PRIVATE_BUCKET", "R2_PRIVATE_BUCKET_NAME"),
    )
    r2_private_access_key_id: str | None = None
    r2_private_secret_access_key: str | None = None

    # Ingestion
    off_user_agent: str = "TrackwiseFoodEngine/0.3 (https://trackwise.one)"
    off_base_url: str = "https://world.openfoodfacts.org"
    ingest_pilot_batch_size: int = 25
    ingest_rate_limit_per_second: float = 2.0
    image_max_bytes: int = 8_000_000
    image_min_dimension: int = 100
    image_max_dimension: int = 4096

    @field_validator("supabase_jwt_audience", mode="before")
    @classmethod
    def empty_audience_means_disabled(cls, value: object) -> object:
        if value == "":
            return None
        return value

    @field_validator(
        "supabase_url",
        "supabase_jwt_issuer",
        "supabase_jwks_url",
        "supabase_jwt_secret",
        "database_url",
        "database_app_url",
        "database_worker_url",
        "database_admin_url",
        "food_engine_worker_token",
        "r2_account_id",
        "r2_access_key_id",
        "r2_secret_access_key",
        "r2_endpoint",
        "r2_private_access_key_id",
        "r2_private_secret_access_key",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @model_validator(mode="after")
    def derive_issuer_and_r2(self) -> Settings:
        if self.supabase_url and not self.supabase_jwt_issuer:
            self.supabase_jwt_issuer = f"{self.supabase_url.rstrip('/')}/auth/v1"
        if self.r2_account_id and not self.r2_endpoint:
            self.r2_endpoint = (
                f"https://{self.r2_account_id}.r2.cloudflarestorage.com"
            )
        if not self.r2_private_access_key_id:
            self.r2_private_access_key_id = self.r2_access_key_id
        if not self.r2_private_secret_access_key:
            self.r2_private_secret_access_key = self.r2_secret_access_key
        return self

    @property
    def jwks_enabled(self) -> bool:
        return self.supabase_jwks_url is not None

    @property
    def legacy_hs256_enabled(self) -> bool:
        return self.supabase_jwt_secret is not None

    @property
    def jwt_verification_mode(self) -> Literal["jwks", "hmac", "dual", "unconfigured"]:
        if self.jwks_enabled and self.legacy_hs256_enabled:
            return "dual"
        if self.jwks_enabled:
            return "jwks"
        if self.legacy_hs256_enabled:
            return "hmac"
        return "unconfigured"

    @property
    def r2_configured(self) -> bool:
        return bool(
            self.r2_endpoint
            and self.r2_access_key_id
            and self.r2_secret_access_key
        )

    def require_jwt_configuration(self) -> None:
        if self.jwt_verification_mode == "unconfigured":
            raise RuntimeError(
                "JWT verification is not configured. Set SUPABASE_JWKS_URL for ES256 "
                "(current Trackwise Auth), and optionally SUPABASE_JWT_SECRET / "
                "SUPABASE_LEGACY_JWT_SECRET for temporary HS256 verification."
            )
        if not self.supabase_jwt_issuer:
            raise RuntimeError(
                "SUPABASE_JWT_ISSUER (or SUPABASE_URL) is required for JWT issuer validation."
            )


@lru_cache
def get_settings() -> Settings:
    if os.getenv("APP_ENV") == "test":
        return Settings(_env_file=None)  # type: ignore[call-arg]
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
