# Bushie Tools — Design System v2.0 · Implementation Handoff

This is everything Claude Code needs to roll the new design system into the
`richardthorek/Station-Manager` repo. It maps onto the **existing** token names
in `frontend/src/index.css` and `aar-studio/css/rfs-tokens.css` so the change is
mostly a values + assets swap, not a rewrite.

Reference/preview: `Bushie Tools Design System.dc.html` (the showcase this was signed off from).

---

## 0. Summary of what changes

| Area | Before | After |
|---|---|---|
| Brand red | `#c8102e` | **`#D8232A`** (Signal Red — cleaner, richer) |
| Secondary accent | Lime `#cbdb2a` (neon) | **Hi-Vis Amber `#F6A609`** (lime retired) |
| Neutrals | warm/muddy grey mix | **cool-slate ramp** (`#0C1220` → `#FFFFFF`) |
| Headings | Public Sans | **Archivo** (700–900), Public Sans stays for body |
| Codes/slugs | Public Sans | **JetBrains Mono** |
| Icons | emoji (🔥🚛📊🎙️⚙️) | **Lucide** line icons (`lucide-react`) |
| Buttons | red→dark **gradients** | **flat** fills, radius 12px |
| Favicon/app icon | literal building | **Signal flame** in a rounded red tile |
| Terminology | "Truck Check", "Brigade Access" | **"Vehicle Check", "Crew Access"** (service-agnostic) |

Keep dark mode. Keep WCAG AA — all pairings below are checked.

---

## 1. Fonts

In `frontend/index.html` (and `aar-studio/index.html`), replace the Public Sans
`<link>` with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Public+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 2. Design tokens — drop into `frontend/src/index.css`

Replace the brand + neutral + semantic vars in `:root` with these (legacy
`--rfs-*` and `--color-*` names are preserved so existing components keep working;
the lime var now aliases to amber):

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

### Dark theme — replace values in `[data-theme="dark"]`

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

> Also update `aar-studio/css/rfs-tokens.css` with the same brand/neutral values —
> the file header already says the two must stay in sync.

### Button treatment — remove the gradients

In `.btn-primary`, `.btn-success`, `.btn-accent`, `.btn-danger`, replace the
`linear-gradient(...)` backgrounds with the flat token (`background: var(--rfs-core-red)`
etc.), add `font-family: 'Archivo'`, and drop the `translateY(-2px)` hover lift on
kiosk primary actions (keep it subtle: shadow change only). Amber buttons use
`color: var(--accent-amber-ink)`.

---

## 3. Iconography — replace every emoji

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
| Brand mark | 🔥 | `Flame` |

Common UI: `Search, User, Users, QrCode, Camera, Download, Wrench, Radio, MapPin,
Bell, Clock, CalendarCheck, FileText, Check, CircleCheckBig, TriangleAlert,
CircleAlert, Info, ArrowRight, ChevronRight, Plus, X, SlidersHorizontal`.

Standard usage: `<LogIn size={24} strokeWidth={2} aria-hidden />`, colour via
`currentColor` on the parent. Never scale below 18px on kiosk.

---

## 4. Terminology — find & replace (keep it service-agnostic)

| Use | Replace | Notes |
|---|---|---|
| **Vehicle Check** | "Truck Check" | not every crew runs trucks (SES/marine/rescue) |
| **Crew** | "Brigade" / "Squad" | one word for the people; keep "Brigade" only in RFS-specific copy |
| **Crew Access** | "Brigade Access" | route `/admin/brigade-access` label + nav |
| **Station** | "Shed" / "Base" | the physical home base |
| **Member** | "User" (in crew-facing UI) | "User" stays for admin accounts |
| **Sign-in book** | "Station Sign-In" / "Roll" | the attendance module |
| **After Action Review (AAR)** | "Debrief" / "Hotwash" | keep the AAR acronym / product name |

Manifest `shortcuts` and the landing cards already say "Vehicle Check" — align the
rest (route titles in `App.tsx`, the `LandingPage.tsx` "Crew Access" link is good).

---

## 5. Brand mark, favicon & manifest

- New mark = **Signal flame** (this folder → `assets/favicon.svg`, `assets/icon.svg`).
  Drop them into `frontend/public/`, overwriting the old ones.
- Regenerate the raster set (`favicon-16/32/48/96`, `apple-touch-*`,
  `android-chrome-192/512`, `mstile-*`, `og-image`) from `icon.svg`. The 512 is
  already **maskable-safe** (flame within the centre 80%).
- `frontend/public/manifest.json`: `"theme_color": "#D8232A"`, keep
  `"background_color": "#FFFFFF"`.
- `frontend/index.html`: `<meta name="theme-color" content="#D8232A">` and
  `msapplication-TileColor` → `#D8232A`.

---

## 6. Component polish (from the showcase)

- **Cards**: `background: var(--bg-card)`, `1px solid var(--border-color)`,
  `--radius-lg`, `--shadow-md`. The 4px red→lime top-bar on hover in
  `LandingPage.css` → single flat accent bar per module (see the module colour map
  in the showcase: red / slate / blue / amber / green / slate).
- **Landing header**: drop the heavy `linear-gradient` + decorative circles; use a
  solid ink panel (`#0C1220`) with the amber eyebrow, per the showcase launcher.
- **Status pills**: use the `--surface-*` / `--text-*-strong` pairs + matching Lucide
  icon (`CircleCheckBig` / `TriangleAlert` / `CircleAlert` / `Info`).

---

## 7. Paste this into Claude Code

> I'm applying the "Bushie Tools Design System v2.0". Read
> `handoff/Bushie Tools — Implementation Handoff.md` in full, then implement it
> across the repo in this order, keeping CI green (lint + typecheck + tests) and
> WCAG AA:
>
> 1. Add the Google Fonts link (Archivo + Public Sans + JetBrains Mono) to
>    `frontend/index.html` and `aar-studio/index.html`.
> 2. Update design tokens in `frontend/src/index.css` and mirror them in
>    `aar-studio/css/rfs-tokens.css` (§2). Keep the legacy `--rfs-*` names.
> 3. Flatten the gradient buttons and set heading/button font to Archivo (§2).
> 4. `npm i lucide-react`; replace every emoji icon with the mapped Lucide icon (§3),
>    starting with `LandingPage.tsx`, then sign-in, truck-check, reports, admin.
> 5. Apply the terminology find-&-replace (§4) to UI strings, route titles and the
>    `/admin/brigade-access` label — leave data model / API field names unchanged.
> 6. Swap in `favicon.svg` / `icon.svg`, regenerate the raster icon set, and update
>    `manifest.json` + `index.html` theme colours to `#D8232A` (§5).
> 7. Apply the card / header / status-pill polish (§6).
>
> Do it as a series of small, reviewable commits — one per numbered step — and take
> iPad portrait + landscape screenshots of the landing + sign-in pages in light and
> dark before opening the PR, as the repo's contributing guide requires.
