# MixProfileType Runtime Import Fix Report

**Date:** 2026-06-03  
**Issue:** `Uncaught SyntaxError: The requested module '/src/types/curing.ts' doesn't provide an export named: 'MixProfileType'`

---

## Root cause

`MixProfileType` is declared with `export type` in [src/types/curing.ts](src/types/curing.ts). Pass 1 added a **value** re-export in the barrel:

```ts
export { MixProfileType } from './curing';  // BAD — erased at compile, missing at runtime
```

Vite/ESM then tried to import a runtime binding that does not exist, crashing the app on load.

---

## Barrel fix

**File:** [src/types/index.ts](src/types/index.ts)

| Before | After |
|--------|--------|
| `import { MixProfileType } from './curing'` | `import type { MixProfileType } from './curing'` |
| `export { MixProfileType } from './curing'` | `export type { MixProfileType } from './curing'` |

Other barrel re-exports from Pass 1 were already `export type` (PlacementOrder, LaborEstimate, ScheduleEvent, ProposalData, Weather).

---

## MixProfileType imports fixed

| File | Change |
|------|--------|
| [src/store/index.ts](src/store/index.ts) | `import type { MixProfileType } from '../types/curing'` |
| [src/components/calculations/CalculationForm.tsx](src/components/calculations/CalculationForm.tsx) | `import type { MixProfileType } from '../../types/curing'` |
| [src/pages/Projects/useProjects.ts](src/pages/Projects/useProjects.ts) | `import type { MixProfileType } from '../../types/curing'` |
| [src/components/projects/StrengthProgress.tsx](src/components/projects/StrengthProgress.tsx) | Split: `import { CURE_PROFILES }` (value) + `import type { MixProfileType }` |

`CURE_PROFILES` and `MIX_PROFILE_LABELS` remain **value** imports from `curing.ts` (correct).

---

## Additional type-only imports corrected (barrel / domain types)

Prevent similar runtime crashes for interfaces and type aliases re-exported from `../types`:

| File | Symbols → `import type` |
|------|---------------------------|
| [src/store/index.ts](src/store/index.ts) | `Project`, `UserPreferences`, `Calculation`, `QCRecord`, `QCChecklist`, `ReinforcementSet`, `USAddress` |
| [src/services/userPreferencesService.ts](src/services/userPreferencesService.ts) | `UserPreferences` |
| [src/pages/Settings.tsx](src/pages/Settings.tsx) | `UserPreferences` |
| [src/pages/Projects/useProjects.ts](src/pages/Projects/useProjects.ts) | `Project`, `QCRecord` |
| [src/components/calculations/CalculationForm.tsx](src/components/calculations/CalculationForm.tsx) | `Calculation` |
| [src/components/projects/StrengthProgress.tsx](src/components/projects/StrengthProgress.tsx) | `Project` |
| [src/pages/MixDesignAdvisor.tsx](src/pages/MixDesignAdvisor.tsx) | `Weather`, `Project` |
| [src/services/weatherService.ts](src/services/weatherService.ts) | `Weather`, `ForecastDay` |
| [src/components/weather/WeatherInfo.tsx](src/components/weather/WeatherInfo.tsx) | `Weather` |
| [src/utils/pourScoring.ts](src/utils/pourScoring.ts) | `ForecastDay`, `ForecastHour` |
| [src/utils/pourMitigations.ts](src/utils/pourMitigations.ts) | `ForecastDay` |
| [src/utils/pdf.ts](src/utils/pdf.ts) | `Project` (kept `import { CONCRETE_MIX_DESIGNS }` as value) |
| [src/utils/readyMixCost.ts](src/utils/readyMixCost.ts) | `LocationPricing` (kept `LOCATION_PRICING` as value) |
| [src/components/calculations/PricingCalculator.tsx](src/components/calculations/PricingCalculator.tsx) | `LocationPricing`, `VolumeUnit` |
| [src/utils/calculations.ts](src/utils/calculations.ts) | `LengthUnit`, `VolumeUnit`, `ConcreteMixDesign` (kept `CONCRETE_MIX_DESIGNS` as value) |
| [src/components/calculations/ReadyMixDelivery.tsx](src/components/calculations/ReadyMixDelivery.tsx) | `VolumeUnit` |
| [src/utils/readyMixDelivery.ts](src/utils/readyMixDelivery.ts) | `VolumeUnit` |

**Already correct:** [QCRecords.tsx](src/components/projects/QCRecords.tsx), [supplierPricing.ts](src/utils/supplierPricing.ts), most files using `import type` from `../types` after Pass 1.

**Unchanged (runtime values):** `CONCRETE_MIX_DESIGNS`, `LOCATION_PRICING`, `CURE_PROFILES`, `defaultPlacementOrder`, `DRAFT_DISCLAIMER`, `ENGINE_VERSION`, etc.

---

## Dev server check

`npm run dev` could not bind port **5173** (already in use — existing dev instance).  
Existing server at `http://localhost:5173/` returned **HTTP 200** after the fix (HTML served).

**Manual confirmation:** Reload the app in the browser; the `MixProfileType` SyntaxError should no longer appear. Open **Tools** / project workflow routes that import curing types.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm run lint` | Pre-existing repo issues (201 problems); no new lint rule failures specific to these edits |
| `npx tsc -p tsconfig.app.json --noEmit` | **313 errors** (unchanged vs Pass 1 post-shadowing; Pass 2 deferred) |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |

---

## Files changed (summary)

- `src/types/index.ts` — barrel import/export `MixProfileType` as type-only  
- 17 consumer files — `import type` for erased types from `../types` or `../types/curing`

**Not changed:** Supabase, RLS, pricing math, business logic, document engine.

---

## Next step

Proceed with **Type Model Fix Pass 2** (`PreferencesState`, proposal fixtures, schedule mock) once the app is confirmed healthy in the browser.
