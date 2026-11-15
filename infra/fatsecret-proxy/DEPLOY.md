# FatSecret integration — deployment checklist

Source is implemented in-repo. Nothing below has been deployed by the agent.

## 1. Oracle VM — deploy proxy

```bash
# From Trackwise repo root on your machine
scp -r infra/fatsecret-proxy/app infra/fatsecret-proxy/requirements.txt \
  ubuntu@<vm-host>:/home/ubuntu/trackwise-fatsecret-proxy/
```

```bash
# On the VM
cd /home/ubuntu/trackwise-fatsecret-proxy
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
sudo systemctl restart trackwise-fatsecret-proxy
sudo systemctl status trackwise-fatsecret-proxy --no-pager
```

Do **not** overwrite `/etc/trackwise-fatsecret.env`.

## 2. Supabase — set Edge secrets

Use the **same** value as `PROXY_SHARED_SECRET` on the VM for `FATSECRET_PROXY_SECRET`.

```bash
npx supabase secrets set \
  FATSECRET_PROXY_URL=https://fatsecret-proxy.trackwise.one \
  FATSECRET_PROXY_SECRET='<same-as-PROXY_SHARED_SECRET-on-vm>'
```

`USDA_API_KEY` can remain as already configured.

Optional cleanup (only after proxy path is confirmed working):

```bash
# FatSecret OAuth is now performed on the VM, not in Edge.
# npx supabase secrets unset FATSECRET_CLIENT_ID FATSECRET_CLIENT_SECRET
```

## 3. Supabase — deploy Edge Function

```bash
npx supabase functions deploy food-provider
```

## 4. Mobile app

No React Native code changes are required for this integration.
The app already calls `food-provider` via `src/features/food/providers/edge-client.ts`.
