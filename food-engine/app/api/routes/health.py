"""Liveness and readiness probes — never expose secrets."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, ConfigDict

from app import __version__
from app.core.config import get_settings
from app.core.db import ping_pool

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    service: str
    version: str


class ReadyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    app_db: bool
    worker_db: bool
    admin_db: bool
    r2_configured: bool


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="trackwise-food-engine",
        version=__version__,
    )


@router.get("/ready", response_model=ReadyResponse)
async def ready(response: Response) -> ReadyResponse:
    """
    Readiness for orchestrators (Railway healthcheck).

    Returns HTTP 200 when the app pool is reachable; HTTP 503 otherwise.
    Never includes DSNs, tokens, or other secrets.
    """
    settings = get_settings()
    app_ok = False
    worker_ok = False
    admin_ok = False
    try:
        app_ok = await ping_pool("app")
    except Exception:
        logger.warning("ready_app_db_unavailable")
    try:
        worker_ok = await ping_pool("worker")
    except Exception:
        logger.warning("ready_worker_db_unavailable")
    try:
        admin_ok = await ping_pool("admin")
    except Exception:
        logger.warning("ready_admin_db_unavailable")

    if app_ok:
        status_value = "ready"
        response.status_code = status.HTTP_200_OK
    else:
        status_value = "not_ready"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadyResponse(
        status=status_value,
        app_db=app_ok,
        worker_db=worker_ok,
        admin_db=admin_ok,
        r2_configured=settings.r2_configured,
    )
