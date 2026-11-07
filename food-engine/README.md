# Trackwise Food Engine

FastAPI service for Trackwise Food Intelligence (catalog API, OFF pilot ingestion, R2 images).

## Setup

```bash
cd food-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
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
- API: `/api/v1/...`
- Docs (development only): `/docs`

## Docker

```bash
docker build -t trackwise-food-engine .
docker run --rm -p 8000:8000 --env-file .env trackwise-food-engine
```

## Railway

Root Directory: `/food-engine` · Builder: Dockerfile · Healthcheck: `/ready`
