# Food Engine rollback

Local codebase rollback of the Python/FastAPI Food Engine initiative.

**Date:** 2026-11-10  
**Branch:** `calio/feat`  
**Backup branch:** `backup/food-engine-pre-rollback-20261110` (`6f26935`)  
**Pre-Food-Engine baseline:** `16decf7` (`feat: app polish + Resend feedback attachments`)  
**Food Engine commits removed from active tree:** `814145f`, `7c905db` (code removed via forward rollback commit; history preserved)

## What was removed (code)

- Entire `food-engine/` FastAPI package (app, worker paths, tests, Dockerfile, Railway-oriented README).
- `AGENTS.md` Food Intelligence / `food-engine/` instructions.
- Admin Phase 7 Food Engine client / intelligence panel / `FOOD_ENGINE_URL` wiring (never committed on `calio/feat`; present only on backup WIP).
- Phase 5.2–5.6 / Phase 7 Food Engine docs that lived only as local WIP (preserved on backup branch).

## What was restored

- Admin Foods UI remains the original Supabase-backed catalog (browse/create/edit/archive). No Food Engine URL required.
- Mobile barcode/search flow unchanged (no Food Engine runtime references were present under `src/`).
- Marketing `dashboard/` unchanged.

## What remains in git (intentional)

### Applied / history migrations (do not delete)

These files stay so migration history matches hosted/local apply records:

| Migration | Classification | Hosted status (recorded) |
| --- | --- | --- |
| `20261106110000` … `20261106110800` Food Intelligence core/roles/grants/RPCs | A / D (additive on `foods` + new objects) | **Applied** (Phase 4 era) |
| `20261107120000` Phase 4 ingestion | A | **Applied** |
| `2026110912*` / `2026110913*` / `2026110914*` Phase 5.2–5.6 | B/C | **Not applied to hosted** (local-only WIP; not on this rollback commit) |

### Unrelated keeps

- App version bumps (`package.json` / `app.json` 1.1.1) from the Food Engine commit window.
- Harmless Python ignore rules in root `.gitignore`.

## Hosted Supabase

**Do not apply cleanup automatically.** See:

`docs/sql/proposed-food-intelligence-hosted-rollback.sql`

Operator must:

1. Inventory live objects vs the proposed script.
2. Confirm no production dependency on `catalog_status`, FE roles, or FE tables.
3. Apply only after backup/approval.

Protected: `foods` (pre-existing catalog), `food_entries`, favorites, workouts, measurements, profiles, auth.

## Environment variables to remove manually

| Location | Variables |
| --- | --- |
| Local `food-engine/.env*` | All FE DSNs, worker token, JWKS/JWT FE settings, FE R2 keys |
| Local `admin/.env.local` | `FOOD_ENGINE_URL` / `FOOD_ENGINE_BASE_URL` |
| Railway Food Engine service | All service env vars for the FastAPI app |
| GitHub Actions (if any FE workflow) | FE secrets |
| Expo / Vercel | None required for FE (verify no accidental `FOOD_ENGINE_*`) |

Do not remove shared Supabase or app credentials.

## Railway (manual)

- Identify the Railway service whose root is `/food-engine` (or equivalent).
- Delete/stop **that service only** after DNS cutover.
- Do **not** cancel the whole Railway subscription automatically.
- Do **not** redeploy during this rollback.

## Cloudflare / DNS (manual review)

| Record / resource | Action |
| --- | --- |
| `api.trackwise.one` (if pointed at Railway FE) | Review; remove or retarget only after FE is offline |
| `images.trackwise.one` | Review references; retain until confirmed unused by app assets |
| R2 `trackwise-food-images` | Retain pending review |
| R2 `trackwise-food-ingestion-private` | FE private ingestion; retain until reviewed, then optional delete |
| Root / Vercel / MX / Resend | **Do not change** |

## Runtime architecture after rollback

```
Mobile (Expo) ──► Supabase Auth/Postgres/Storage
Admin (Next)  ──► Supabase Auth/Postgres
Dashboard     ──► static/marketing (+ Resend feedback)
```

No FastAPI Food Engine, no FE worker, no FE API URL.

## Verification performed locally

See final report in the rollback PR/commit notes: admin/mobile lint & typecheck as available; no hosted migrate/deploy.
