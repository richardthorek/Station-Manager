# Station Manager — Automated Browser QA Walkthrough

> **For Claude running in the Chrome browser extension.** This is an executable
> test script. Work through it top-to-bottom. For **every** checkpoint: perform
> the action, observe the result, take a screenshot, and record PASS / FAIL with
> a one-line note. **Do not stop on a failure** — log it and continue, so one
> broken step doesn't block the rest of the run. Produce a final results table at
> the end (step, status, note, screenshot reference).

## How to run this

1. Read the whole file once before starting so you know the arc.
2. Keep a running results log in memory; emit the final table at the end.
3. On any unexpected dialog, console error, or blank screen: screenshot it,
   note it against the current step, and continue.
4. Open Chrome DevTools console at the start and check it after each major
   section — React key warnings, failed fetches, and unhandled errors all count
   as findings.

## Preconditions

- **Base URL:** ask the operator if not obvious; default to the running dev
  server (`http://localhost:5173`) or the deployed origin.
- **Login:** you need an admin account. If you don't have credentials, pause and
  ask the operator for them — do not guess or attempt to bypass auth.
- Confirm the backend is reachable (the sign-in screen loads with no error
  banner) before proceeding.

---

## Section 0 — Setup

- [ ] Navigate to the base URL. **Check:** the landing/sign-in screen renders, no
  error banner. Screenshot.
- [ ] Log in as an admin user. **Check:** you reach the authenticated home view.
  Screenshot.
- [ ] Open DevTools → Console. **Check:** no red errors on initial load. Note any.

---

## Section 1 — Vehicle Types (authoring standard checklists)

Navigate: **TruckCheck → Admin → Vehicle Types**.

- [ ] Click **"+ New Vehicle Type"**. **Check:** modal opens.
- [ ] Enter name `Cat 1 Tanker`, category `tanker`, leave "Publish as a shared
  standard" ticked.
- [ ] Add three standard checks: `Tyre condition`, `Water level`, `Fuel level`.
  Use the ↑/↓ controls to reorder one, then put it back. Remove one check and
  re-add it. **Check:** the list reflects each edit.
- [ ] **Backdrop close test:** click the dark area outside the modal. **Check:**
  modal closes without saving (the type does not appear in the grid).
- [ ] Reopen via "+ New Vehicle Type", re-enter the same data, then press
  **Escape**. **Check:** modal closes (Escape-to-close works).
- [ ] Reopen once more, re-enter the data, click **Create**. **Check:** a card
  appears in the grid showing `Cat 1 Tanker`, a **standard** badge, and
  "3 standard checks". Screenshot.
- [ ] Click **✏️ Edit** on the card. Rename one check and edit its description.
  Click **Update**. **Check:** the change persists after the modal closes.
- [ ] Create a second type `Support Vehicle` with **no** standard checks.
  **Check:** its card shows "0 standard checks".

---

## Section 2 — Vehicle Management (identity fields + template editor)

Navigate: **TruckCheck → Admin → Manage Vehicles**.

- [ ] Create a vehicle: name it (e.g. `Tanker 1`), fill **make, model, year,
  registration, agency ID**, and assign it to the **Cat 1 Tanker** type. Save.
- [ ] **Identity subtitle:** on the new vehicle's card, **check** the subtitle
  shows agency ID · make/model/year · registration. Screenshot.
- [ ] Open the **template / checklist editor** for that vehicle.
- [ ] **Locked standard items:** **check** a "🔒 Standard items" section appears
  at the top listing the three checks from the type, all **read-only** (no edit
  inputs; the locked note is visible). Screenshot.
- [ ] **Custom items:** in the "✏️ Custom items" section below, add one custom
  check, reorder it, and save. **Check:** the custom item persists; the standard
  items remain locked and unchanged.
- [ ] Create a **second vehicle with no type assigned**. Open its template
  editor. **Check:** there is **no** "🔒 Standard items" section — only the
  custom section. Screenshot.

---

## Section 3 — Check workflow (roster typeahead + effective checklist)

Navigate: **TruckCheck** hub. Locate the **Tanker 1** card.

- [ ] **Identity on hub card:** **check** make/model/year and registration appear
  under the vehicle name. Screenshot.
- [ ] **Open-issues badge (baseline):** **check** whether a "⚠ Open issues" badge
  is present. For a brand-new vehicle it should be **absent**. Note state.
- [ ] Tap the card to **start a check**.
- [ ] **Roster typeahead:** in the "Who is doing this check?" field, type a
  partial member name. **Check:** matching members appear in a dropdown; select
  one. Screenshot.
- [ ] **Effective checklist:** **check** the standard checks appear first (in
  order) followed by the custom check from Section 2.
- [ ] Work through the checklist. Mark most items **pass**, add a note to one.
- [ ] Mark **one item as fail** and add a fault description. Complete/submit the
  check. **Check:** submission succeeds and you return to the hub.

---

## Section 4 — Admin Dashboard (history, follow-ups, resolution modal)

Navigate: **TruckCheck → Admin → Dashboard**.

### History tab
- [ ] **Check:** the just-completed run appears with correct vehicle, date, and
  **inspector name from the roster selection** (not free text). Screenshot.
- [ ] Open the run detail. **Check:** all items show their pass/fail status and
  the notes you entered.

### Follow-ups tab
- [ ] **Check:** the failed item from Section 3 appears as an open issue.
- [ ] Click **Acknowledge**. **Check:** status updates to *acknowledged* with
  **no browser `prompt()` dialog** appearing. Screenshot.
- [ ] Click **Resolve**. **Check:** an **inline modal** opens (not a native
  dialog). Screenshot.
- [ ] Press **Escape**. **Check:** the modal closes (cancel path).
- [ ] Reopen Resolve, fill **"Resolved by"** and **"Resolution note"**, submit.
  **Check:** the issue clears from the Follow-ups list (or shows a resolved
  state). Screenshot.

### Manage Vehicles tab (within dashboard)
- [ ] **Check:** all vehicles list. Edit one vehicle's registration and save.
  **Check:** the change persists.

---

## Section 5 — Badge regression

Navigate back to the **TruckCheck** hub.

- [ ] **Check:** the "⚠ Open issues" badge is now **gone** from Tanker 1 (the
  issue was resolved). Screenshot.
- [ ] Start and complete a **second check** on Tanker 1 with **all passes**.
  **Check:** no open-issues badge appears afterward, and the new run is at the
  top of the history list.

---

## Section 6 — AAR Studio (cloud sync + loading state)

> Skip this section if the org is single-tenant/kiosk with no cloud sync.

Navigate: **`/aar`** → Home.

- [ ] **Check:** "Your reviews" lists existing local reviews. Screenshot.
- [ ] **Check:** a "From your team" cloud section loads (may be empty if no other
  device has synced).
- [ ] **Loading state:** click a cloud card. **Check:** the card dims and becomes
  non-interactive (`review-card--loading`) while fetching, then navigates to the
  board on success. Screenshot the dimmed state if you can catch it.
- [ ] **Error path (optional):** if you can simulate offline (DevTools → Network →
  Offline), click a cloud card. **Check:** a toast error appears and the card
  returns to normal (loading class removed). Restore the network after.
- [ ] **"Newer version" flag:** if a local review has a newer cloud copy, **check**
  the ☁ flag and ⟳ "Load latest" button appear; clicking ⟳ shows the loading
  state then opens the board.

---

## Section 7 — Accessibility & keyboard

- [ ] **Vehicle Types modal:** open it, Tab through all fields, confirm focus
  stays sensible, press Escape to close.
- [ ] **Resolve modal:** reach the resolve action via keyboard (Tab + Enter),
  fill fields with the keyboard, confirm Tab stays within the modal, Escape
  cancels.
- [ ] **Hub cards:** confirm interactive elements are reachable via Tab and
  activate with Enter/Space.

---

## Section 8 — Final smoke

- [ ] Log out. **Check:** `/truckcheck` redirects appropriately (auth/feature
  gate). Screenshot.
- [ ] Log back in. **Check:** all TruckCheck tabs load with no console errors.
- [ ] Review the DevTools console for the whole session. **Check:** zero
  unhandled errors/warnings. List anything found.

---

## Final output

Produce a results table:

| Section | Step | Status | Note | Screenshot |
|---------|------|--------|------|------------|

Then a short summary: total PASS / FAIL, the most serious failure (if any), and a
recommendation (ship / fix-first). Attach all screenshots.
