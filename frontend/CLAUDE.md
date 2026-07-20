# frontend/ — React 19 + Vite 7 + TypeScript

The main SPA + PWA at `/`. See root `CLAUDE.md` for the work loop, cross-app
seams, and shared conventions. This file loads when you work in `frontend/`.

## Commands (from `frontend/`)

```bash
npm run dev            # Vite dev server, port 5173
npm test               # Vitest + React Testing Library
npm run lint           # ESLint (CI gate — zero warnings)
npx tsc -b --noEmit    # typecheck (CI gate)
npm run build          # tsc -b && vite build
```

## File index (`frontend/src/`)

- `App.tsx` — Router; **all routes lazy-loaded** via `React.lazy` + `<Suspense>`.
  `main.tsx`, `index.css` (CSS vars / RFS theme), `animations.css`.
- **features/** (route-level, self-contained): `landing/` (`/` app picker),
  `signin/` (`/signin` gated, `/sign-in` ungated entry), `profile/`, `auth/`
  (`/login`, `/signup`), `account/` (`/account`), `admin/stations/`,
  `admin/brigade-access/`, `admin/organization/`, `admin/platform/` (owner
  console), `reports/` (gated), `truckcheck/` (gated). AAR Studio is **not** here
  — it's the separate `aar-studio/` bundle, linked as a plain `<a href="/aar/">`.
- **components/** — shared UI: `Header`, `Toast`, `MemberList`,
  `ActivitySelector`, `EventCard`, `DataTable`, charts (`HeatMapChart`, `KPICard`,
  `InsightCard`), PWA bits (`InstallPrompt`, `OfflineIndicator`), and the two
  gates: **`FeatureRoute`** (entitlement) and **`ProtectedRoute`** (auth). Most
  have a colocated `.css` and many a `.test.tsx`.
- **contexts/**: `AuthContext` (`hasFeature()` reads org entitlements from
  `/api/auth/me`), `StationContext`, `ToastContext`.
- **hooks/**: `useSocket` (real-time), `useTheme`, `useToast`, `useDebounce`,
  `useFocusTrap`, `useSwipeGesture`, `usePullToRefresh`.
- **services/**: `api.ts` (**all** REST calls go through here), `offlineQueue`,
  `offlineStorage`, `offlineSupport`.
- **utils/**: `exportUtils` (+ `.lazy`), `csvUtils`, `analyticsHelpers`,
  `errorHandler`, `kioskMode`, `haptic`, `announcer`, `animations`.
- **types/**, **test/** (setup, mocks, render utils).

## Frontend conventions & gotchas

- **Function components + hooks only. Named exports.** Route components **must**
  be lazy-loaded and wrapped in `<Suspense fallback={<LoadingFallback />}>`.
- **Gate plan features on both sides**: wrap the route in `<FeatureRoute
  feature="...">` here **and** add `requireFeature(...)` on the backend mount.
  Use `<ProtectedRoute>` for auth/admin routes — never mix feature and auth gates.
- **CSS**: component-scoped files, BEM-ish names, use vars from `index.css`. **No
  inline styles.** Brand tokens are `@import`ed from the canonical
  `aar-studio/css/rfs-tokens.css` (see the top of `index.css`) — not hand-copied.
  Never hardcode a brand hex; add a token upstream if one doesn't exist yet.
  Sub-page headers (back arrow + title + collapsible actions) use the shared
  `components/PageHeader.tsx` — don't hand-roll another `.back-link`.
- **All REST calls** go through `services/api.ts` — don't `fetch()` directly.
- **The service worker** (`vite.config.ts` `VitePWA`/`workbox`) is a cross-app
  seam: keep `navigateFallbackDenylist: [/^\/aar/, /^\/api/]` and remember
  `connect-src` (backend CSP) governs SW `fetch()`. See root `CLAUDE.md`.
- **UI changes need iPad portrait + landscape screenshots in the PR.** Touch
  targets ≥ 60px (kiosk), 44px minimum inline/desktop. WCAG 2.1 AA.
