"""FastAPI application entrypoint (Phase 3 Food Intelligence)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.api.routes import admin_foods, auth_probe, foods, health
from app.core.config import get_settings
from app.core.db import close_pools, init_pools

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        correlation_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = correlation_id
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    await init_pools(settings)
    logger.info(
        "startup env=%s jwt_mode=%s r2=%s",
        settings.app_env,
        settings.jwt_verification_mode,
        settings.r2_configured,
    )
    yield
    await close_pools()
    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version or __version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env in {"development", "test"} else None,
        redoc_url="/redoc" if settings.app_env in {"development", "test"} else None,
        openapi_url="/openapi.json" if settings.app_env in {"development", "test"} else None,
    )
    application.add_middleware(CorrelationIdMiddleware)

    application.include_router(health.router)
    application.include_router(auth_probe.router, prefix=settings.api_v1_prefix)
    application.include_router(foods.router, prefix=settings.api_v1_prefix)
    application.include_router(admin_foods.router, prefix=settings.api_v1_prefix)

    return application


app = create_app()
