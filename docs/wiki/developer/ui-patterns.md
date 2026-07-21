# UI patterns — reuse these, don't reinvent them

Concrete "use this class/component" guidance for the most common UI elements,
written after a 2026-07-21 audit found the same handful of things (a card, a
button, a page header) implemented from scratch dozens of times across the
codebase — each with slightly different colors, some hardcoded and broken in
dark mode. The design **tokens** (`frontend/src/index.css`, mirrored from
`aar-studio/css/rfs-tokens.css`) and several canonical **component classes**
already exist and are correct — the problem is adoption, not a missing system.
See [`handoff/StationKit - Design System Handoff.md`](../../../handoff/StationKit%20-%20Design%20System%20Handoff.md)
for the full token spec (colors, type scale, icon map) this page builds on.

**Rule of thumb:** before writing a new CSS class for a button, card, or page
header, check this page first. Only go fully custom for something that's
genuinely one-of-a-kind (the AAR Studio flow, the sign-in kiosk's three-column
grid, the truck-check scroll-to-next-item flow) — a card is never one-of-a-kind.

## Headers (page chrome)

**Use `components/PageHeader.tsx`** for every sub-page (anything with a "back"
relationship to a parent screen). It renders the back arrow, title, an
optional subtitle, and up to 2 inline icon actions (more collapse into an
overflow menu) — all on a flat `var(--rfs-core-red)` bar, 44px touch targets,
already dark-mode correct.

```tsx
<PageHeader
  title="Vehicle Roster"
  subtitle="Weekly vehicle inspections at a glance"
  backTo="/" backLabel="Home"
  actions={[{ key: 'theme', label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
              icon: theme === 'light' ? <Moon size={20} /> : <Sun size={20} />, onClick: toggleTheme }]}
>
  {/* optional second row: tabs, filters — see below */}
</PageHeader>
```

For a secondary nav/tab row under the header (tabs, quick links), pass it as
`children` using the shared pill classes — **don't** invent a new
`.my-page-tabs` class:

```tsx
<div className="page-header__tabs">
  <Link to="/truckcheck/admin" className="page-header__tab">
    <Settings2 size={16} /> Admin Dashboard
  </Link>
  <button className={`page-header__tab${active ? ' page-header__tab--active' : ''}`}>…</button>
</div>
```

**Exceptions (deliberately not PageHeader):**
- `LandingPage.tsx` / `MarketingPage.tsx` — the two root ("/") screens with no
  "back" target. Landing's dark-ink (`#0C1220`) hero header is its own
  top-level design per the design-system handoff §6 ("solid ink panel");
  don't chase its color elsewhere.
- `components/AdminNav.tsx` — the persistent top bar for the 3–4 admin
  console pages (Stations / Crew Access / Organization / Platform). It's
  primary cross-section nav, not a "back to the previous screen" control, so
  it stays a separate bar — but as of 2026-07-21 it shares PageHeader's flat
  red + 44px pill-button language, and each admin page renders `<AdminNav />`
  then `<PageHeader title="…" backTo="/" backLabel="Home" .../>` directly
  below it as its own title/actions row. Copy that pairing for any new admin
  page — don't hand-roll a `page-header-compact`/`org-header`-style block
  again (three separate ones existed before this fix, each with different
  padding/border/background).
- `components/Header.tsx` — the kiosk/sign-in app-shell (station selector,
  connection status, demo badge). Different content, but as of 2026-07-21 it
  uses the same flat red + 44px circular icon-button + `rgba(255,255,255,.16)`
  language as PageHeader, so it reads as the same family.

## Cards / surfaces

**Use `.card` from `index.css`** (`background: var(--bg-card)`,
`border: 1px solid var(--border-color)`, `border-radius: var(--radius-lg)`,
`box-shadow: var(--shadow-md)`) for any panel/card. Modifiers:
`.card-elevated` (stronger shadow), `.card-flat` (no shadow, border only).

```tsx
<div className="card">…</div>
<div className="card card-elevated">…</div>
```

At audit time `.card` had **zero usages** anywhere in `.tsx` — every card in
the app (`.roster-card`, `.stat-card`, `.action-card`, `.kpi-card`,
`.onboarding-card`, …) is a bespoke reimplementation. Some correctly point at
`--bg-card`/`--border-color` with their own radius/shadow numbers (harmless
drift); a meaningful minority hardcode `background: white` / `var(--rfs-white)`
/ raw hex instead — those stay **white in dark mode**, which is the literal
bug this page exists to stop. If a screen needs a card with extra structure
(a media slot, a title row, footer actions — like the vehicle roster cards),
that's fine as its own component-scoped class, but its **surface colors**
should still come from `--bg-card` / `--text-primary` / `--text-secondary` /
`--border-color`, never `--rfs-white` / `--rfs-black` / `--rfs-dark-grey` /
raw hex. Those `--rfs-*` names are **fixed brand colors** (they don't flip
with theme) — correct for permanent-red surfaces (buttons, the header bar)
and text sitting on them, wrong for anything that should adapt to light/dark.

## Buttons

**Use `.btn-primary` / `.btn-secondary` / `.btn-success` / `.btn-accent` /
`.btn-danger` / `.btn-ghost` from `index.css`** — flat fills (no gradients,
per the design-system handoff §2.2), Archivo font, theme-aware shadow. At
audit time `.btn-primary` alone was **redefined from scratch in 6 separate
feature CSS files**, some with different padding/radius/font than the
canonical one and colliding on the exact same class name (last-loaded file
wins the cascade — a real source of "why does this button look different
here" bugs, not just a style-guide violation). Don't add a 7th; if an
existing feature file already redefines these classes, prefer deleting the
local redefinition over adding another one.

```tsx
<button className="btn-primary">Start Check</button>
<button className="btn-secondary">Cancel</button>
<button className="btn-danger">Delete</button>
```

Icon-only buttons in header/toolbar contexts (theme toggle, refresh, close):
44px circle, `background: rgba(255,255,255,.16)` on a red bar (hover `.28`) —
this is what `PageHeader`'s `.page-header__action` and `Header.tsx`'s
`.theme-toggle-btn`/`.admin-menu-btn` already do; match it rather than
inventing a new icon-button treatment per screen.

## Sliders

No slider/range-input component exists in the codebase yet (checked at audit
time — zero `type="range"` inputs, no `Slider` component). If one is needed,
build it once as a shared component styled from the tokens above (track =
`--border-color`, fill = `--rfs-core-red`, thumb ≥ 44px hit target per the
kiosk touch-target rule) rather than a one-off per feature.

## Footers

No shared footer component exists; `LandingPage.tsx`'s `.landing-footer` and
AAR Studio's print footer are the only two, and they serve different,
page-specific purposes (app version/build info vs. a printed report footer).
Not enough repetition yet to warrant extracting a shared pattern — leave
page-specific footers as-is rather than force a shared component prematurely.

## Subtitles / explanatory text

- **Page subtitle** (one line under a page title): `PageHeader`'s `subtitle`
  prop, or `.page-header__subtitle` if hand-building inside `page-header__extra`.
- **Secondary/muted body text** anywhere else (card meta, helper text under a
  form field, empty-state copy): `color: var(--text-secondary)`. Never
  `var(--rfs-dark-grey)` for this — that token is fixed-brand-grey and won't
  darken/lighten correctly in dark mode; `--text-secondary` is the themed
  equivalent and is already what `--rfs-dark-grey` *should* alias to on a
  card/page surface.
- **Primary body/heading text**: `color: var(--text-primary)` (never
  `var(--rfs-black)` on a themed surface, same reasoning).
- **Status/callout text** (success, warning, error, info banners): the
  paired `--surface-*` / `--text-*-strong` tokens (e.g. `--surface-error` +
  `--text-error-strong`), already used correctly by `ConfirmationDialog`,
  `Toast`, and most status pills — reuse those, don't invent a new error-red.

## Known violations not yet fixed (follow-up, tracked in MASTER_PLAN)

The 2026-07-21 audit found ~15 files with hardcoded white/black card surfaces
(worst: `CrossStationReportsPage.css`, `UserProfilePage.css`,
`AdvancedReportsPage.css`, `CheckSummary.css`, `CheckWorkflow.css`) plus ~20
smaller offenders, and 6 duplicate `.btn-primary` definitions. Two files
(`TruckCheckOnboardingWizard.css`, `DeviceSetupGuide.css`) had a parallel
`@media (prefers-color-scheme: dark)` dark mode wired to the OS preference
instead of the app's actual `data-theme` toggle — fixed 2026-07-21, converted
to the token-based approach described above (see changelog). The rest are
real but lower-urgency debt — fix opportunistically when touching a file, or
as a dedicated remediation pass; each one is a small, mechanical, low-risk
swap (raw hex/`--rfs-white`/`--rfs-black` → the matching `--bg-*`/`--text-*`
token) once you're in the file, same pattern as this page's fixes.
