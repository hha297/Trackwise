# Trackwise Food Engine — Phase 3.1 (Railway-ready)
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

RUN adduser --disabled-password --gecos "" --uid 10001 appuser

COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --upgrade pip \
    && pip install . \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Secrets must be provided at runtime via env / secret mount — never baked into the image.
# Railway injects PORT; bind 0.0.0.0 for container networking. Shell form preserves signals via exec.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
