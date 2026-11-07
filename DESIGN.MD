# Design System Inspired by Replicate — Trackwise Adaptation

> Source: [getdesign.md/replicate/design-md](https://getdesign.md/replicate/design-md).  
> **Primary (locked):** Trackwise Green **`#00D95F`** — never Replicate orange `#ea2804`.  
> **Rejected:** Sentry cool slate and PostHog cream/olive directions.  
> **Platform:** Expo / React Native fitness & nutrition — typography-led, mobile-first.

---

## 1. Visual Theme & Atmosphere

Warm bone/cream developer-notebook surfaces with dark ink type and a single scarce brand accent — Trackwise Green (`#00D95F`) on consequential CTAs only. Personality comes from **aggressive display type** (tight tracking, bold grotesque), pill CTAs, hairline borders, and near-zero decorative shadow.

**Key Characteristics:**

- Canvas `#f9f7f3` / bone `#f3f0e8` / white cards
- Ink `#202020` with muted charcoal secondary
- Primary `#00D95F` + ink on-primary
- Pill buttons; mid-radius cards (≈10–16)
- Minimal shadows; high typographic contrast
- No Replicate orange/magenta brand accents

---

## 2. Typography (highest priority)

| Role      | Reference                         | Trackwise substitute    | Notes                       |
| --------- | --------------------------------- | ----------------------- | --------------------------- |
| Display   | `rb-freigeist-neue` (proprietary) | **Bricolage Grotesque** | OFL via Google Fonts / Expo |
| Body / UI | `basier-square` (proprietary)     | **Geist**               | OFL via Google Fonts / Expo |
| Mono      | JetBrains Mono                    | **JetBrains Mono**      | Metrics / small data labels |

### Mobile scale

| Token               | Size  | Family            | Tracking |
| ------------------- | ----- | ----------------- | -------- |
| `display`           | 36–40 | Bricolage 800     | ≈ −1.2   |
| `headingLarge`      | 28    | Bricolage 700     | ≈ −0.8   |
| `headingMedium`     | 22    | Bricolage 600     | ≈ −0.4   |
| `headingSmall`      | 18    | Geist 600         | ≈ −0.2   |
| `body` / strong     | 16    | Geist 400 / 600   | 0        |
| `caption` / `label` | 13–14 | Geist 500–600     | 0        |
| `button`            | 16    | Geist 600         | 0        |
| `metric` (mono)     | 14–18 | JetBrains 600–700 | 0        |

Use display type for screen titles, calorie totals, and key nutrition stats. Use mono sparingly for numeric metadata.

---

## 3. Color Palette

### Brand

| Role        | Hex       |
| ----------- | --------- |
| **Primary** | `#00D95F` |
| Pressed     | `#00B84F` |
| Deep        | `#13873C` |
| Bright      | `#18D968` |
| On primary  | `#ffffff` |

### Light

| Role         | Hex       |
| ------------ | --------- |
| Canvas       | `#f9f7f3` |
| Bone / muted | `#f3f0e8` |
| Card         | `#ffffff` |
| Ink          | `#202020` |
| Body         | `#3a3a3a` |
| Mute         | `#646464` |
| Ash          | `#8d8d8d` |
| Hairline     | `#e4e0d8` |

### Dark

| Role    | Hex                     |
| ------- | ----------------------- |
| Canvas  | `#202020`               |
| Surface | `#2a2a2a`               |
| Muted   | `#333333`               |
| Border  | `#3f3f3f`               |
| Text    | `#fcfcfc` / muted white |
| Primary | `#00D95F`               |

### Semantic

Success `#2b9a66` · Warning `#c47f1a` · Error `#d64545` · Info `#3b82f6`

### Macros

Calories primary · Protein info · Carbs warning · Fat error · Activity pressed green

---

## 4. Spacing & Radius

Spacing: 4 / 8 / 12 / 16 / 24 / 32.

**Radius:** `sm` 6 · `md` 10 · `lg` 16 · `xl` 20 · `pill` 999

- Buttons / chips / Scan: `pill`
- Cards / inputs: `md` (10)
- Large panels: `lg` (16)

---

## 5. Components

### Buttons

Primary: `#00D95F`, ink label, **pill**, min height 48. Secondary: white/bone + ink hairline, pill. Text: ink or primary. Destructive: error outline.

### Cards / inputs

White card on cream canvas; hairline; radius 10. Focus border primary.

### Navigation

Minimal floating dock on surface; soft hairline; pill Scan in primary; active labels/icons in primary — no heavy green outline around the dock.

---

## 6. Do / Don't

**Do:** typography-first hierarchy; Bricolage display; Geist UI; scarce green CTAs; pill actions; warm bone canvas.  
**Don't:** Freigeist/Basier without license; Replicate orange brand; Sentry/PostHog palettes; mono everywhere; change `#00D95F`.

---

## 7. Implementation map

| Role         | Token / code                                 |
| ------------ | -------------------------------------------- |
| Canvas       | `background`                                 |
| Bone         | `surfaceMuted`                               |
| Card         | `surface`                                    |
| Ink          | `textPrimary`                                |
| Green        | `primary`                                    |
| Display type | `fonts.display*` + Text `display` / headings |
| Body type    | `fonts.body*`                                |
| Mono         | `fonts.mono*` / Text `metric`                |

`src/theme/*`, `src/components/ui/*`. Prefer `useThemeColors()`.
