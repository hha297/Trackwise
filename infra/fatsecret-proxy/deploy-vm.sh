#!/usr/bin/env bash
# Deploy proxy code to Oracle VM and sync PROXY_SHARED_SECRET with Supabase.
# Usage:
#   export VM_HOST=ubuntu@79.76.43.164
#   export SSH_KEY=/path/to/oracle.pem   # optional
#   ./deploy-vm.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VM_HOST="${VM_HOST:-ubuntu@79.76.43.164}"
REMOTE_DIR=/home/ubuntu/trackwise-fatsecret-proxy
SECRET_FILE="$ROOT/.proxy-shared-secret.local"

if [[ ! -f "$SECRET_FILE" ]]; then
  echo "Missing $SECRET_FILE (created during Supabase secrets set)."
  exit 1
fi
SECRET="$(tr -d '\r\n' < "$SECRET_FILE")"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

echo "Uploading proxy sources to $VM_HOST:$REMOTE_DIR ..."
scp "${SSH_OPTS[@]}" -r "$ROOT/app" "$ROOT/requirements.txt" "$VM_HOST:$REMOTE_DIR/"

echo "Installing deps + updating PROXY_SHARED_SECRET + restarting service ..."
ssh "${SSH_OPTS[@]}" "$VM_HOST" bash -s <<EOF
set -euo pipefail
cd $REMOTE_DIR
python3 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Update only PROXY_SHARED_SECRET; keep FatSecret client credentials intact.
if [[ -f /etc/trackwise-fatsecret.env ]]; then
  sudo sed -i '/^PROXY_SHARED_SECRET=/d' /etc/trackwise-fatsecret.env
  echo "PROXY_SHARED_SECRET=$SECRET" | sudo tee -a /etc/trackwise-fatsecret.env >/dev/null
else
  echo "ERROR: /etc/trackwise-fatsecret.env missing"
  exit 1
fi

sudo systemctl restart trackwise-fatsecret-proxy
sudo systemctl is-active trackwise-fatsecret-proxy
curl -fsS http://127.0.0.1:8000/health
EOF

echo "VM deploy complete."
