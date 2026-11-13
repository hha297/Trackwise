<p align="center">
  <img src="../assets/images/branding/logo.png" alt="Trackwise" width="64" height="64" />
</p>

<h1 align="center">Trackwise Admin</h1>

<p align="center">
  <strong>Internal operations console</strong><br/>
  <sub>Catalog · Users · Roles · Audit · Feature flags</sub><br/>
  <sub>Same Supabase project as the mobile app · No public signup</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0A0A0A" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Supabase-SSR_·_RLS-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Port-3000-00D95F?style=flat-square&labelColor=202020" alt="Port"/>
</p>

<p align="center">
  <a href="#what-is-trackwise-admin"><img src="https://img.shields.io/badge/About-202020?style=flat-square" alt="About"/></a>
  <a href="#modules"><img src="https://img.shields.io/badge/Modules-00D95F?style=flat-square&labelColor=202020" alt="Modules"/></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/Setup-3B82F6?style=flat-square" alt="Setup"/></a>
  <a href="#configuration"><img src="https://img.shields.io/badge/Config-5e6a72?style=flat-square" alt="Config"/></a>
  <a href="../README.md"><img src="https://img.shields.io/badge/Mobile_README-5e6a72?style=flat-square" alt="Root"/></a>
</p>

---

## What is Trackwise Admin?

Standalone **Next.js App Router** console for operators. It shares Auth users and Postgres with the Expo mobile app. Only accounts with an `admin` row in `public.user_roles` can sign in.

|                                                                                                                                     |                                                                                                                                       |                                                                                                                                   |                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ![No signup](https://img.shields.io/badge/No_public_signup-5e6a72?style=for-the-badge&labelColor=202020) Invite / promote admins only | ![RLS](https://img.shields.io/badge/Admin_RLS_·_RPCs-00D95F?style=for-the-badge&labelColor=202020) Privilege via `user_roles`, not metadata | ![Catalog](https://img.shields.io/badge/System_catalog-3B82F6?style=for-the-badge&labelColor=202020) Foods & exercises with soft-archive | ![Audit](https://img.shields.io/badge/Audit_backed-C47F1A?style=for-the-badge&labelColor=202020) Role and suspension actions logged |

> **Not** the public marketing site — that lives in [`../dashboard`](../dashboard/README.md) on port **3001**.

---

## Modules

|                                                                                    | Module           | Highlights                                                                                          |
| :--------------------------------------------------------------------------------: | ---------------- | --------------------------------------------------------------------------------------------------- |
| ![](https://img.shields.io/badge/-Home-00D95F?style=flat-square&labelColor=202020) | **Dashboard**    | User counts, engagement proxies from food/workout writes, catalog totals                            |
| ![](https://img.shields.io/badge/-Catalog-3B82F6?style=flat-square)                | **Exercises / Foods** | System catalog CRUD, soft-archive (`archived_at`), exercise images → Storage `exercise-images` |
| ![](https://img.shields.io/badge/-Users-C47F1A?style=flat-square&labelColor=202020) | **Users**      | Roles (`admin` / `tester`), suspend / restore, audit-backed RPCs (`admin_set_role`, …)              |
| ![](https://img.shields.io/badge/-Data-635BFF?style=flat-square)                   | **User data**    | Read-only food logs, workouts, measurements, goals, templates                                       |
| ![](https://img.shields.io/badge/-System-5e6a72?style=flat-square)                 | **System**       | Feature flags, audit log viewer, catalog health                                                     |

**Important product rules**

- Food entry macros/names are **snapshots** — catalog edits must not rewrite diary history
- Engagement KPIs are **proxies** from food/workout activity; do not invent session DAU
- Soft-archive catalog rows when foreign keys exist; prefer additive migrations

---

## How access works

```mermaid
flowchart LR
  A[Email / password sign-in] --> B{user_roles.role = admin?}
  B -->|Yes| C[Admin console]
  B -->|No| D[Denied]
  C --> E[Server requireAdmin]
  E --> F[RLS / security-definer RPCs]

  style A fill:#202020,stroke:#00D95F,color:#fcfcfc
  style C fill:#00D95F,stroke:#13873c,color:#202020
  style E fill:#3B82F6,stroke:#1e40af,color:#fff
  style F fill:#635BFF,stroke:#3d37a8,color:#fff
  style D fill:#5e6a72,stroke:#333,color:#fff
```

- Auth: `@supabase/ssr` cookie sessions (email/password)
- Authorization: `public.user_roles` + `is_admin()` / security-definer RPCs — **never** trust `user_metadata` for privilege
- Catalog and Storage writes run only after `requireAdmin()` on the server

---

## Tech stack

| Layer        | Choice                                      |
| ------------ | ------------------------------------------- |
| **App**      | Next.js 15 (App Router), React 19, TypeScript |
| **UI**       | Tailwind CSS v4, Lucide, Recharts           |
| **Data**     | Supabase JS + SSR clients                   |
| **Auth gate**| `src/lib/auth.ts` → `requireAdmin()`        |
| **Schema**   | `../supabase/migrations/`                   |
| **Tests**    | Vitest                                      |

**Expand** `src/` layout

```text
src/
├── app/                 # Routes (dashboard, catalog, users, system, …)
├── features/            # Domain actions & queries
└── lib/
    ├── auth.ts          # requireAdmin gate
    └── supabase/        # Browser / server / service-role clients
```

---

## Getting started

### Requirements

- **Node.js 20+** and **npm**
- Same Supabase project as mobile (local Docker or hosted)
- Migration `20261102220000_admin_roles_and_security.sql` applied (and related admin schema)

### Install & run

```bash
cd admin
cp .env.example .env.local   # if present; otherwise create .env.local from the template below
npm install
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Development server (port 3000) |
| `npm run build` / `npm start` | Production build & serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest |

### Bootstrap the first admin

`public.user_roles` is **read-only in the Table Editor** for normal clients (RLS: select only). Role writes go through RPCs / SQL as **postgres** or **service_role** — not manual row edits with the anon key.

Until at least one admin exists, run **once** (SQL Editor → role `postgres`, or `psql`), replacing the UUID with your Auth user id:

```sql
select public.admin_bootstrap_grant('00000000-0000-0000-0000-000000000000');
```

**Local seed** (`supabase/seed.sql`, applied on `db reset`):

| | |
| - | - |
| Email | `test@admin.com` |
| Password | `testadmin` |
| Role | `admin` |

After bootstrap, promote/demote via **Admin → Users** (`admin_set_role`). The **last** admin cannot be demoted.

### System exercise images

Upload or replace system exercise artwork from **Admin → Exercises** (Storage bucket `exercise-images`). Keep matching files under `assets/images/workout/exercises/` for the mobile offline fallback map in `exercise-local-images.ts`.

---

## Configuration

Create `admin/.env.local`:

```env
# ── Supabase (same project as mobile) ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# Server-only — Auth Admin email lookup. Never expose as NEXT_PUBLIC_*.
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

For local Supabase, copy values from:

```bash
npx supabase status
```

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Auth Admin email lookup |

Never put the service-role key in `NEXT_PUBLIC_*`, the mobile app, or client components.

---

## Deploy (Vercel)

1. Set project **Root Directory** to `admin`
2. Configure the three environment variables above
3. Do **not** enable public Auth signup on the shared Supabase project for admin onboarding

---

## Mobile entry

The Expo app shows **Account → Admin dashboard** when:

1. `EXPO_PUBLIC_ADMIN_URL` points at this deployment (e.g. `http://localhost:3000` or `https://admin.example.com`)
2. The signed-in user has `user_roles.role = 'admin'`

The link opens the browser; login is separate (**no tokens in the URL**).

---

## Related docs

| Doc | Purpose |
| --- | ------- |
| [`../README.md`](../README.md) | Mobile app + monorepo overview |
| [`../supabase/README.md`](../supabase/README.md) | Migrations, OTP templates, Edge Functions |
| [`../dashboard/README.md`](../dashboard/README.md) | Public marketing site |
| [`AGENTS.md`](./AGENTS.md) | Agent / contributor rules for this package |

---

## License

Proprietary — same terms as the Trackwise monorepo. No public open-source license is published here.

---

<div align="center">

<img src="../assets/images/branding/logo.png" alt="Trackwise" width="48" height="48" />

<strong>Trackwise Admin</strong><br/>
<sub>Operate the catalog. Protect the data.</sub>

</div>
