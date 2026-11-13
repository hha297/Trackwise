<p align="center">
  <img src="./public/images/branding/logo.png" alt="Trackwise" width="64" height="64" />
</p>

<h1 align="center">Trackwise Dashboard</h1>

<p align="center">
  <strong>Public marketing site for trackwise.one</strong><br/>
  <sub>Product story · Features · FAQ · Support · Legal</sub><br/>
  <sub>Not the Admin console · No app backend required to run</sub>
</p>

<p align="center">
  <a href="https://trackwise.one"><img src="https://img.shields.io/badge/Live-trackwise.one-00D95F?style=flat-square&labelColor=202020" alt="Live"/></a>
  <a href="http://localhost:3001"><img src="https://img.shields.io/badge/Local-3001-3B82F6?style=flat-square&labelColor=202020" alt="Local"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0A0A0A" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/EN_·_FI_·_SV_·_VI-00D95F?style=flat-square&labelColor=202020" alt="Locales"/>
</p>

<p align="center">
  <a href="#what-is-this-package"><img src="https://img.shields.io/badge/About-202020?style=flat-square" alt="About"/></a>
  <a href="#pages"><img src="https://img.shields.io/badge/Pages-00D95F?style=flat-square&labelColor=202020" alt="Pages"/></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/Setup-3B82F6?style=flat-square" alt="Setup"/></a>
  <a href="#configuration"><img src="https://img.shields.io/badge/Config-5e6a72?style=flat-square" alt="Config"/></a>
  <a href="../README.md"><img src="https://img.shields.io/badge/Mobile_README-5e6a72?style=flat-square" alt="Root"/></a>
</p>

---

## What is this package?

The **main public web** for Trackwise — product marketing, feature detail, FAQ, support, and legal pages at [trackwise.one](https://trackwise.one).

|                                                                                                                                      |                                                                                                                                          |                                                                                                                                     |                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ![Public](https://img.shields.io/badge/Public_site-00D95F?style=for-the-badge&labelColor=202020) Prospects & users — not operators     | ![Honest](https://img.shields.io/badge/Ship_what_exists-3B82F6?style=for-the-badge&labelColor=202020) Advertise only mobile features that ship | ![Config](https://img.shields.io/badge/Config_driven_links-C47F1A?style=for-the-badge&labelColor=202020) Empty store URLs → Coming soon | ![Brand](https://img.shields.io/badge/Trackwise_design-635BFF?style=for-the-badge&labelColor=202020) `#00D95F` · Bricolage / Mono |

This package is **separate** from:

| Package | Role | Port |
| ------- | ---- | ---- |
| [`../`](../README.md) (repo root) | Expo mobile app | Metro |
| [`../admin`](../admin/README.md) | Internal Admin console | **3000** |
| **`dashboard/`** (this package) | Public marketing site | **3001** |

It does **not** need the mobile app or Admin console running.

---

## Pages

| Route | Purpose |
| ----- | ------- |
| `/` | Marketing homepage (hero, features, how it works, FAQ, download) |
| `/features` | Deeper feature overview |
| `/about` | Short about page |
| `/support` | Support Center |
| `/feedback` | Feedback form (Resend → support email via `/api/feedback`) |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Use |

**Product messaging defaults**

- Free core tracking on **Android** first; **iOS later**
- Barcode scan = Open Food Facts lookup — **not** AI meal recognition / OCR
- Calorie and activity values are **estimates**, not medical measurements

---

## Tech stack

| Layer | Choice |
| ----- | ------ |
| **App** | Next.js 15 (App Router), React 19, TypeScript |
| **UI** | Tailwind CSS v4, Lucide |
| **Fonts** | Bricolage Grotesque (display + body), JetBrains Mono (metrics) |
| **i18n** | Client locale dictionaries — EN / FI / SV / VI |
| **Theme** | Light / dark / system (CSS variables + `data-theme`) |
| **Config** | `src/config/site.ts` (hard-coded public constants) |

**Expand** `src/` layout

```text
public/images/               # Screenshots, branding
src/
├── app/                     # Routes (/, /features, /privacy, …)
├── components/
│   ├── layout/              # Shell, footer
│   ├── navigation/          # Header, locale + theme controls
│   ├── mockups/             # Phone frames & screen previews
│   └── sections/            # Homepage sections
├── config/site.ts           # Domain, store URLs, support contact
├── content/                 # FAQ, features, legal, support copy
└── i18n/                    # Locale messages + provider
```

Design reference: [`../DESIGN.MD`](../DESIGN.MD) and root [`AGENTS.md`](../AGENTS.md).

---

## Getting started

### Requirements

- **Node.js 20+** and **npm**
- No Supabase or Docker required for local marketing preview

### Install & run

```bash
cd dashboard
cp .env.example .env.local
npm install
npm run dev                  # http://localhost:3001
```

Port **3001** avoids colliding with Admin on **3000**.

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Serve production build on port 3001 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |

---

## Configuration

Edit **`src/config/site.ts`** — no Vercel env required for contact/store/SEO:

| Constant | Purpose |
| -------- | ------- |
| `SITE_URL` / `SITE_DOMAIN` | Canonical origin |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | Public support contact |
| `GOOGLE_PLAY_URL` | Android store (empty → Coming soon) |
| `APP_STORE_URL` | iOS store when live |

**Feedback email (server env in `.env.local`, see `.env.example`)**

| Variable | Purpose |
| -------- | ------- |
| `RESEND_API_KEY` | Resend API key for `/api/feedback` |
| `RESEND_FROM` | Optional From address (default `Trackwise <onboarding@resend.dev>`) |

With the default From, Resend only delivers to the email on your Resend account. For production, verify `trackwise.one` in Resend and set `RESEND_FROM` to an address on that domain.

Brand assets are mirrored from `../assets/images/branding/` into `public/images/branding/`.

---

## Content & honesty rules

- Advertise only features that exist in the **shipping mobile app**
- Prefer **Coming soon** over invented AI or unpaid store claims; do not leave visible TODO copy on pages
- Empty store URLs in `site.ts` must not create broken links

---

## Deploy

Typical Vercel setup:

1. **Root Directory** = `dashboard`
2. Confirm `src/config/site.ts` (especially store URLs when published)
3. Do not wire DNS, store URLs, or production backends without owner approval

---

## Related docs

| Doc | Purpose |
| --- | ------- |
| [`../README.md`](../README.md) | Mobile app + monorepo overview |
| [`../admin/README.md`](../admin/README.md) | Internal Admin console |
| [`AGENTS.md`](./AGENTS.md) | Agent / contributor rules for this package |
| [`../DESIGN.MD`](../DESIGN.MD) | Visual system |

---

## License

Proprietary — same terms as the Trackwise monorepo. No public open-source license is published here.

---

<div align="center">

<img src="./public/images/branding/logo.png" alt="Trackwise" width="48" height="48" />

<strong>Trackwise</strong><br/>
<sub>Make every step count.</sub>

<br/>

<a href="https://trackwise.one"><img src="https://img.shields.io/badge/trackwise.one-00D95F?style=flat-square&labelColor=202020" alt="trackwise.one"/></a>

</div>
