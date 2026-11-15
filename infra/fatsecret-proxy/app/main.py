"""
Trackwise FatSecret proxy — FastAPI on Oracle VM.

Loads credentials from environment (systemd EnvironmentFile):
  FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET, PROXY_SHARED_SECRET

Public: GET /health
Auth:   X-Proxy-Secret on /v1/*
"""

from __future__ import annotations

import hmac
import logging
import os
import threading
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Optional, Set

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("trackwise.fatsecret-proxy")

FATSECRET_TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
ALLOWED_METHODS: Set[str] = {
    "foods.search",
    "foods.search.v4",
    "food.get",
    "food.get.v2",
    "food.get.v3",
    "food.get.v4",
}
TOKEN_SCOPES = "basic"
TOKEN_SAFETY_SECONDS = 120
HTTP_TIMEOUT = 20.0
MAX_BODY_BYTES = 32_768
RATE_LIMIT_WINDOW = 60.0
RATE_LIMIT_MAX = 120

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


class ProxyRequest(BaseModel):
    method: str = Field(..., min_length=3, max_length=64)
    # Remaining FatSecret params are accepted via extra fields.
    class Config:
        extra = "allow"

    @validator("method")
    def method_must_be_allowed(cls, value: str) -> str:
        method = value.strip()
        if method not in ALLOWED_METHODS:
            raise ValueError("Unsupported FatSecret method.")
        return method


class TokenCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._token: Optional[str] = None
        self._expires_at = 0.0

    def get(self) -> Optional[str]:
        with self._lock:
            if self._token and time.time() < self._expires_at - TOKEN_SAFETY_SECONDS:
                return self._token
            return None

    def set(self, token: str, expires_in: int) -> None:
        with self._lock:
            self._token = token
            self._expires_at = time.time() + max(int(expires_in), 60)


class RateLimiter:
    def __init__(self, window_seconds: float, max_requests: int) -> None:
        self.window = window_seconds
        self.max_requests = max_requests
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.max_requests:
                return False
            q.append(now)
            return True


token_cache = TokenCache()
rate_limiter = RateLimiter(RATE_LIMIT_WINDOW, RATE_LIMIT_MAX)
http_client = httpx.Client(timeout=HTTP_TIMEOUT)


def _env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError("%s is not configured." % name)
    return value


def _proxy_secret() -> str:
    return _env("PROXY_SHARED_SECRET")


def _verify_proxy_secret(provided: Optional[str]) -> None:
    expected = _proxy_secret()
    candidate = provided or ""
    if not hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _get_access_token(force_refresh: bool = False) -> str:
    if not force_refresh:
        cached = token_cache.get()
        if cached:
            return cached

    client_id = _env("FATSECRET_CLIENT_ID")
    client_secret = _env("FATSECRET_CLIENT_SECRET")

    response = http_client.post(
        FATSECRET_TOKEN_URL,
        data={"grant_type": "client_credentials", "scope": TOKEN_SCOPES},
        auth=(client_id, client_secret),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if response.status_code >= 400:
        logger.warning("FatSecret OAuth failed status=%s", response.status_code)
        raise HTTPException(status_code=502, detail="FatSecret authentication failed.")

    payload = response.json()
    token = payload.get("access_token")
    expires_in = int(payload.get("expires_in") or 3600)
    if not token:
        raise HTTPException(status_code=502, detail="FatSecret authentication failed.")

    token_cache.set(token, expires_in)
    return token


def _call_fatsecret(method: str, params: Dict[str, Any]) -> Dict[str, Any]:
    body = {"method": method, "format": "json"}
    for key, value in params.items():
        if key in ("method", "format"):
            continue
        if value is None:
            continue
        body[key] = value

    def _once(token: str) -> httpx.Response:
        return http_client.post(
            FATSECRET_API_URL,
            data=body,
            headers={"Authorization": "Bearer %s" % token},
        )

    token = _get_access_token()
    response = _once(token)

    # One retry on unauthorized / expired token.
    if response.status_code in (401, 403):
        token = _get_access_token(force_refresh=True)
        response = _once(token)

    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="FatSecret rate limit reached.")
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="FatSecret is temporarily unavailable.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="FatSecret request failed.")

    try:
        data = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="FatSecret returned invalid JSON.")

    if isinstance(data, dict) and isinstance(data.get("error"), dict):
        message = str(data["error"].get("message") or "FatSecret error.")
        # Do not leak tokens; surface a short upstream message only.
        raise HTTPException(status_code=502, detail=message[:200])

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="FatSecret returned an unexpected payload.")
    return data


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "trackwise-fatsecret-proxy"}


@app.post("/v1/fatsecret")
async def fatsecret_proxy(
    request: Request,
    x_proxy_secret: Optional[str] = Header(default=None, alias="X-Proxy-Secret"),
) -> JSONResponse:
    _verify_proxy_secret(x_proxy_secret)

    if not rate_limiter.allow(_client_key(request)):
        raise HTTPException(status_code=429, detail="Too many requests.")

    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request too large.")

    try:
        payload = ProxyRequest.parse_raw(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    params = payload.dict()
    method = params.pop("method")
    upstream = _call_fatsecret(method, params)
    return JSONResponse(content=upstream)


@app.exception_handler(HTTPException)
def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(Exception)
def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled proxy error: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"error": "Internal proxy error."})
