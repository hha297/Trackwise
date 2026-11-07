"""Provider HTTP retry / error mapping tests (mocked httpx)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.sources.http_retry import (
    ProviderAuthError,
    ProviderHttpError,
    ProviderRateLimitError,
    request_json,
)


def _response(status: int, payload: object = None, headers: dict[str, str] | None = None) -> httpx.Response:
    request = httpx.Request("GET", "https://example.test/x")
    content = b"{}" if payload is None else None
    if isinstance(payload, (dict, list)):
        return httpx.Response(status, json=payload, request=request, headers=headers or {})
    if isinstance(payload, str):
        return httpx.Response(status, text=payload, request=request, headers=headers or {})
    return httpx.Response(status, content=content or b"", request=request, headers=headers or {})


@pytest.mark.asyncio
async def test_request_json_success() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(200, {"ok": True}))
    data = await request_json(client, "GET", "https://example.test/x", max_retries=0)
    assert data == {"ok": True}


@pytest.mark.asyncio
async def test_request_json_404_returns_none() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(404))
    data = await request_json(client, "GET", "https://example.test/missing", max_retries=0)
    assert data is None


@pytest.mark.asyncio
async def test_request_json_401_auth_error() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(401))
    with pytest.raises(ProviderAuthError):
        await request_json(client, "GET", "https://example.test/x", max_retries=0)


@pytest.mark.asyncio
async def test_request_json_429_retries_then_raises() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(429, headers={"Retry-After": "0"}))
    with pytest.raises(ProviderRateLimitError):
        await request_json(
            client,
            "GET",
            "https://example.test/x",
            max_retries=1,
            base_backoff_seconds=0.01,
        )
    assert client.request.await_count == 2


@pytest.mark.asyncio
async def test_request_json_500_retries_then_raises() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(500))
    with pytest.raises(ProviderHttpError):
        await request_json(
            client,
            "GET",
            "https://example.test/x",
            max_retries=1,
            base_backoff_seconds=0.01,
        )


@pytest.mark.asyncio
async def test_request_json_invalid_json() -> None:
    client = MagicMock()
    client.request = AsyncMock(return_value=_response(200, "not-json"))
    with pytest.raises(ProviderHttpError, match="invalid JSON"):
        await request_json(client, "GET", "https://example.test/x", max_retries=0)


@pytest.mark.asyncio
async def test_request_json_timeout_retries() -> None:
    client = MagicMock()
    client.request = AsyncMock(side_effect=httpx.TimeoutException("t"))
    with pytest.raises(ProviderHttpError, match="timed out"):
        await request_json(
            client,
            "GET",
            "https://example.test/x",
            max_retries=1,
            base_backoff_seconds=0.01,
        )
