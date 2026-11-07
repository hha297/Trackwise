# Trackwise Food Engine

FastAPI service for Trackwise Food Intelligence (catalog API + multi-source ingestion).

**Version:** 0.4.0 (Phase 4 providers: Open Food Facts, Fineli, USDA)

## Setup

```bash
cd food-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
copy .env.example .env
```

Fill `.env` locally. Never commit `.env`.

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest
```

- Health: `GET /health`
- Ready: `GET /ready`
- Docs (development): `/docs`

## Providers

| Provider | Config |
| --- | --- |
| Open Food Facts | `OFF_*` |
| Fineli (CC-BY 4.0) | `FINELI_DATASET_PATH` (CSV/zip); API optional |
| USDA FoodData Central | `USDA_FDC_API_KEY` (optional) |

Ingestion admin APIs: `/api/v1/admin/providers`, `/admin/ingest/jobs`, `/admin/ingest/single`.

## Docker / Railway

Root Directory: `/food-engine` · Dockerfile · Healthcheck: `/ready`
