# StationKit — Design System Specification & Implementation Handoff (v2.1)

Complete, self-contained specification for the **StationKit** design system for the
`richardthorek/Station-Manager` repo. It maps onto the **existing** token names in
`frontend/src/index.css` and `aar-studio/css/rfs-tokens.css`, so most of the work is
a values + assets + string swap, not a rewrite.

If v2.0 (the visual refresh) is already merged, §§1–3 and §§7–8 are already in place —
apply the **rebrand delta in §0.1 + §§9–12** on top. If starting clean, implement
top to bottom.

Reference/preview: `StationKit Design System.dc.html` (the showcase this was signed
off from). Keep dark mode. Keep WCAG AA — all pairings below are checked.

---

## 0. Summary of what changes (vs. the original app)

| Area | Before | After |
|---|---|---|
| Product name | Bushie Tools | **StationKit** (one word, camelCase) |
| Domain / URLs | `bushietools.app` | **`stationkit.com.au`** |
| Brand red | `#c8102e` | **`#D8232A`** (Signal Red — cleaner, richer) |
| Secondary accent | Lime `#cbdb2a` (neon) | **Hi-Vis Amber `#F6A609`** (lime retired) |
| Neutrals | warm/muddy grey mix | **cool-slate ramp** (`#0C1220` → `#FFFFFF`) |
| Headings | Public Sans | **Archivo** (700–900); Public Sans stays for body |
| Codes / slugs | Public Sans | **JetBrains Mono** |
| Icons | emoji (🔥🚛📊🎙️⚙️) | **Lucide** line icons (`lucide-react`) |
| Buttons | red→dark **gradients** | **flat** fills, radius 12px |
| Brand mark / favicon | literal building / flame | **"SK" monogram** in a rounded red tile |
| Positioning | fire-leaning ("the shed") | **multi-service**: fire, SES, marine rescue & volunteer units |
| Terminology | "Truck Check", "Brigade Access" | **"Vehicle Check", "Crew Access"** (service-agnostic) |

### 0.1 Rebrand delta (if v2.0 already shipped, this is the whole job)
Name → **StationKit**; domain → **stationkit.com.au**; mark → **SK monogram**
(flame retired); tone → **service-neutral**. Colours, type, Lucide icons and
terminology are **unchanged**. Details in §§9–12.

---

## 1. Fonts

In `frontend/index.html` (and `aar-studio/index.html`), replace the Public Sans
`<link>` with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Public+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- **Archivo** 700–900 → headings, buttons, wordmark, eyebrows, badges.
- **Public Sans** 300–700 → body, UI labels, inputs.
- **JetBrains Mono** 400–600 → codes, vehicle categories, slugs, URLs.

---

## 2. Design tokens — `frontend/src/index.css`

Replace the brand + neutral + semantic vars in `:root`. Legacy `--rfs-*` / `--color-*`
names are preserved so existing components keep working; the lime var now aliases to
amber.

```css
:root {
  /* ---- Brand ---- */
  --rfs-core-red:        #D8232A;  /* primary / actions (white-on-red 5.3:1 AA) */
  --rfs-core-red-dark:   #B01620;  /* hover / pressed */
  --rfs-core-red-light:  #E0555A;

  /* Hi-vis amber accent (replaces lime). Lime aliased for back-compat. */
  --accent-amber:        #F6A609;
  --accent-amber-dark:   #D98A00;
  --accent-amber-ink:    #241A00;  /* text ON amber */
  --rfs-lime:            var(--accent-amber);      /* deprecated alias */
  --rfs-lime-dark:       var(--accent-amber-dark); /* deprecated alias */

  /* ---- Neutrals (cool slate) ---- */
  --rfs-black:           #0C1220;  /* ink — primary text (21:1 on white) */
  --rfs-white:           #FFFFFF;
  --rfs-dark-grey:       #55607A;  /* secondary text (7.1:1 on white) */
  --rfs-light-grey:      #D3DAE6;  /* strong borders */
  --rfs-neutral-light:   #F4F6F9;  /* page background */
  --rfs-neutral-medium:  #E6EAF1;  /* hairline borders / dividers */
  --rfs-neutral-dark:    #1E2637;

  /* ---- Semantic ---- */
  --ui-green:  #1E9E62;  /* success / pass */
  --ui-amber:  #F6A609;  /* warning / issue */
  --ui-blue:   #2563EB;  /* info / links / skipped */
  /* critical == --rfs-core-red */

  --surface-success: #E4F5EC;  --text-success-strong: #0B5C3B;
  --surface-warning: #FDF0D6;  --text-warning-strong: #9A6800;
  --surface-info:    #E8F0FE;  --text-info-strong:    #1B4F8F;
  --surface-error:   #FCEBEB;  --text-error-strong:   #B01620;

  /* ---- Radius (was 6/8/12/16 — nudge md to 12 for the softer look) ---- */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 20px;

  /* ---- Shadows (softer, layered) ---- */
  --shadow-sm: 0 1px 2px rgba(16,24,40,.08);
  --shadow-md: 0 2px 6px -2px rgba(16,24,40,.10), 0 6px 16px -6px rgba(16,24,40,.12);
  --shadow-lg: 0 12px 30px -10px rgba(16,24,40,.16);

  font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Headings + primary buttons use Archivo */
h1, h2, h3, h4, h5, h6 { font-family: 'Archivo', 'Public Sans', sans-serif; font-weight: 800; letter-spacing: -0.4px; }

/* Codes, vehicle categories, slugs */
code, .mono, .slug, .category-code { font-family: 'JetBrains Mono', ui-monospace, monospace; }
```

### 2.1 Dark theme — replace values in `[data-theme="dark"]`

```css
[data-theme="dark"] {
  --bg-primary:   #0A0F1A;
  --bg-secondary: #0E1522;
  --bg-card:      #121A29;
  --text-primary: #F3F6FB;
  --text-secondary:#A6B0C4;
  --border-color: #233149;

  --rfs-core-red:      #E5484D;   /* fills — brighter for dark (white-on ~4.6:1) */
  --rfs-core-red-dark: #F26A6E;
  --rfs-core-red-text: #FF8085;   /* red TEXT on dark */
  --accent-amber:      #F6A609;
  --accent-amber-text: #FFC759;

  --surface-success:#0F2A1F; --text-success-strong:#8BE4B5;
  --surface-warning:#2A2008; --text-warning-strong:#FFC759;
  --surface-info:   #12233D; --text-info-strong:   #9EC5FF;
  --surface-error:  #2A1315; --text-error-strong:  #FF8085;

  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 2px 6px rgba(0,0,0,.5);
  --shadow-lg: 0 14px 34px -12px rgba(0,0,0,.65);
}
```

> Mirror the same brand/neutral values into `aar-studio/css/rfs-tokens.css` — the file
> header already says the two must stay in sync.

### 2.2 Buttons — remove the gradients

In `.btn-primary`, `.btn-success`, `.btn-accent`, `.btn-danger`, replace the
`linear-gradient(...)` backgrounds with the flat token (`background: var(--rfs-core-red)`
etc.), add `font-family: 'Archivo'`, and drop the `translateY(-2px)` hover lift on
kiosk primary actions (shadow change only). Amber buttons use
`color: var(--accent-amber-ink)`.

---

## 3. Typography scale

| Role | Font / weight | Size |
|---|---|---|
| Display | Archivo 900, `-1px` | 60 (clamp down on mobile) |
| Heading 1 | Archivo 800, `-0.5px` | 40 |
| Heading 2 | Archivo 800 | 26 |
| Title | Archivo 700 | 17 |
| Body | Public Sans 400 | 16 |
| Caption | Public Sans 500 | 13 |
| Code / slug | JetBrains Mono 500 | 14 |

Kiosk minimum: never render body/label below 14px, icons below 18px.

---

## 4. Iconography — replace every emoji

```bash
cd frontend && npm i lucide-react
```

Canonical module → icon map (import from `lucide-react`):

| Module | Emoji (old) | Lucide icon |
|---|---|---|
| Sign-In | 🔥 | `LogIn` |
| Vehicle Check | 🚛 | `Truck` |
| Reports | 📊 | `BarChart3` (a.k.a. `ChartColumn`) |
| AAR Studio | 🎙️ | `Mic` |
| Crew Access | (lock) | `ShieldCheck` |
| Station Admin | ⚙️ | `Settings2` |
| Guided tour | 🎓 | `GraduationCap` |
| Admin login | 🔐 | `LockKeyhole` |
| Logout | 👤 | `LogOut` |
| Theme toggle | 🌙/☀️ | `Moon` / `Sun` |

> The old "brand mark" `Flame` icon is **removed** in the rebrand — see §11.

Common UI: `Search, User, Users, QrCode, Camera, Download, Wrench, Radio, MapPin,
Bell, Clock, CalendarCheck, FileText, Check, CircleCheckBig, TriangleAlert,
CircleAlert, Info, ArrowRight, ChevronRight, Plus, X, SlidersHorizontal`.

Standard usage: `<LogIn size={24} strokeWidth={2} aria-hidden />`, colour via
`currentColor` on the parent.

---

## 5. Terminology — find & replace (service-agnostic)

| Use | Replace | Notes |
|---|---|---|
| **Vehicle Check** | "Truck Check" | not every crew runs trucks (SES/marine/rescue) |
| **Crew** | "Brigade" / "Squad" | one word for the people; keep "Brigade" only in RFS-specific copy |
| **Crew Access** | "Brigade Access" | route `/admin/brigade-access` label + nav |
| **Station** | "Shed" / "Base" | the physical home base |
| **Member** | "User" (in crew-facing UI) | "User" stays for admin accounts |
| **Sign-in book** | "Station Sign-In" / "Roll" | the attendance module |
| **After Action Review (AAR)** | "Debrief" / "Hotwash" | keep the AAR acronym / product name |

Apply to UI strings, route titles (`App.tsx`) and nav labels — leave data-model / API
field names unchanged.

---

## 6. Component polish (from the showcase)

- **Cards**: `background: var(--bg-card)`, `1px solid var(--border-color)`,
  `--radius-lg`, `--shadow-md`. Replace the 4px red→lime top-bar on hover in
  `LandingPage.css` with a single flat accent bar per module (module colour map:
  red / slate / blue / amber / green / slate).
- **Landing header**: drop the heavy `linear-gradient` + decorative circles; use a
  solid ink panel (`#0C1220`) with the amber eyebrow, per the showcase launcher.
- **Status pills**: use the `--surface-*` / `--text-*-strong` pairs + matching Lucide
  icon (`CircleCheckBig` / `TriangleAlert` / `CircleAlert` / `Info`).
- **Inputs**: 1.5px border `--rfs-light-grey`, focus ring `0 0 0 3px` in
  `--surface-error`-style soft red, radius 12px.

---

## 7. Semantic colour usage

| State | Fill | Soft surface | Strong text | Icon |
|---|---|---|---|---|
| Success / pass | `#1E9E62` | `#E4F5EC` | `#0B5C3B` | `CircleCheckBig` |
| Warning / issue | `#F6A609` | `#FDF0D6` | `#9A6800` | `TriangleAlert` |
| Critical / OOS | `#D8232A` | `#FCEBEB` | `#B01620` | `CircleAlert` |
| Info / skipped | `#2563EB` | `#E8F0FE` | `#1B4F8F` | `Info` |

---

## 8. Manifest & theme colours

- `frontend/public/manifest.json`: `"theme_color": "#D8232A"`,
  `"background_color": "#FFFFFF"`.
- `frontend/index.html`: `<meta name="theme-color" content="#D8232A">` and
  `msapplication-TileColor` → `#D8232A`.

---

## 9. Name & wordmark  *(rebrand)*

- Canonical product name is **StationKit** — one word, camelCase, capital S and K.
  Never "Station Kit", "Stationkit" or "Bushie Tools".
- Wordmark: **Archivo** 800/900, two-tone lockup — `Station` in `--rfs-black`
  (white on dark surfaces) and `Kit` in `--rfs-core-red`. On solid ink/red panels
  (launcher header) use the single-colour form with the amber `STATIONKIT` eyebrow
  above, per the showcase.

**Find & replace** `Bushie Tools` → `StationKit` across `frontend/` and `aar-studio/`:
`index.html` `<title>` + meta, `package.json` `name`/`description` (`stationkit`
slug), `manifest.json` `name`/`short_name` (`"StationKit"`), header/`LandingPage.tsx`
wordmark, README, email/footer copy. Leave third-party IDs and API field names.

---

## 10. Domain — `stationkit.com.au`  *(rebrand)*

Replace every `bushietools.app` (and any old domain) with **`stationkit.com.au`**:

- `manifest.json` `start_url` / `scope` (keep path structure), `<link rel="canonical">`,
  OpenGraph `og:url` / `og:site_name` (`StationKit`), Twitter meta, sitemap/robots,
  hard-coded absolute URLs in email templates.
- User-visible URL chrome in kiosk/sign-in screens now reads `stationkit.com.au`.
- **Flag for a human, don't guess:** CORS / allowed-origins and OAuth redirect URIs
  that reference the old host if they live in server env.

---

## 11. Brand mark, favicon & manifest  *(rebrand)*

- New mark = **"SK" monogram** — `handoff/assets/favicon.svg` (32) and
  `handoff/assets/icon.svg` (512). Drop into `frontend/public/`, overwriting the old
  flame files. Signal-red tile, white `SK` in Archivo Black, hi-vis amber underscore.
- The SVGs ship with a bold-sans fallback stack for portability. **Before rasterising,
  outline the `SK` in real Archivo Black** (letter-spacing ≈ `-0.04em`) so the raster
  set matches the wordmark exactly.
- Regenerate the full raster set from `icon.svg`: `favicon-16/32/48/96`,
  `apple-touch-icon`, `android-chrome-192/512`, `mstile-*`, `og-image`. The 512 is
  **maskable-safe** (mark within the centre 80%).
- Remove the Lucide `Flame` brand-mark usage from the app shell/header and replace
  with the SK monogram tile — a styled `<span>` (Archivo 900, white on
  `--rfs-core-red`, radius `--radius-md`), not an icon — per the showcase header,
  launcher and footer.
- Keep `theme_color` / `msapplication-TileColor` at `#D8232A` (§8).

---

## 12. Tone — service-agnostic positioning  *(rebrand)*

Keep marketing / empty-state copy **service-neutral** so SES, marine rescue and other
units see themselves:

- Avoid fire-only metaphors ("the shed", flame). Where a service list appears, name a
  spread — e.g. "fire, SES, marine rescue and volunteer units" — not fire alone.
- "Station / Crew / Member / Vehicle Check" (from §5) are deliberately service-agnostic;
  **do not** revert to "Shed / Brigade / Truck".

---

## 13. Rollout order & the Claude Code prompt

Do it as small, reviewable commits — **one per numbered step** — keeping CI green
(lint + typecheck + tests) and WCAG AA. Take iPad portrait + landscape screenshots of
the landing + sign-in pages in light **and** dark before opening the PR, as the
contributing guide requires.

> **Paste to the coding agent:**
>
> Read `handoff/StationKit — Design System Handoff.md` in full, then implement it
> across the `richardthorek/Station-Manager` repo, keeping CI green and WCAG AA, as a
> series of small reviewable commits (one per step):
>
> 1. **Fonts** — add the Archivo + Public Sans + JetBrains Mono `<link>` to
>    `frontend/index.html` and `aar-studio/index.html` (§1).
> 2. **Tokens** — update `frontend/src/index.css` and mirror `aar-studio/css/rfs-tokens.css`
>    (§2 + §2.1); keep the legacy `--rfs-*` names. Flatten the gradient buttons and set
>    heading/button font to Archivo (§2.2).
> 3. **Icons** — `npm i lucide-react`; replace every emoji with the mapped Lucide icon
>    (§4), starting `LandingPage.tsx`, then sign-in, vehicle-check, reports, admin.
> 4. **Terminology** — apply the find-&-replace (§5) to UI strings, route titles and the
>    `/admin/brigade-access` label; leave data-model / API fields unchanged.
> 5. **Name** — rename `Bushie Tools → StationKit` everywhere it appears as a string,
>    and set the two-tone Archivo wordmark (`Station` ink / `Kit` red) in the app shell,
>    landing header and sign-in (§9).
> 6. **Domain** — replace `bushietools.app → stationkit.com.au` in manifest, canonical/OG/
>    Twitter meta, sitemap, email URLs and visible URL chrome (§10). Flag — don't guess —
>    CORS/OAuth redirect hosts in server env.
> 7. **Mark** — drop in `favicon.svg`/`icon.svg` from `handoff/assets/`, outline the SK in
>    Archivo, regenerate the full raster icon set, and replace the Lucide `Flame`
>    brand-mark tile with the SK monogram span (§11). Keep theme colours.
> 8. **Polish & tone** — apply the card / header / status-pill polish (§6–7) and sweep
>    copy to service-neutral tone (§12).
>
> If v2.0 (steps 1–4 + 8 polish) is already merged, implement only steps 5–7 and the
> tone sweep — do NOT change token values, colours, fonts, Lucide icons or terminology.

---

## Assets in this handoff folder

- `assets/favicon.svg` — 32px SK monogram (browser tab / small).
- `assets/icon.svg` — 512px SK monogram, maskable-safe (source for the raster set).
- `../StationKit Design System.dc.html` — the signed-off visual reference.
