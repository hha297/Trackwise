"""Shared HTTP GET/POST with timeout, retry, exponential backoff + jitter."""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class ProviderHttpError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ProviderRateLimitError(ProviderHttpError):
    pass


class ProviderAuthError(ProviderHttpError):
    pass


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    max_retries: int = 3,
    base_backoff_seconds: float = 0.5,
) -> dict[str, Any] | list[Any] | None:
    """
    Perform an HTTP request returning JSON.

    Retries on 429 and 5xx with exponential backoff + jitter.
    Returns None on 404.
    """
    attempt = 0
    while True:
        try:
            resp = await client.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_body,
            )
        except httpx.TimeoutException as exc:
            if attempt >= max_retries:
                raise ProviderHttpError("Provider request timed out") from exc
            await _sleep_backoff(attempt, base_backoff_seconds)
            attempt += 1
            continue
        except httpx.HTTPError as exc:
            if attempt >= max_retries:
                raise ProviderHttpError(f"Provider transport error: {type(exc).__name__}") from exc
            await _sleep_backoff(attempt, base_backoff_seconds)
            attempt += 1
            continue

        if resp.status_code == 404:
            return None
        if resp.status_code in {401, 403}:
            raise ProviderAuthError("Provider authentication/authorization failed", status_code=resp.status_code)
        if resp.status_code == 429:
            if attempt >= max_retries:
                raise ProviderRateLimitError("Provider rate limit exceeded", status_code=429)
            await _sleep_backoff(attempt, base_backoff_seconds, resp.headers.get("Retry-After"))
            attempt += 1
            continue
        if resp.status_code >= 500:
            if attempt >= max_retries:
                raise ProviderHttpError("Provider server error", status_code=resp.status_code)
            await _sleep_backoff(attempt, base_backoff_seconds)
            attempt += 1
            continue
        if resp.status_code >= 400:
            raise ProviderHttpError("Provider client error", status_code=resp.status_code)

        try:
            data = resp.json()
        except ValueError as exc:
            raise ProviderHttpError("Provider returned invalid JSON") from exc
        if data is None:
            return None
        if not isinstance(data, (dict, list)):
            raise ProviderHttpError("Provider JSON root must be object or array")
        return data


async def _sleep_backoff(
    attempt: int,
    base: float,
    retry_after: str | None = None,
) -> None:
    if retry_after:
        try:
            delay = float(retry_after)
        except ValueError:
            delay = base * (2**attempt)
    else:
        delay = base * (2**attempt)
    delay += random.uniform(0, base)
    logger.info("provider_http_retry attempt=%s delay_s=%.2f", attempt + 1, delay)
    await asyncio.sleep(delay)
