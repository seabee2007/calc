# Type Model Fix Pass 2 — Store Preferences + Strict Fixtures

**Date:** 2026-06-03  
**Scope:** Align `PreferencesState` with `UserPreferences`, complete `ProposalData` test/preview fixtures, fix `ScheduleEvent.recurrenceRule` in test mocks, and clear targeted null/undefined assignability issues. No runtime behavior, Supabase schema, pricing math, or document builder logic changes.

---

## TypeScript (`npx tsc -p tsconfig.app.json --noEmit`)

| Metric | Count |
|--------|------:|
| **Before** | 313 |
| **After** | 251 |
| **Delta** | −62 |

`TS6133` / `TS6196` (unused imports/types) were **not** cleaned in this pass (~188 `TS6133` remain — defer to Pass 3).

### Error code mix (after)

| Code | Count | Notes |
|------|------:|-------|
| TS6133 | 188 | Unused imports/vars (Pass 3) |
| TS2322 | 17 | Assignability (planner, documents, UI) |
| TS2345 | 8 | Argument mismatches |
| TS2367 | 8 | Unintentional comparisons |
| TS2352 | 7 | Unsafe casts |
| TS6196 | 6 | Unused type imports |
| TS2339 | 4 | Missing properties |
| TS18048 | 4 | Possibly undefined |
| Other | 9 | TS2769, TS2307, TS2774, etc. |

---

## Files changed (16)

| File | Change |
|------|--------|
| `src/store/index.ts` | `PreferencesState.preferences` → `UserPreferences`; initial state `DEFAULT_USER_PREFERENCES`; `updatePreferences` accepts `Partial<UserPreferences>`; `addProject` row cast for `mapProjectFromRow`; `QCRecord` filter param type |
| `src/services/userPreferencesService.ts` | Boolean fields from DB use `typeof … === 'boolean'` guards |
| `src/types/proposal.ts` | `EMPTY_PROPOSAL_DOCUMENT_FIELDS` helper for tests/previews |
| `src/components/proposals/ProposalPricingEditor.tsx` | `terms` / `preparedBy` on preview `ProposalData` |
| `src/utils/proposalPricing.test.ts` | Spread `EMPTY_PROPOSAL_DOCUMENT_FIELDS` on fixtures |
| `src/utils/changeOrderFinancials.test.ts` | `terms` / `preparedBy` on proposal integration fixture |
| `src/utils/scheduleEventUtils.test.ts` | `mockEvent()` includes `recurrenceRule: null` |
| `src/components/schedule/scheduleTheme.ts` | `surface` on all partial type style entries (merged with defaults at runtime — no visual change where defaults already applied) |
| `src/components/calculations/CalculationForm.tsx` | Select `value` null coalesce; `recommendations ?? []` |
| `src/components/calculators/LaborCalculatorPanel.tsx` | Guard AI review when `optimization.current` is null; null-safe savings label |
| `src/components/calculators/ProjectCalculatorShell.tsx` | `formatUSAddress` after `hasProjectJobsite` guard |
| `src/components/tools/FieldToolPageLayout.tsx` | Same jobsite address narrowing |
| `src/components/pour-planner/steps/StepDeliveryLogistics.tsx` | `ReadyMixDelivery` props match `ReadyMixDeliveryProps` only (`defaultTruckTypeId` for suggested truck) |
| `src/pages/calculators/LaborCalculatorPage.tsx` | `navigate(to, { state })` overload fix |
| `src/pages/calculators/GeneralTradeLaborCalculatorPage.tsx` | Same navigate fix |
| `src/pages/calculators/ConcreteCalculatorPage.tsx` | Same navigate fix |

---

## Focus areas — results

### 1. Store `PreferencesState` vs `UserPreferences`

- Narrow inline preferences type replaced with canonical `UserPreferences`.
- Store boot and fallback use `DEFAULT_USER_PREFERENCES` from `userPreferencesService`.
- Fixes `volumeUnit`, `lengthUnit`, `measurementSystem`, etc. errors across calculators, pour planner, and hooks that read `usePreferencesStore`.

### 2. `ProposalData` fixtures (`terms` / `preparedBy`)

- Editor preview and test fixtures now satisfy required fields.
- Shared `EMPTY_PROPOSAL_DOCUMENT_FIELDS` for tests.

### 3. `ScheduleEvent.recurrenceRule`

- `mockEvent()` sets `recurrenceRule: null` so spread overrides cannot leave `undefined` on a required `RecurrenceRule | null` field.

### 4. Local null/undefined / assignability

- Calculation form Select and recommendations.
- Labor crew optimization null guards.
- Jobsite `formatUSAddress` after boolean guard.
- `userPreferencesService` boolean mapping from JSON/DB rows.
- React Router `navigate` two-argument form for workflow back links.
- `scheduleTheme` complete style objects for `Partial<Record<…>>` literals.

---

## Remaining top errors (non-TS6133, sample)

1. **`src/components/ResourceCard.tsx`** — `TS2307` cannot find `../ui/Card` (path/module resolution).
2. **`src/components/planner/PlannerSidebar.tsx`** — `TS2352` unsafe `Project` cast from partial Supabase row.
3. **`src/contexts/PlannerProjectContext.tsx`** — `TS2352` cast + `string | null` vs `string | undefined` on jobsite fields.
4. **`src/components/schedule/views/calendar/ScheduleCalendarDayView.tsx`** — `ForecastDay` property names (`tempMax`, `tempMin`, `precipitation`).
5. **`src/features/documents/ui/DocumentBuilderPage.tsx`** — `CompanySettings` vs document preview pick type; `HTMLElement | null` to `Element`.
6. **`src/lib/proposalService.ts`** — `TrackedProposalRow` cast via `unknown`.
7. **`src/components/ui/Card.tsx`** — Framer Motion `HTMLMotionProps` spread typing.
8. **Documents pack/PDF** — clause category, contract PDF optional strings, RFI PDF label values.

These are good candidates for **Pass 3** (unused imports) plus a **Pass 4** (planner/documents/forecast alignment).

---

## Tests

```text
npm test
Test Files  27 passed (27)
Tests       196 passed (196)
Duration    ~8.5s
```

**Result:** PASS

---

## Build

```text
npm run build
vite v6.3.5 — built in ~19s
PWA precache generated
```

**Result:** PASS

---

## Constraints verified

- No Supabase migration or RLS changes.
- No pricing math or document engine behavior changes.
- `ReadyMixDelivery` still receives volume/unit; truck UI remains in the same step (invalid extra props removed — they were not on the component interface).
- Unused-import cleanup intentionally deferred.

---

## Suggested next step

**Type Model Fix Pass 3:** bulk `TS6133` / `TS6196` cleanup, then planner `Project` row mappers and `ResourceCard` import path.
