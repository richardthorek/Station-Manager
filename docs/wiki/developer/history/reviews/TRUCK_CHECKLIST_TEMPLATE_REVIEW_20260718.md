# Truck Check Sheet vs. Standard Template Review — 2026-07-18

**Scope.** Compare five real, brigade-accepted paper "Maintenance check sheet 2026"
forms against the pre-provisioned standard vehicle-type templates the app seeds
(`backend/src/constants/standardVehicleTypes.ts`). The paper sheets are the
brigade's *well-tested and accepted* ground truth; the question is how well the
seeded templates reproduce them and what should change.

**One-line verdict.** The seeded templates are a reasonable generic *skeleton* but
capture only ~40% of what a proven brigade sheet actually asks for, and omit
several **safety-critical** checks entirely (fire extinguisher, AED, BA set,
air-brake moisture bleed, battery security). The bigger gap is depth: every seeded
item has an empty `description`, whereas the accepted sheets are defined almost
entirely by their thresholds, locations and procedural steps. The data model
already supports all of this — the seed simply doesn't use it.

---

## 1. The sheets reviewed

| Sheet (paper) | Fleet role | Rev | Closest seeded type |
|---|---|---|---|
| **PC Bravo** | Personnel carrier (no pump/tank; AED, first aid, load area) | 2026 v1 | `group-personnel-vehicle` |
| **B1** | Cat 1 tanker (pump, 120–130 psi, foam drum, BA) | 2026 (v2) | `cat1-tanker` |
| **Pumper** | Urban pumper (RAM fan, generator, foam tank, CO₂) | 2026 v2 | `urban-pumper` |
| **B7** | Cat 7 tanker (smaller: 60–65 psi, 600 kpa, single portable pump) | 2026 v1 | `cat7-tanker` |
| **LG Support 6** | Support truck that *also* carries pump/water/foam A&B, monitor & axe | 2026 v2 | `group-personnel-vehicle` (imperfect) |

All five share one house style — same column layout (**Check Item / OK / Not Ok /
Notes**), same walk-around order, same procedural bookends — so they read as one
maturely-iterated family, not five independent forms. That consistency is exactly
what a good standard template should encode.

---

## 2. Structural findings (these apply to every sheet)

**F1 — Order follows a physical + operational walk, not category buckets.**
The accepted flow is: *under-vehicle → engine bay → cabin → **start & move to
forecourt** → running checks → pump/water ops → BA → portable equipment →
stowage/lockers → safety items → sign-off → isolate/charger.* The seed stacks
abstract groups (`FLUIDS → TYRES → FUEL → ROAD_LIGHTS → EMERGENCY_WARNING →
PUMP_WATER → LOCKERS`). Fuel, for instance, is checked mid-cabin on paper but sits
third in the seed; there is no "start engine / move to forecourt" pivot at all.
The `section` field on `ChecklistItem` exists to model exactly these named areas
and is currently unused by the seed.

**F2 — Procedural steps are first-class on paper, absent in the seed.** The sheets
contain non-inspection *actions* that gate the whole check and are safety-relevant:
- "Before commencing check, remove 240v MDT charge cable" … "Isolate truck **ONLY
  AFTER 5 MINUTES FROM IGNITION OFF**, connect charger" (start/end bookends).
- "Restart MDT", "Start Engine and move to forecourt".
- "Valve settings review — **Foam OFF, Bypass ON**", "Run pump and check pressure
  to *N* kpa", "**Turn off fuel**" after each run-test.
- "Signoff Check Sheet on page 2."

None appear in any seeded template. The model can represent them
(`expectedResponseType: 'text'`, or a plain `ok-issue` step) — they're just missing.

**F3 — The value is in the descriptions, and every seeded description is `""`.**
The accepted sheets are almost entirely thresholds and locations:
- Tyre pressures **50 psi** (PC Bravo), **120–130 psi** (B1/Pumper/LG),
  **60–65 psi** (B7); "checked 1st Friday of each month".
- Fuel "**if less than ¾** get truck filled".
- Radio channels "**PRN=119 LKGRG A, UHF=28, VHF=FGND 14**".
- Pump targets **600 / 1000 / 1500 kpa** (per truck).
- Fire extinguisher "**Dry Chem (gauge in the green)**", plus CO₂ on the pumper.
- Cabin water counts: 4 / 6 / "10 in rear + 2 front" / "2 in console".

The seed carries `name` only. `ChecklistItem.description`, plus
`expectedResponseType: 'numeric'` + `unit` (e.g. `psi`, `kpa`) and `'level'` for
the Bad–OK–Good oil gauge printed on B1/Pumper/LG, are built for this and unused.

**F4 — Granularity is inverted vs. practice.** The seed *over-splits* what crews
group and *omits* what they detail. Lights are five separate seeded rows
(`headlights / indicator / brake / reverse / hazard`); the accepted sheets fold
these into two action lines ("Wipers, washers, lights (incl. brake and reverse)
and indicators" + "Lights and indicators, locker, work and step lights").
Meanwhile the seed has **no** fire-extinguisher, AED, battery, BA, or radio row at
all. Fewer, action-oriented lines with a rich description beat many bare toggles.

**F5 — Much of the richness is per-*appliance*, not per-*type*.** Two tankers in
the same brigade differ materially: B1 runs 120–130 psi / 1000 kpa / 10+2 water /
2 portable pumps; B7 runs 60–65 psi / 600 kpa / 6 water / 1 portable pump, and
starts its pump from a crew-bay control panel. So specific pressures, channel
numbers, bottle counts and locker contents belong in the **per-appliance overlay**
(`ChecklistTemplate` custom items + `ApplianceZone`/`ApplianceEquipment`), while
the *universal* items belong in the seeded type. The review's recommendations keep
this split.

---

## 3. Item-level gap analysis (Cat 1 Tanker — B1 is the richest sheet)

`cat1-tanker` seeds 24 items; the B1 sheet has 35. Mapping them:

**Seeded items with no real-world counterpart on the sheet (candidates to drop/park):**
`power-steering`, `spare-tyre`, `adblue-level` (none of the five diesels list AdBlue),
and the split `hazard-lights` / separate `scene-lights` rows (folded into bundled
light lines in practice).

**Accepted items missing from the seed (candidates to add). Bold = safety-critical:**

| Missing check | On sheets | Model fit |
|---|---|---|
| **No Leaks Under Vehicle** | all 5 | `ok-issue`, section "Under Vehicle" |
| **Batteries secure / dust cover clipped / charge indicator green** | all 5 | no battery row exists in any road template |
| **Briefly bleed brake air tanks — check for moisture** | B1, Pumper, LG | air-brake vehicles; `ok-issue` |
| Clutch fluid (paired with brake) | PC Bravo, B7 | extend `brake-fluid` desc |
| Cabin equipment (pens, maps, **Kestrel**, masks, gloves, blankets) | all 5 | `text`/`ok-issue` |
| Radio battery + **channel programming** | all 5 | no comms row on RFS road types |
| **Restart MDT** | all 5 | procedural `ok-issue` |
| **Start engine / move to forecourt** | all 5 | procedural |
| Cabin water supplies (counts) | all 5 | `numeric`, per-appliance count in desc |
| Water tank full | B1, B7, Pumper, LG | seed has `tank-level` (ok) |
| Pump — oil level / damage / leaks | all pump trucks | seed `pump-prime` is close, reword |
| **Valve settings — Foam OFF, Bypass ON** | B1, Pumper, LG | procedural `text` |
| **Run pump to target kpa** | B1(1000) B7(600) Pumper(1500) LG(1000) | `numeric` + `unit:'kpa'`, target per-appliance |
| Foam tank/drum levels (A & B on LG) | all pump trucks | seed `foam-stock` (ok), add `level` |
| Hose reels operation / rewind | all pump trucks | seed `hoses-branches` close |
| **BA checks — qualified operator, BA board** | B1, Pumper | absent from every RFS template |
| RAM fan / Generator run-test | Pumper | equipment-level (per-appliance) |
| Portable pumps ×N run-test — **turn off fuel** | all pump trucks | equipment-level |
| Drip torches / spare fuel (diesel + torch fuel) | most | equipment-level |
| Hose stocks per shelf numbers | all pump trucks | `text` |
| Lockers: traffic wands, red/blue flares, Pelican light, Drager battery | most | equipment-level |
| Ladders / **Hydrants ×2 secured** | B1, Pumper, LG | `ok-issue` |
| **AED (check status)** | all 5 | seed has first-aid but no AED |
| **First Aid Kit present** | all 5 | seed `first-aid-kit` (only in CONSUMABLES groups) |
| **Fire Extinguisher — Dry Chem gauge green (+ CO₂ pumper)** | all 5 | **no fire-extinguisher row in any seeded type** |
| Signoff (page 2) | all 5 | procedural |
| **Isolate truck / 5-min wait / connect charger** | all 5 | procedural bookend |

Net: the seed reproduces roughly 13–15 of the 35 accepted lines, and the ones it
does cover are shallower (no thresholds, locations, or targets).

The same pattern holds across the other four sheets:
- **PC Bravo** (personnel): seed `group-personnel-vehicle` misses AED, fire
  extinguisher (Dry Chem), fire blankets, load-area bottled water, MDT bookends,
  Kestrel/cabin kit — i.e. most of the sheet.
- **Pumper**: additionally needs RAM fan, generator, CO₂ extinguisher,
  foam-tank, angle-grinder/Drager/Pelican battery states — none seeded.
- **B7**: proves F5 — same `cat7-tanker` type as a sibling would need entirely
  different pressure/kpa/count values; those must be per-appliance.
- **LG Support 6**: mis-typed by the catalogue — it carries pump + water + foam
  A&B + monitor & axe but the only "support" seed (`group-personnel-vehicle`) has
  **no** `PUMP_WATER` group. Either a new "Support Tanker / Light Pumper" type or a
  `cat9-tanker` mapping fits better.

---

## 4. Data-model fit (the good news)

Nothing here needs a schema change. Everything the accepted sheets do maps onto
existing fields:

- Named walk-around areas → `ChecklistItem.section` (or the richer per-appliance
  `ApplianceZone` with `side`/`order` for the AI walk-around).
- Thresholds/locations/channels → `ChecklistItem.description`.
- Gauge readings → `expectedResponseType: 'numeric'` + `unit` (`psi`, `kpa`).
- Bad–OK–Good oil gauge → `expectedResponseType: 'level'`.
- Procedural steps → `ok-issue`/`text` rows.
- Per-truck kit (RAM fan, portable pumps, Drager, Pelican) → `ApplianceEquipment`,
  with per-appliance counts/values living in the `ChecklistTemplate` overlay.
- Response columns OK / Not Ok / Notes already match `CheckStatus`
  (`done`/`issue`) + `comment`.

So this is a **content** gap in the seed, not a capability gap.

---

## 5. Recommendations (prioritised)

Split by where each belongs, per finding F5.

**R1 — Add the universally-missing, safety-critical rows to the seeded types
(bump `SEED_VERSION`).** At minimum, every road appliance should seed: *No Leaks
Under Vehicle*, *Battery secure/charge*, *Fire Extinguisher (type + gauge)*, *AED*,
*First Aid Kit*, and *Restart MDT / Isolate + charger* procedural bookends; every
air-braked truck adds *bleed brake air tanks*; every pump truck adds *valve
settings (Foam OFF/Bypass ON)*, *run pump to target kpa* (`numeric`+`unit`), *foam
level*, and *BA checks*. These are agency-universal, not brigade-specific.

**R2 — Populate `description` on seeded items with the guidance text, and set
`expectedResponseType`/`unit` where the sheet asks for a reading** (tyre `psi`,
pump `kpa`, oil `level`). Leave the *specific target values* out of the seed — put
a placeholder like "target set per appliance" — because they vary per truck (R4).

**R3 — Fix the group composition.** Drop `power-steering`, `spare-tyre`,
`adblue-level` from the RFS road types (not present on any accepted sheet); collapse
the five `ROAD_LIGHTS` rows toward the two bundled action-lines crews actually use;
add a comms/`radio`+`mdt` group and a `safety` group (extinguisher/AED/first-aid)
reused across types. Add a "Support Tanker / Light Pumper" type (or map LG-class
trucks to `cat9-tanker`) so pump-carrying support trucks aren't typed to a
pump-less template.

**R4 — Document the per-appliance overlay as the home for brigade specifics.**
Pressures (50 / 60–65 / 120–130 psi), pump targets (600/1000/1500 kpa), channel
numbers, water-bottle counts, locker contents and portable-kit counts are
per-truck and belong in the `ChecklistTemplate` custom items +
`ApplianceZone`/`ApplianceEquipment`, not the shared seed. This validates the
existing overlay design; the review recommends a short admin-guide note so
brigades know where these values go.

**R5 — Treat these five sheets as the seed's acceptance fixture.** They're proven
in service; a small test that asserts each seeded RFS type contains the R1 safety
rows would stop future seed edits from regressing them back out.

Forward-intent items from this review are logged in `MASTER_PLAN.md` (queue), per
the docs structure rule; this file is the point-in-time evidence.

---

## 6. Update — implemented 2026-07-18 (Q47)

Fleet mapping confirmed by the brigade: B1 = Cat 1, B7 = Cat 7, LG Support 6 =
**Cat 6** (a bulk water tanker with full firefighting equipment — front-mounted
monitor/water cannon, pump and hoses — distinct from a bare bulk-water carrier
that only transfers water with no firefighting kit), Pumper = Urban Pumper
(Cat 10/11), PC Bravo = a dual-cab ute Personnel Carrier folded into the
existing Group/Personnel Vehicle type.

R1–R5 implemented in `backend/src/constants/standardVehicleTypes.ts`
(`SEED_VERSION` 1 → 2), scoped to exactly the 5 types this review has evidence
for — the other 15 seeded templates (SES, Fire & Rescue NSW, Marine Rescue,
Generic) are untouched:

- **New `std-cat6-tanker` type added** (21 standard types total, was 20) —
  Cat 1/6/7/Pumper/Group-Personnel all rebuilt from new `RFS_*` reusable groups
  (not the old shared `FLUIDS`/`TYRES`/`ROAD_LIGHTS`/etc., which stay exactly as
  they were for the untouched agencies).
- **R1 — safety-critical rows added**: `no-leaks-under-vehicle`,
  `battery-secure`, `fire-extinguisher`, `aed-status`, `first-aid-kit` on all 5
  types; `air-brake-bleed` on the air-braked heavy trucks (Cat 1 / Cat 6 /
  Pumper); `ba-checks` on Cat 1 / Pumper (not present on the Cat 6/7/PC sheets);
  MDT-charger disconnect/reconnect and signoff procedural bookends on all 5;
  Cat 6 gets a `monitor-firefighting-kit` item for the water cannon/monitor the
  brigade flagged as the category-defining difference; Urban Pumper gets its
  CO2 extinguisher, RAM fan, generator and grinder-battery items.
- **R2 — descriptions populated** on every new/reworked item; gauge/reading
  items got `expectedResponseType`/`unit` (tyre `psi`, pump-pressure `kpa`,
  fuel `level`) — specific target *values* deliberately left to the appliance
  overlay (R4), not hardcoded in the shared seed.
- **R3 — group composition fixed** for these 5 types only: dropped
  `power-steering`/`spare-tyre`/`adblue-level` (not on any accepted sheet),
  collapsed the 5 split light rows to the 2 bundled action-lines crews actually
  use, added the Cat 6 type so pump-carrying support trucks aren't mistyped to
  a pump-less template.
- **R4** — confirmed by construction: no truck-specific pressure/kpa/channel/
  count value was hardcoded into the seed; each `RFS_*` group's description
  points at "see appliance notes" instead.
- **R5 — acceptance-fixture tests added** in `standardVehicleTypeSeeder.test.ts`:
  asserts all 5 road types keep the universal safety itemCodes, the 3 air-braked
  types keep `air-brake-bleed`, and Cat 6 keeps `monitor-firefighting-kit`.

*Backend: `npx tsc --noEmit` clean; full suite 1106 → 1107 tests green (1
pre-existing skip), no regressions, run with `AZURE_STORAGE_CONNECTION_STRING`
unset to confirm against the in-memory DB (a live connection string was present
in the shell environment — see Q5's changelog entry for the same gotcha).*

Not done in this pass (left as follow-up, not filed as a new Q-item — low
value until it's a live complaint): zone-vocabulary starter zones for the new
`cat6-tanker` code (falls back to empty zones, matching the existing
"unknown code" behaviour — not a regression), and the admin-guide note on where
per-appliance values go.
