# LINT / TSC Batch 4 Mechanical Cleanup Report
## Goal
Remove low-risk lint/type noise mechanically (unused imports/variables, unused React default imports, safe `prefer-const`) without changing behavior or business logic.

## Guardrails followed
- Kept edits small and reviewable.
- Limited changes to mechanical symbol cleanup / safe omissions.
- Did not refactor business logic.
- Left out-of-scope issues (for example `no-explicit-any`, hook dependency warnings) unchanged unless required to keep a file lint-clean for the targeted rules.

## Targeted metrics (before → after)
- `UNUSED_VAR_FINDINGS`: **98 → 0**
- `PREFER_CONST_FINDINGS`: **4 → 0**

Final full-src ESLint snapshot after cleanup:
- `ESLINT_ERRORS=59`
- `ESLINT_WARNINGS=43`
- `ESLINT_TOTAL=102`
- `UNUSED_VAR_FINDINGS=0`
- `PREFER_CONST_FINDINGS=0`

## Mechanical cleanup scope
Primary cleanup batches were applied across:
- `src/components/ui/Toast.tsx`
- `src/components/weather/LocationPrompt.tsx`
- `src/pages/MixDesignAdvisor.tsx`
- `src/components/pour-planner/steps/StepDeliveryLogistics.tsx`
- `src/components/projects/ReinforcementDetails.tsx`
- `src/components/optimizer/ReinforcementOptimizer.tsx`
- `src/components/onboarding/ThemeSelector.tsx`
- `src/features/documents/registry/types.ts`
- `src/pages/Projects/useProjects.ts`
- `src/pages/PublicProposal.tsx`
- `src/pages/planner/PlannerAllFarsPage.tsx`
- `src/types/address.ts`
- `src/utils/operationsDashboard.ts`
- `src/utils/scheduleEventUtils.ts`
- `src/utils/scheduleRecurrenceUtils.ts`
- `src/components/dashboard/FinancialSnapshotCard.tsx`
- `src/components/dashboard/ProposalPipelineCard.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/planner/TaskComments.tsx`
- `src/components/planner/TaskStatusBadge.tsx`
- `src/components/pour-planner/steps/StepEnvironmental.tsx`
- `src/components/pour-planner/steps/StepRiskAnalysis.tsx`
- `src/components/projects/ProjectForm.tsx`
- `src/components/projects/StrengthProgress.tsx`
- `src/components/proposals/ProposalTemplateMinimal.tsx`

Final singleton + heavy-file cleanup completed in:
- `src/components/proposals/ProposalTemplateModern.tsx`
- `src/components/schedule/ScheduleCalendarEventBlock.tsx`
- `src/components/ui/Input.tsx`
- `src/pages/OperationsDashboard.tsx`
- `src/pages/PourPlanner.tsx`
- `src/pages/Projects/MixDesignSection.tsx`
- `src/pages/Settings.tsx`
- `src/pages/auth/ResetPassword.tsx`
- `src/pages/planner/PlannerHubPage.tsx`
- `src/services/employeeService.ts`
- `src/services/fieldActivityService.ts`
- `src/services/scheduleEventService.ts`
- `src/services/scheduleRecurrenceService.ts`
- `src/services/storageService.ts`
- `src/store/index.ts`
- `src/store/workflowDraftStore.ts`
- `src/utils/concreteLaborInputMapper.ts`
- `src/utils/pourScoring.ts`
- `src/utils/projectWorkflow.ts`

## Validation results
Ran required commands:

1. `npm run lint` ❌
- Completed with non-targeted remaining issues.
- Summary: **59 errors, 43 warnings**.
- Top remaining rules:
  - `@typescript-eslint/no-explicit-any`: 55
  - `react-hooks/exhaustive-deps`: 34
  - `react-refresh/only-export-components`: 9
  - `no-useless-escape`: 3
  - `no-case-declarations`: 1

2. `npx tsc --noEmit -p tsconfig.app.json` ❌
- Typecheck still fails with broad pre-existing/non-targeted issues.
- Counted TypeScript error lines: **145**.

3. `npm test` ✅
- `vitest run` passed.
- **43 test files, 264 tests passed**.

4. `npm run build` ✅
- Production build succeeded (exit code 0).
- Non-blocking warning remained about mixed dynamic/static import usage for `src/services/employeeService.ts`.

## Remaining backlog (post-Batch 4 targeted cleanup)
Targeted Batch 4 backlog is complete (`no-unused-vars` and `prefer-const` at zero). Remaining work is outside Batch 4 mechanical scope:
- `@typescript-eslint/no-explicit-any` cleanup
- `react-hooks/exhaustive-deps` dependency corrections
- Misc rule cleanup (`react-refresh/only-export-components`, `no-useless-escape`, `no-case-declarations`)
- Broader TypeScript contract mismatches reported by app `tsc`

## Outcome
Batch 4 mechanical objective is complete for targeted rules with no behavior-focused refactors, while preserving existing non-targeted lint/type backlog for subsequent dedicated passes.
