# Type Model Fix Pass 1 Report — Resolve `src/types.ts` Shadowing

**Date:** 2026-06-03  
**Reference:** [TYPE_MODEL_DRIFT_AUDIT.md](TYPE_MODEL_DRIFT_AUDIT.md)

---

## Summary

Pass 1 removed the legacy top-level `src/types.ts` file so `import '../types'` resolves to the canonical barrel at `src/types/index.ts`. Structural type errors from wrong `Project`, `Calculation`, `QCRecord`, and `UserPreferences` models dropped sharply. Tests and production build remain green.

---

## `src/types.ts` removed

**Yes.** [src/types.ts](src/types.ts) was deleted. There is no comment-only stub.

`import '../types'` from app code (e.g. `src/store`, `src/components`) now resolves to [src/types/index.ts](src/types/index.ts).

**Unchanged:** [src/features/documents/types.ts](src/features/documents/types.ts) — document-engine imports under `features/documents/**` were never shadowed.

---

## New modules

### [src/types/pricingCatalog.ts](src/types/pricingCatalog.ts)

Moved from former `src/types.ts` (no duplicate domain interfaces):

| Export | Purpose |
|--------|---------|
| `Unit`, `LengthUnit`, `VolumeUnit` | Unit enums for calculators |
| `ConcreteMixDesign`, `CONCRETE_MIX_DESIGNS` | Mix material tables |
| `ConcretePricing`, `LocationPricing`, `LOCATION_PRICING` | Supplier pricing catalog (~520 lines) |

**Not moved:** legacy slim `UserPreferences` (removed from catalog to avoid conflicting with canonical type in `index.ts`).

### [src/types/weather.ts](src/types/weather.ts)

| Export | Purpose |
|--------|---------|
| `Weather`, `ForecastHour`, `ForecastDay` | Forecast API and pour scoring |

---

## [src/types/index.ts](src/types/index.ts) changes

**Canonical definitions kept inline (unchanged ownership):**

- `Project`, `Calculation`, `UserPreferences`, `QCRecord`, `QCRecordType`, `QCChecklist`, `ReinforcementSet`, `CutListItem`

**Type-only enhancements on canonical models:**

- `Calculation.weather` → `Weather` (from `./weather`)
- `Calculation.result.recommendations?` → optional `string[]` (legacy bag-calc field)

**Barrel re-exports added:**

```ts
export * from './pricingCatalog';
export type { Weather, ForecastHour, ForecastDay } from './weather';
export type { ProposalData } from './proposal';
export type {
  ScheduleEvent,
  ScheduleEventInput,
  ScheduleEventSavePayload,
  RecurrenceRule,
} from './scheduleEvent';
export type { PlacementOrder, PlacementOrderStatus } from './placementOrder';
export type { LaborEstimate, LaborEstimateInputs } from './laborEstimate';
export { MixProfileType } from './curing';
```

---

## TypeScript error count

| Metric | Before Pass 1 | After Pass 1 | Delta |
|--------|---------------|--------------|-------|
| **Total** | 543 | **314** | **−229 (−42%)** |
| TS6133 (unused) | 187 | 187 | 0 |
| TS2339 | 192 | **34** | **−158** |
| TS2305 (missing export) | 11 | **0** | **−11** |
| TS2353 (excess property) | 23 | **0** | **−23** |
| TS2739 (missing required) | 9 | 4 | −5 |
| TS2322 | 20 | 23 | +3 |

### Pass 1 success criteria

| Check | Result |
|-------|--------|
| TS2305 on `QCRecord` / `ReinforcementSet` from `../types` | **Gone (0)** |
| TS2339 on `Project.placementOrder`, `clientInfo`, `qcRecords`, etc. | **Largely gone** |
| Sharp error drop without fixing all 543 | **Yes (−229)** |

---

## Top 20 remaining errors (non-TS6133)

Deferred to **Pass 2** unless noted.

1. `CalculationForm.tsx` — `preferences.volumeUnit` (store `PreferencesState` narrow shape)
2. `CalculationForm.tsx` — input `null` vs `undefined` (TS2322)
3. `CalculationForm.tsx` — `calculationResult.recommendations` possibly undefined (TS18048)
4. `LaborCalculatorPanel.tsx` — `preferences.volumeUnit` (×2)
5. `LaborCalculatorPanel.tsx` — `CrewScenario | null` assignability
6. `LaborCalculatorPanel.tsx` — `optimization.current` possibly null (×2)
7. `ProjectCalculatorShell.tsx` — `USAddress | undefined` vs `Partial<USAddress>`
8. `PlannerSidebar.tsx` — partial DB row cast to `Project`
9. `OverviewSummaryCard.tsx` — `preferences.volumeUnit` (×2)
10. `PourOrderSection.tsx` — Zustand prefs vs full `UserPreferences` (TS2740)
11. `StepDeliveryLogistics.tsx` — `preferences.volumeUnit` + `ReadyMixDeliveryProps` mismatch
12. `StepProjectOverview.tsx` — `preferences.volumeUnit` (×2)
13. `ProposalPricingEditor.tsx` — `ProposalData` missing `terms`, `preparedBy` (TS2739) — **Pass 2**
14. `proposalPricing.test.ts` / `changeOrderFinancials.test.ts` — same — **Pass 2**
15. `scheduleEventUtils.test.ts` — `recurrenceRule` undefined vs `null` — **Pass 2**
16. `projectWorkflow.ts` — `PlacementOrderStatus` vs `"completed"` / `"cancelled"` string literals (status enum drift)
17. `store/index.ts` — `PreferencesState` vs `UserPreferences` assignability — **Pass 2**
18. `Settings.tsx` / theme types — assorted (if still in full tsc output)
19. `StepDeliveryLogistics.tsx` — component prop typing
20. Remaining TS2322 / TS2345 in schedule/proposal pages

**Pass 3:** 187× TS6133 unused `React` / locals — unchanged count.

---

## Validation

| Command | Result |
|---------|--------|
| `npx tsc -p tsconfig.app.json --noEmit` | **314 errors** (exit 2) |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |

---

## Known limitations / next passes

### Pass 2 (recommended next)

- [src/store/index.ts](src/store/index.ts) — `PreferencesState.preferences` should be `UserPreferences`
- Proposal test fixtures + `ProposalPricingEditor` — add `terms`, `preparedBy`
- [src/utils/scheduleEventUtils.test.ts](src/utils/scheduleEventUtils.test.ts) — `recurrenceRule: null` in `mockEvent`
- Review `PlacementOrderStatus` literal comparisons in [projectWorkflow.ts](src/utils/projectWorkflow.ts)

### Pass 3

- TS6133 cleanup or relax `noUnusedLocals` in [tsconfig.app.json](tsconfig.app.json)

### Then

- Phase 5C Submittal renderer

---

## Files created / changed

| Action | Path |
|--------|------|
| Created | `src/types/pricingCatalog.ts` |
| Created | `src/types/weather.ts` |
| Updated | `src/types/index.ts` |
| Deleted | `src/types.ts` |
| Created | `TYPE_MODEL_FIX_PASS_1_REPORT.md` |

No changes to Supabase, RLS, business logic, document engine, pricing math, or Phase 5A/5B renderers.
