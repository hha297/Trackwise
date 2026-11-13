# Trackwise Dashboard (public site) — agent instructions

Standalone Next.js App Router marketing site under `dashboard/`. This is the main public web for Trackwise users and prospects (`trackwise.one`) — **not** the Admin console in `admin/`.

## Scope

- Own `package.json` / lockfile; run independently on port 3001 by default (Admin uses 3000).
- Follow root `DESIGN.MD` and Trackwise brand (`#00D95F`, bone canvas, Bricolage / JetBrains Mono).
- Advertise only features that exist in the mobile app. Prefer Coming soon over invented claims. Do not leave visible TODO copy on public pages.
- Public site constants live in `src/config/site.ts` (not Vercel env). Empty store URLs must not create broken links. Social links stay commented out until real profiles exist.

## Key paths

- Routes: `src/app/`
- Layout / nav / footer: `src/components/layout/`, `src/components/navigation/`
- Marketing sections & phone mockups: `src/components/sections/`, `src/components/mockups/`
- Site config: `src/config/site.ts`
- Copy: `src/content/`

## Rules

- Do not deploy, change DNS, or wire production backends without explicit approval.
- Do not put secrets in client-side site config.
- Legal pages use confirmed operator contact details; do not reintroduce visible TODO placeholders.
- Feedback posts to `/api/feedback` (Resend → `SUPPORT_EMAIL`). Requires server env `RESEND_API_KEY` (optional `RESEND_FROM`). Do not reintroduce mock-only success states or put the API key in client config.
