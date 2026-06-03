# Regression Fix Pass Report
Date: 2026-06-03
Branch: warp-cleanup-work
## Files changed
- `REGRESSION_FIX_PASS_REPORT.md`
- `src/components/calculations/PricingCalculator.tsx`
- `src/components/calculators/GeneralTradeLaborCalculatorPanel.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/pour-planner/PourOrderSection.tsx`
- `src/pages/CalculatorHub.tsx`
- `src/pages/MarketingHome.tsx`
- `src/pages/ProposalGenerator.tsx`
- `src/pages/calculators/CustomEstimatePage.tsx`
- `src/types/changeOrder.ts`
- `src/utils/customEstimateUtils.ts`
- `src/utils/pourOrderSummary.ts`
- `src/utils/proposalPricingImport.ts`
## Issue 1: Mapbox / batch plant finder error
Root cause: `PricingCalculator.tsx` used `DEFAULT_BATCH_PLANT_CONTACT` while persisting a found batch plant to a project, but the constant was not imported into that module.
Fix applied: Imported `DEFAULT_BATCH_PLANT_CONTACT` from `src/types/placementOrder.ts` and kept the existing placement order fallback shape intact. Added clean missing-contact display in the pour order section and call sheet so empty contact fields render as `Contact not provided` instead of surfacing an error or blank ambiguous values.
## Issue 2: Estimate workflow card completion bug
Root cause: General Trade Labor and Custom both stored saved labor lines in `customEstimates.laborItems`, so the workflow hub treated one shared collection as completion for both cards.
Fix applied: Added source metadata to custom estimate line items without changing Supabase schema. General Trade Labor saves now mark lines with `source: 'general_trade_labor'`; manual Custom saves mark lines with `source: 'custom_estimate'`. The calculator hub now checks each card independently, and the Custom estimate page preserves General Trade Labor lines while only editing manual custom lines.
## Issue 3: Proposal save workflow missing toast
Root cause: `ProposalGenerator.tsx` already showed save toasts for non-workflow saves, but the workflow save path only advanced the workflow ready state and skipped user feedback.
Fix applied: Reused the existing `showImportFeedback`/`Toast` pattern. Workflow proposal create and update success now show `Proposal saved` / `Proposal saved successfully.` Failure feedback now uses `Could not save proposal`.
## Issue 4: Signed-out main page logo color
Root cause: The signed-out navbar rendered `Concrete` with a cyan class while `Calc` inherited white.
Fix applied: Removed the signed-out `Concrete` cyan class so the entire `Concrete Calc` logo inherits white text. Authenticated navbar behavior was not changed.
## Issue 5: Signed-out Placement Planner card link
Root cause: The signed-out marketing Placement Planner card routed directly to `/pour-planner`, which is a protected workflow route.
Fix applied: Updated the signed-out Placement Planner card action to navigate to `/signup`, matching the existing create account route.
## Validation results
- `npm run lint`: Failed due existing repository-wide lint issues. Final changed-file ESLint check had 0 errors and 3 warnings in touched files. Representative full-run existing errors include unused variables in `scripts/uploadSounds.ts`, unnecessary escapes in `src/components/onboarding/OnboardingStep.tsx`, unused imports in `src/pages/auth/Login.tsx`, and multiple `no-explicit-any` / unused variable errors in `src/store/index.ts`.
- `npx tsc -p tsconfig.app.json --noEmit`: Failed due existing repository-wide TypeScript drift. A filtered check for files changed in this pass returned no matching TypeScript errors. Representative full-run existing errors include missing properties such as `psi` on `Calculation`, `placementOrder` on `Project`, missing/incorrect `UserPreferences` fields, and route state typing issues.
- `npm run build`: Passed. Vite production build completed successfully, including PWA service worker generation. The build emitted a non-blocking warning about `employeeService.ts` being both dynamically and statically imported.
## Remaining limitations
- Existing General Trade Labor lines saved before this fix do not have source metadata. New saves are classified correctly. Legacy untagged labor lines remain treated as manual custom lines for backward compatibility.
- Repository-wide lint and TypeScript commands still fail because of broader pre-existing issues outside this regression pass.
- Manual UI acceptance checks were not run in a browser during this pass; validation was limited to static checks and production build.
