# Sign-in & landing sequences — review (2026-07-03)

**Directive (owner):** after signing in, users are deposited in an admin
console with no obvious navigation. Unless the user was following a specific
link, sign-in should land on the **app picker**. This review traces every
entry sequence (marketing → login → landing, signup, protected-route
redirects, admin wayfinding) and documents what to change. Companion to the
same-day [AAR Studio hero review](AAR_STUDIO_REVIEW_20260703.md); findings
are `LL-n`.

## The sequences as built

| Sequence | Today | Verdict |
|---|---|---|
| Logged-out visit to `/` | Marketing/pricing page | ✅ correct |
| Signed-in visit to `/` (or `?demo=true`) | App picker (`LandingPage`) | ✅ correct — `HomeRoute`'s comment even declares the app picker "the post-login home" |
| Direct login (`/login`, marketing "Sign in") | **Lands on `/admin/stations`** | ❌ LL-1 |
| Login via a protected deep link | Returns to the requested page (`state.from`) | ✅ correct |
| Signup | Lands on `/admin/organization` | ⚠ LL-3 |
| Inside admin pages | Small "← Home" text links only; no shared nav | ⚠ LL-2 |
| Signed-in visit to `/login` | Shows the login form again | ⚠ LL-4 |

## Findings

- **LL-1 · High · UX — Post-login default is the Stations admin console, not
  the app picker.** `frontend/src/features/auth/LoginPage.tsx:32`:
  `const from = location.state?.from || '/admin/stations'` — the comment says
  "default to admin page". Anyone signing in from the marketing page or by
  typing `/login` is dropped into station management: an admin console, first
  thing, with no context. The intended home already exists — `HomeRoute`
  renders the app picker for authenticated users at `/`, and `/apps` is an
  explicit alias. `ProtectedRoute` (`components/ProtectedRoute.tsx:34`)
  correctly passes `state.from`, so deep links keep working if the default
  changes. **Direction:** change the fallback to `/`. One-line fix plus test
  updates; verify no test relies on the `/admin/stations` default.

- **LL-2 · Medium · UX — Admin pages have no shared navigation.** The three
  admin pages each hand-roll a small `← Home` / `← Back to Home` text link
  (`StationManagementPage.tsx:235,251`, `OrganizationPage.tsx:175,193`,
  `BrigadeAccessPage.tsx:185-186`) and nothing else — no shared header, no
  way to move between admin areas (Stations ↔ Brigade Access ↔ Organization)
  without going back to the picker, no logout (logout lives only on the
  landing page). This is why the post-login experience reads as "stranded in
  an admin console". **Direction:** a shared admin header/breadcrumb
  component: Bushie Tools home link, the three admin section links, the
  signed-in user + logout. Keep it lightweight — same pattern as the AAR
  Studio topbar.

- **LL-3 · Low-Medium · UX — Signup always lands on the Organization admin
  page.** `SignupPage.tsx:59,64` navigates to `/admin/organization` after
  account creation (deliberate for the paid-plan checkout flow, and correct
  *for that flow*). But a plain free signup — no `?plan=` intent — also lands
  there, facing a plan-management console instead of the product they just
  signed up for. **Direction:** keep billing-intent signups on
  `/admin/organization`; send plain signups to `/` (app picker) with a
  welcome toast; the picker already surfaces upgrade paths.

- **LL-4 · Low · UX — `/login` renders the form for already-authenticated
  users.** `LoginPage` never checks `isAuthenticated`
  (`LoginPage.tsx:20-46`); a signed-in user following an old bookmark gets an
  empty login form. **Direction:** if already authenticated, redirect to
  `state.from ?? '/'`.

## Implementation notes for the fixing agent

- LL-1 and LL-4 are a few lines in `LoginPage.tsx` + tests
  (`LoginPage.test.tsx` if present — check for assertions on
  `/admin/stations`).
- LL-2 is a new shared component; sweep the three admin pages onto it and
  remove the ad-hoc back-links. iPad portrait/landscape screenshots required
  (UI change convention).
- LL-3 touches the signup flow — don't break the Stripe checkout deep-link
  path (`?plan=…&interval=…`), which must still land on checkout/organization.
- Update `docs/wiki/user-guide/getting-started.md` ("Logged-in users land on
  the app picker") if wording changes, and the changelog + master-plan queue
  item (Q3 as of this review) when shipped.
