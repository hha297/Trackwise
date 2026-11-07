"""
Minimal authenticated probe routes for Phase 1.

These endpoints exist only to exercise authentication/authorization dependencies.
They must not expose secrets, catalog data, or internal configuration.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.core.security import AuthenticatedUser
from app.dependencies.authentication import get_current_user, require_worker
from app.dependencies.authorization import AdminPrincipal, require_admin

router = APIRouter(tags=["auth-probe"])


class MeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str


class AdminPingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    account_status: str


class WorkerPingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    principal: str


@router.get("/auth/me", response_model=MeResponse)
async def auth_me(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> MeResponse:
    return MeResponse(user_id=user.user_id)


@router.get("/admin/ping", response_model=AdminPingResponse)
async def admin_ping(
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> AdminPingResponse:
    return AdminPingResponse(user_id=admin.user_id, account_status=admin.account_status)


@router.get("/internal/worker/ping", response_model=WorkerPingResponse)
async def worker_ping(
    worker: Annotated[dict[str, str], Depends(require_worker)],
) -> WorkerPingResponse:
    return WorkerPingResponse(principal=worker["principal"])
