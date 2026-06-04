# LINT / TYPESCRIPT CLEANUP — BATCH 1 CORRECTNESS REPORT
## Scope
Batch 1 was restricted to correctness blockers only in the requested files, with no broad refactors or unrelated file edits.

## Files changed
- `src/components/projects/StrengthProgress.tsx`
- `src/components/ResourceCard.tsx`
- `src/utils/pourOrderSummary.ts`
- `src/utils/projectWorkflow.ts`
- `src/services/plannerService.ts`
- `src/pages/Projects/ProjectDetails.tsx`
- `src/components/schedule/ScheduleEventFormModal.tsx`
- `src/contexts/PlannerProjectContext.tsx`
- `src/components/planner/PlannerSidebar.tsx`

## Issue fixed per file
- `src/components/projects/StrengthProgress.tsx`
  - Moved `useMemo` date parsing hook to top-level (before early return) to satisfy React hook ordering rules.
- `src/components/ResourceCard.tsx`
  - Corrected broken `Card` import path from `../ui/Card` to `./ui/Card`.
- `src/utils/pourOrderSummary.ts`
  - Fixed function signature mismatch by replacing invalid `labelValue('PSI Requirement:')` call with a plain section label string.
- `src/utils/projectWorkflow.ts`
  - Resolved impossible status comparisons by introducing a local legacy-aware placement status union for `'completed' | 'cancelled'`.
- `src/services/plannerService.ts`
  - Removed always-true conditional branch in `countTasksByStatus` (`else if (t.status !== 'Completed')`) and simplified to `else`.
- `src/pages/Projects/ProjectDetails.tsx`
  - Added safe numeric fallbacks (`?? 0`) for financial values used in arithmetic/display to prevent `possibly undefined` number usage.
- `src/components/schedule/ScheduleEventFormModal.tsx`
  - Normalized milestone keys with `normalizeMilestoneKey(...)` before assigning typed form state.
- `src/contexts/PlannerProjectContext.tsx`
  - Replaced unsafe broad cast with typed query-row shape and minimal `Project` mapper for `resolveProjectWorkflow`.
  - Normalized nullable jobsite fields to `string | undefined` for `usAddressFromFields`.
- `src/components/planner/PlannerSidebar.tsx`
  - Replaced unsafe workflow cast with typed row mapping and minimal `Project` object.

## Before/after lint count
- Before (`npm run lint` baseline): **215 problems** (**172 errors**, **43 warnings**)
- After (`npm run lint`): **213 problems** (**170 errors**, **43 warnings**)
- Delta: **-2 errors**, warnings unchanged

## Before/after TypeScript count
- App check before (`npx tsc --noEmit -p tsconfig.app.json` baseline): **264 errors in 182 files**
- App check after: **241 errors in 176 files** (counted from compiler error lines)
- Delta: **-23 errors**, **-6 files**
- Node check before (`npx tsc --noEmit -p tsconfig.node.json`): pass
- Node check after: pass

## Targeted lint check on Batch 1 files
Command run:
`npx eslint src/components/projects/StrengthProgress.tsx src/components/ResourceCard.tsx src/utils/pourOrderSummary.ts src/utils/projectWorkflow.ts src/services/plannerService.ts src/pages/Projects/ProjectDetails.tsx src/components/schedule/ScheduleEventFormModal.tsx src/contexts/PlannerProjectContext.tsx src/components/planner/PlannerSidebar.tsx`

Result: **14 problems** (**9 errors**, **5 warnings**) remain, primarily pre-existing non-batch items (`no-explicit-any`, `no-unused-vars`, and hook-deps warnings).

## Test result
- `npm test`: **PASS**
  - 43 test files passed
  - 264 tests passed

## Build result
- `npm run build`: **PASS** (exit code 0)
  - Production bundle generated successfully
  - Notable non-blocking warning: mixed dynamic/static import for `src/services/employeeService.ts`

## Remaining top errors
Top remaining TypeScript error codes after Batch 1:
- `TS6133`: 186
- `TS2322`: 20
- `TS2345`: 9
- `TS2352`: 7
- `TS6196`: 5
- `TS2339`: 5

Top remaining lint categories are still dominated by:
- unused imports/variables
- `no-explicit-any`
- hook dependency warnings (`react-hooks/exhaustive-deps`)

## Recommendation for Batch 2
Focus Batch 2 on high-impact shared type-contract cleanup and low-risk mechanical stabilization in small batches:
1. **Documents/company settings contract alignment** (`DocumentBuilderPage` + adapters) to remove recurring `TS2322/TS2345` mismatches.
2. **Planner/document typed row mappers pattern rollout** to replace remaining unsafe casts.
3. **Mechanical cleanup pass in touched domains only** (selected `TS6133` + obvious `no-explicit-any` replacements with `unknown` + narrowing) without changing behavior.
4. Re-run targeted lint/tsc per batch, then full lint + app/node tsc after each increment.
