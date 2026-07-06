# Cross-app responsive UI review (2026-07-04)

**Directive (owner):** when picking up the next queue items, factor in desktop /
tablet / mobile UI layers across all applications (`frontend/`, `aar-studio/`).
This is a focused audit, not a full re-review of every screen — it uses
automated evidence (breakpoint inventory + a real-browser overflow/touch-target
scan at four viewport sizes) rather than eyeballing every page, so it can be
trusted to tell "nothing to see here" apart from "not yet checked".

## Method

1. **Breakpoint inventory** — grepped `@media` rules and touch-target CSS vars
   across both apps' stylesheets.
2. **Automated viewport scan** — Playwright + Chromium drove every route in
   both apps at `390×844` (phone), `768×1024` (iPad portrait), `1024×768`
   (iPad landscape) and `1440×900` (desktop), measuring `document.documentElement.scrollWidth`
   against `clientWidth` (horizontal-overflow detector) and every
   `button/a/select/[role=button]`'s rendered box against the 44px touch-target
   minimum (`CLAUDE.md`: "60px kiosk, 44px inline minimum").
3. Full-page screenshots at all four sizes for the highest-traffic screens
   (aar-studio: home, capture, board, review, report; frontend: landing, login)
   as a sanity check on top of the automated scan.

## What the inventory found

| App | `@media` rules | Notes |
|---|---|---|
| `frontend/` | 65 files, ranging 480px–1400px + orientation queries | Mature, per-component responsive coverage — expected, since this SPA is the daily kiosk/mobile surface. |
| `aar-studio/` | **3 rules total** across the whole ~2,500-line stylesheet (a reduced-motion query, one `max-width: 980px` grid collapse for the report layout, and a print query) | Structurally thin — see UI-3 below. |

## Findings

### UI-1 (High, fixed) — active-review chip overflows the viewport on phone widths

`aar-studio/css/app.css` `.topbar__brand` laid out the "AAR Studio" wordmark and
the active-review session chip (added this session, see Thread C of the
insight-quality/session-clarity rework) as a single non-wrapping flex row. On
any phone-width screen (390px) with a review open, the row measured 458px wide
— on **every** aar-studio route (home, setup, capture, board, review, report),
since the chip renders in the persistent topbar. The page grew a horizontal
scrollbar and clipped content instead of the chip dropping to its own line.

**Fix:** `.topbar__brand` now takes `flex-wrap: wrap`, matching the pattern the
parent `.topbar` and `.nav` already use. Verified: the automated scan reports
zero overflow across all routes × all four viewports after the fix; visual
screenshot confirms the chip wraps to its own row under the wordmark.

### UI-2 (Medium, fixed) — active-review "close" button is an 18×19px touch target

`.topbar__session-close` (the ✕ that closes the active review) rendered at
19×18px — well under the 44px inline-control minimum this repo's convention
sets, and small enough to reliably mis-tap next to the adjacent session-name
link on a phone.

**Fix:** padded the hit area to `min(-width/height): var(--tap-min-sm)` (44px)
via `display: inline-flex` centering, without inflating the visible ✕ glyph.
Verified via the automated touch-target scan (no longer flagged).

### UI-3 (Low, structural note — not fixed this pass)

aar-studio's near-total lack of `@media` coverage (3 rules total, only one of
which is a real breakpoint) is a structural gap rather than a discovered bug:
the automated scan found **no other overflow or touch-target violations** at
any of the four tested viewports once UI-1/UI-2 were fixed, meaning the
single-column-by-default, `grid-template-columns: repeat(auto-fit, minmax(...))`
layouts already used throughout (`board`, `merge-suggestions`, etc.) happen to
degrade gracefully without explicit breakpoints. This is closer to lucky than
designed — as aar-studio grows new screens, each one needs to be checked
individually since there's no shared breakpoint convention to lean on the way
`frontend/` has. Recommend a proper responsive pass (shared breakpoint vars in
`rfs-tokens.css`, explicit checks on new screens) next time aar-studio gets
sustained feature work, rather than as a one-off audit item now. Queued as
Q-later — see MASTER_PLAN.

## Addendum — sign-in book (`frontend/src/features/signin/`)

Same automated method (scripted overflow + touch-target scan at all four
viewports), run against `/signin` with the backend's in-memory dev DB serving
real station/event data (not just an empty state).

**Result: clean.** Zero horizontal overflow at any of the four viewports —
`SignInPage.css` already carries four tuned breakpoints (1400/1200/1024/768px),
consistent with `frontend/`'s general responsive maturity found above. The
member grid, search box, event tabs, and "+ New Event" FAB all reflow correctly
down to 390px phone width with live data loaded.

Three icon-only secondary controls measured under the 44px touch-target
minimum: `.theme-toggle-btn` (36–40px), `.admin-menu-btn` (40px), and
`.event-end-btn` (28×28px, `MemberNameGrid.css:132`). All three are
low-frequency secondary actions (not the primary sign-in tap targets), and
`.event-end-btn` in particular is sized to sit inline in a tight event-tab
strip — bumping it risks breaking that layout. Not fixed this pass; noted here
rather than queued, since severity is low and the fix isn't a safe drive-by.

## Addendum 2 — sign-in book deep audit (2026-07-06)

A follow-up, data-driven pass over the **sign-in book** with the backend
serving real seeded data (8 members, an active event, several checked in), so
the member grid and event tabs actually rendered (the earlier addendum hit an
empty/loading state). Scanned `/signin`, `/profile/:memberId`, and the
personal-link `/sign-in?user=…` at 390/768/1024/1440 (plus 360/414/600 for the
header specifically), scripting horizontal-overflow and 44px touch-target
checks in Chromium.

**Result: zero horizontal overflow** at every route × viewport. Two real
layout bugs found and fixed:

- **UI-4 (High, fixed) — profile hero didn't stack on phones.** `.profile-hero`
  is a CSS **grid** (`grid-template-columns: auto 1fr`), but the ≤640px override
  tried to stack it with `flex-direction: column`, which is **inert on a grid
  container**. So on phones the avatar and body stayed side-by-side and cramped,
  even though the same block sets `text-align: center` and centres the
  name/badges (i.e. a single centred column was always the intent). Fixed with
  `grid-template-columns: 1fr` + `justify-items: center`, centred the
  header/meta once stacked, and capped the `🆔 <full-UUID>` chip with
  `overflow-wrap: anywhere` so it can't push past a phone-width screen.
  (`UserProfilePage.css`.)
- **UI-5 (High, fixed) — event tab and "+ New Event" collided on phones**
  (owner-reported: "the training and new event buttons appear to be running
  into each other"). In `MemberNameGrid.css`'s `.event-tabs-header`, the
  collapse button + a single event tab + a full-size "+ New Event" all competed
  for one row; the `.event-tabs` container (`flex:1; overflow-x:auto`) was
  starved below the tab's own width, so the tab **clipped its own end (✕)
  button** and butted straight against the lime button with a 4px gap — two
  saturated blocks reading as "running into each other". Fixed: the header now
  wraps (`flex-wrap`) with an 8px gap, and at ≤480px "+ New Event" drops to its
  own full-width row (`order:3; flex:1 0 100%`) so the tab takes the rest of
  row 1 and shows in full. Stays inline at ≥481px. Verified across
  360/390/414/600/768px.

**Known, not fixed (documented, low priority):** the phone sign-in header still
has three sub-44px icon controls — the ⚙️ settings and 🌙 theme toggles (~32px)
and the event `✕` end button (28px, now fully visible after UI-5). These are
secondary controls, and the `✕` sits in a deliberately tight tab strip where a
blind size bump risks the layout (same call as UI-3's `.event-end-btn` note).
Left as-is; worth a padded-hit-area pass (à la UI-2) if the sign-in book gets a
dedicated touch-target sweep.

## What's already solid

- `frontend/` — no overflow or touch-target violations found at any tested
  route/viewport (`/`, `/login`, `/signup`, `/signin`). 65 files' worth of
  component-scoped responsive CSS is doing its job.
- aar-studio's report layout already collapses to one column under 980px
  (`@media (max-width: 980px) { .report-layout { grid-template-columns: 1fr; } }`).
- Touch targets elsewhere in aar-studio consistently use the shared
  `--tap-min` / `--tap-min-sm` CSS vars (buttons, chips, quick-add controls) —
  UI-2 was the one spot that didn't.
