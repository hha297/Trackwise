# Trackwise FatSecret Proxy

Lightweight FastAPI proxy for FatSecret Platform API (`basic` scope).

- Public: `GET /health`
- Authenticated: `POST /v1/fatsecret` with header `X-Proxy-Secret`
- Allowed methods: `foods.search`, `foods.search.v4`, `food.get`, `food.get.v2`, `food.get.v3`, `food.get.v4`

Credentials stay on the Oracle VM (`/etc/trackwise-fatsecret.env`). The mobile app never sees them.

## Local layout on the VM

Expected install path: `/home/ubuntu/trackwise-fatsecret-proxy`

```
trackwise-fatsecret-proxy/
  app/
    __init__.py
    main.py
  requirements.txt
  README.md
```

Environment file (do not overwrite existing values):

`/etc/trackwise-fatsecret.env`

```
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...
PROXY_SHARED_SECRET=...
```

## Deploy / update on Oracle VM

From your laptop (repo root), sync sources:

```bash
scp -r infra/fatsecret-proxy/app infra/fatsecret-proxy/requirements.txt \
  ubuntu@<vm-host>:/home/ubuntu/trackwise-fatsecret-proxy/
```

On the VM:

```bash
cd /home/ubuntu/trackwise-fatsecret-proxy

# Virtualenv + deps (Python 3.8) — skip if already installed and unchanged
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Restart (EnvironmentFile=/etc/trackwise-fatsecret.env must already exist)
sudo systemctl restart trackwise-fatsecret-proxy
sudo systemctl status trackwise-fatsecret-proxy --no-pager
```

Uvicorn must bind to `127.0.0.1:8000` only (Caddy terminates TLS). See `trackwise-fatsecret-proxy.service.example`.

Do **not** change Caddy, DNS, TLS, firewall, or `/etc/trackwise-fatsecret.env` unless required.

## Example authenticated call

```bash
curl -sS -X POST 'https://fatsecret-proxy.trackwise.one/v1/fatsecret' \
  -H 'Content-Type: application/json' \
  -H "X-Proxy-Secret: $PROXY_SHARED_SECRET" \
  -d '{"method":"foods.search","search_expression":"apple","max_results":5}'
```
