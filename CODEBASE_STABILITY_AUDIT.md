# Concrete Calc — Codebase Stability Audit

**Date:** 2026-06-02
**Branch:** warp-cleanup-work
**Scope:** Full `src/` tree, routing, theming, Supabase services, build artifacts

---

## 1. Duplicate / Near-Duplicate Components

### 1.1 `ResourceCard` — Exact duplicate
- **Files:** `src/components/ResourceCard.tsx` vs `src/components/resources/ResourceCard.tsx`
- **Issue:** These two files are nearly identical. The root-level version lacks `dark:bg-gray-800/90` on line 33 and uses `dark:text-white` instead of `dark:text-gray-300` on line 49. `src/pages/Resources.tsx` imports from `../components/ResourceCard` (the root-level, inferior copy).
- **Risk Level:** Medium — styling inconsistency in dark mode.
- **Recommended Fix:** Delete `src/components/ResourceCard.tsx`. Update `src/pages/Resources.tsx` to import from `../components/resources/ResourceCard`. The nested version has proper dark mode support.
- **Safe to delete now:** Yes (after updating the import in `Resources.tsx`).

---

## 2. Dead or Unused Routes

### 2.1 `dispatch` and `qc` routes redirect to `/`
- **File:** `src/App.tsx` (lines 344–345)
- **Issue:** `<Route path="dispatch" ... />` and `<Route path="qc" ... />` are hard redirects to home. These were likely old feature routes that have been deprecated but the route entries remain.
- **Risk Level:** Low — harmless but adds dead code.
- **Recommended Fix:** Remove these two Route entries entirely.
- **Safe to delete now:** Yes.

### 2.2 `MarketingHome.tsx` — Never routed
- **File:** `src/pages/MarketingHome.tsx`
- **Issue:** This file exists but is never imported in `App.tsx` or `lazyPages.tsx`. It references PourPlanner and other features but serves no purpose in the current route tree.
- **Risk Level:** Low — dead code, no runtime impact.
- **Recommended Fix:** Delete if no longer needed, or add a route if it was intended to be a public landing page.
- **Safe to delete now:** Yes.

### 2.3 `Calculator.tsx` — Pure re-export wrapper
- **File:** `src/pages/Calculator.tsx`
- **Issue:** A single-line file that re-exports `CalculatorHub`. The route `/calculator` uses `Calculator` (which wraps `CalculatorHub`). This is unnecessary indirection.
- **Risk Level:** Low — adds confusion.
- **Recommended Fix:** Inline the import directly to `CalculatorHub` in `App.tsx` and delete the wrapper.
- **Safe to delete now:** Yes.

---

## 3. Feature Duplication — Planner / Pour-Planner

### 3.1 Two separate "planner" feature sets
- **Directories:** `src/components/planner/` vs `src/components/pour-planner/`
- **Issue:** Both directories contain overlapping planning functionality:
  - `pour-planner/` has `PourPlannerStepper`, `RiskDashboard`, `StepDeliveryLogistics`, etc. (a pour-specific wizard)
  - `planner/` has `PlannerBoard`, `PlannerSidebar`, `TaskCard`, `BucketColumn`, etc. (a Kanban/task-board style planner)
  - Both reference similar concepts (tasks, locations, risk)
- **Risk Level:** Medium — cognitive overhead, duplicated domain concepts, potential data inconsistency if both write to the same Supabase tables.
- **Recommended Fix:** Clarify the boundary. The pour-planner is a domain-specific workflow for concrete placements. The planner (Kanban) is a general task management system. They should share types/utilities but not duplicate logic. Create a clear documented boundary or consolidate shared types.
- **Safe to delete now:** No — both features are routed and active. Requires refactoring.

### 3.2 Planner routing duplication
- **Files:** 
  - `src/pages/planner/PlannerBoardPage.tsx` (Kanban board)
  - `src/pages/planner/ScheduleWorkspacePage.tsx` (calendar schedule)
  - `src/components/routing/LegacyPlannerRedirects.tsx`
  - `src/components/routing/PlannerIndexRedirect.tsx`
- **Issue:** Multiple redirect components suggest an evolving routing strategy that was never fully cleaned up. `LegacyPlannerRedirects.tsx` and `PlannerIndexRedirect.tsx` exist purely for backward compatibility with old URL patterns.
- **Risk Level:** Low-Medium — adds maintenance burden and potential routing confusion.
- **Recommended Fix:** Audit all planner routes. If legacy redirects have been in place for >3 months without active external links, remove them.
- **Safe to delete now:** Verify no external/bookmarked URLs depend on them, then yes.

---

## 4. Document Builder Duplication

### 4.1 Two change order PDF generators
- **Files:** 
  - `src/utils/changeOrderPdf.ts` — standalone PDF generation utility
  - `src/features/documents/ui/DocumentBuilderPage.tsx` — full document builder with integrated PDF export
- **Issue:** `DocumentBuilderPage.tsx` imports `changeOrderPdf.ts` (line 33), but also has its own PDF logic. `PublicChangeOrder.tsx` imports `changeOrderPdf.ts` directly. This creates two code paths for generating the same document.
- **Risk Level:** Medium — if one path is updated and the other isn't, clients may see different output.
- **Recommended Fix:** Consolidate all change order PDF generation into a single module. Have `DocumentBuilderPage` and `PublicChangeOrder` both use the same service function.
- **Safe to delete now:** No — both are actively used. Requires careful refactoring.

### 4.2 Two change order preview adapters
- **Files:** 
  - `src/features/documents/ui/changeOrderPreviewAdapter.ts`
  - `src/features/documents/ui/adapters/changeOrderPreviewAdapter.ts`
- **Issue:** The same adapter exists in two locations. The `adapters/` subdirectory version appears to be the newer organized location.
- **Risk Level:** Medium — if one is updated and the other isn't, inconsistencies will arise.
- **Recommended Fix:** Determine which version is canonical (likely the one in `adapters/`), update all imports to point there, and delete the root-level copy.
- **Safe to delete now:** Yes, after verifying all imports.

---

## 5. Dark/Light Mode Styling Inconsistencies

### 5.1 Components with incomplete dark mode support
Multiple components use `bg-white` or `text-gray-*` without corresponding `dark:` variants, which will produce jarring contrasts when dark mode is enabled:

| File | Line | Issue |
|------|------|-------|
| `src/components/ResourceCard.tsx` | 33 | Missing `dark:bg-gray-800/90` (fixed in the nested copy) |
| `src/components/optimizer/ReinforcementOptimizer.tsx` | 360, 364, 716, 741, 758, 809, 848, 865, 908, 914, 920, 937, 943, 949 | Multiple hardcoded `bg-white` and `bg-gray-*` classes |
| `src/components/planner/PlannerHubRecordsLayout.tsx` | 18 | Uses `bg-white` without dark variant |
| `src/components/schedule/ScheduleEmptyState.tsx` | 15 | Missing dark background |
| `src/components/calculations/QuikreteModal.tsx` | 71 | `bg-white` without dark variant |
| `src/pages/planner/PlannerChartsPage.tsx` | 12 | Missing dark background |
| `src/pages/planner/PlannerHubPage.tsx` | 76, 106 | `bg-white` without dark variant |
| `src/pages/planner/PlannerTeamPage.tsx` | 60, 93 | Hardcoded `bg-white` and `bg-gray-100` |
| `src/pages/Settings.tsx` | 448, 704, 738, 763, 806 | Multiple sections missing dark mode classes |
| `src/App.tsx` | 96, 227, 240 | Error/loading screens hardcoded `bg-white` |
| `src/components/ui/Tabs.tsx` | 56 | Missing dark variant |
| `src/components/planner/TaskComments.tsx` | 101 | `bg-white` without dark variant |

- **Risk Level:** Medium — visible UI bugs in dark mode.
- **Recommended Fix:** Replace all hardcoded `bg-white` with the theme token `SURFACE` from `src/theme/appTheme.ts`. Replace hardcoded text colors with `TEXT_FOREGROUND`, `TEXT_BODY`, or `TEXT_MUTED`.
- **Safe to delete now:** N/A — requires systematic refactoring.

### 5.2 Schedule theme uses `blue` accent while rest uses `cyan`
- **File:** `src/components/schedule/scheduleTheme.ts` (lines 154-157)
- **Issue:** Schedule components use `text-blue-600` as accent, while the planner uses `text-cyan-700`. This creates visual inconsistency when navigating between schedule and planner views.
- **Risk Level:** Low — cosmetic.
- **Recommended Fix:** Align schedule accent colors with the app-wide cyan theme, or document the intentional difference.
- **Safe to delete now:** N/A — cosmetic change.

---

## 6. Console Logging in Production Code

### 6.1 Excessive `console.error` and `console.warn` calls
These files contain console logging that should be replaced with a proper logging service or removed in production:

| File | Count | Risk |
|------|-------|------|
| `src/store/index.ts` | 22+ calls | Medium — Zustand store logging errors |
| `src/utils/location.ts` | 17+ calls | Medium — location service errors exposed |
| `src/services/hapticService.ts` | 20+ calls | Low — haptic fallbacks |
| `src/services/soundService.ts` | 14+ calls | Low — sound fallbacks |
| `src/pages/Projects/useProjects.ts` | 12+ calls | Medium — project data errors |
| `src/pages/ProposalGenerator.tsx` | 8+ calls | Medium — proposal generation errors |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | 7+ calls | Medium — document builder errors |
| `src/services/companySettingsService.ts` | 9+ calls | Medium — settings errors |
| `src/pages/Settings.tsx` | 8+ calls | Medium — settings page errors |
| `src/utils/pdf.ts` | 11+ calls | Low — PDF generation warnings |
| `src/App.tsx` | 11+ calls | High — app-level errors visible to users |
| `src/main.tsx` | 3+ calls | High — startup errors visible |

- **Risk Level:** Medium-High — console output in production can expose sensitive information, degrade performance, and clutter browser dev tools.
- **Recommended Fix:** Implement a centralized logging utility (e.g., `src/lib/logger.ts`) that conditionally outputs based on `import.meta.env.DEV`. Replace all `console.error/warn/log` calls with the logger.
- **Safe to delete now:** Yes for `console.log`. Replace `console.error/warn` with a logger (do not silently swallow).

---

## 7. Supabase Query / Service Issues

### 7.1 Supabase client lacks RLS verification patterns
- **File:** `src/lib/supabase.ts`
- **Issue:** The Supabase client is created without any RLS (Row Level Security) policy verification middleware. All service files directly query tables without verifying that RLS policies are properly enforced.
- **Risk Level:** High — if RLS policies are misconfigured on the Supabase side, unauthorized data access could occur.
- **Recommended Fix:** Add runtime verification that critical tables have RLS policies enabled. Consider adding a wrapper that logs RLS-related errors.
- **Safe to delete now:** N/A — requires Supabase-side changes.

### 7.2 Missing error handling in Supabase queries
Multiple service files call `.select()`, `.insert()`, `.update()` on Supabase without checking `error` in the response:

| File | Line | Issue |
|------|------|-------|
| `src/lib/proposalService.ts` | 111, 148, 180, 203, 227 | Queries called without `.then(({data, error}) => { if (error) ... })` pattern |
| `src/services/plannerService.ts` | 91, 103, 114-115 | Multiple queries without error checks |
| `src/services/scheduleEventService.ts` | 301 | Single query call, error handling unclear |
| `src/services/fieldActivityService.ts` | 13, 25 | Minimal error handling |
| `src/services/rfiService.ts` | 170 | Query without explicit error handling |
| `src/features/documents/services/contractDocumentService.ts` | 42, 77, 123, 136, 148, 161 | Multiple queries, some error handling present but inconsistent |

- **Risk Level:** Medium-High — silent failures could cause data loss or corrupted state.
- **Recommended Fix:** Standardize error handling across all Supabase service calls. Create a wrapper utility like `safeQuery()` that always checks and logs errors.
- **Safe to delete now:** N/A — requires refactoring.

### 7.3 `.bolt/supabase_discarded_migrations/` — 9 abandoned migration files
- **Directory:** `.bolt/supabase_discarded_migrations/`
- **Issue:** Contains 9 SQL migration files that were discarded during development. These are NOT tracked in the official `database/migrations/` directory.
- **Risk Level:** Low — not executed, but represents schema drift risk if referenced later.
- **Recommended Fix:** Review each discarded migration. If truly obsolete, delete the entire directory. If any contain needed schema changes, merge them into `database/migrations/`.
- **Safe to delete now:** Yes, after review.

---

## 8. Risky Code That Could Break Production

### 8.1 Missing Supabase env variables crash the app
- **File:** `src/lib/supabase.ts` (lines 6-8)
- **Issue:** `throw new Error('Missing Supabase environment variables')` — this throws at module load time, crashing the entire app before the error boundary can catch it.
- **Risk Level:** High — if `.env.local` or production env vars are missing, the app will white-screen with no recovery.
- **Recommended Fix:** Return a mock/fallback client in development, or defer the throw until the first actual Supabase call. Add a graceful error screen.
- **Safe to delete now:** Yes — replace with deferred error.

### 8.2 `useProjects.ts` has massive unhandled Promise rejections
- **File:** `src/pages/Projects/useProjects.ts`
- **Issue:** 12+ `console.error` calls inside `.catch()` handlers — errors are logged but not surfaced to the user. Operations like saving, deleting, or loading projects could silently fail.
- **Risk Level:** High — users may believe their data is saved when it isn't.
- **Recommended Fix:** Implement user-facing error toasts or notifications for all failed Supabase operations. Use the existing `Toast` component.
- **Safe to delete now:** Yes — add toasts.

### 8.3 Hardcoded environment variable access
- **File:** `src/lib/supabase.ts` (lines 3-4)
- **Issue:** Uses `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` directly. No fallback, no validation of URL format.
- **Risk Level:** Medium — if env vars are malformed, the Supabase client will be created with bad values.
- **Recommended Fix:** Validate URL format before creating the client. Provide a development-mode fallback.
- **Safe to delete now:** Yes.

### 8.4 `ProposalGenerator.tsx` is 980+ lines
- **File:** `src/pages/ProposalGenerator.tsx`
- **Issue:** This single file is approaching 1000 lines with complex state management, PDF generation, pricing calculations, and UI rendering all mixed together. High cognitive load, difficult to test, high risk of regression.
- **Risk Level:** Medium — maintenance burden and regression risk.
- **Recommended Fix:** Extract sub-components: `ProposalPricingForm`, `ProposalPreview`, `ProposalPdfGenerator`, `ProposalActions`. Each should be a separate file.
- **Safe to delete now:** N/A — refactoring task.

### 8.5 `App.tsx` error boundary catches but silently swallows
- **File:** `src/App.tsx` (lines 79-109)
- **Issue:** `AppErrorBoundary` catches errors but only logs to console and shows a generic "Reload App" message. No error reporting to monitoring service, no context about what failed.
- **Risk Level:** Medium — production errors go unreported.
- **Recommended Fix:** Add error reporting (e.g., Sentry, LogRocket) to `componentDidCatch`. Include error details in the fallback UI for debugging.
- **Safe to delete now:** N/A — requires adding monitoring.

### 8.6 `store/index.ts` is 1800+ lines (monolithic Zustand store)
- **File:** `src/store/index.ts`
- **Issue:** The entire application state lives in a single Zustand store file with 22+ `console.error` calls. This is a single point of failure — any bug in the store can cascade across the entire app.
- **Risk Level:** High — tight coupling, difficult to test, hard to debug.
- **Recommended Fix:** Split into domain-specific stores: `projectStore.ts`, `settingsStore.ts`, `preferencesStore.ts`, `workflowStore.ts`, etc. The file already has some of this pattern but the main store is still monolithic.
- **Safe to delete now:** N/A — major refactoring.

---

## 9. Build Artifacts Committed

### 9.1 `dist/` directory should be ignored
- **Directory:** `dist/`
- **Issue:** Contains compiled build artifacts (JS, CSS, HTML, images, sounds). If this is committed to version control, it will cause unnecessary merge conflicts and bloat.
- **Risk Level:** Low-Medium — repository bloat, merge conflicts.
- **Recommended Fix:** Ensure `dist/` is in `.gitignore`. If it's already tracked, remove it from git tracking with `git rm -r --cached dist/`.
- **Safe to delete now:** Yes (from git tracking).

---

## 10. Inconsistent Type Definitions

### 10.1 `ReinforcementPricing` imported from wrong type file
- **File:** `src/types/index.ts` (line 6)
- **Issue:** `import type { ReinforcementPricing } from './laborEstimate'` — `ReinforcementPricing` is defined in `src/types/reinforcementPricing.ts` but imported from `laborEstimate.ts`. Either there's a re-export or this is a mistake.
- **Risk Level:** Low — works if re-exported, confusing if not.
- **Recommended Fix:** Import from the canonical source file `./reinforcementPricing` directly, or add a clear re-export comment.
- **Safe to delete now:** Yes.

---

## 11. Additional Observations

### 11.1 `index.css` is the only global stylesheet
- **File:** `src/index.css`
- **Issue:** No information about what global styles are defined here. If Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) are present alongside custom styles, there's risk of style conflicts.
- **Risk Level:** Low — standard for Vite + Tailwind setups.
- **Recommended Fix:** Review to ensure no conflicting global styles.

### 11.2 Multiple theme files
- **Files:** `opsTheme.ts`, `plannerTheme.ts`, `scheduleTheme.ts`, `fieldToolTheme.ts`, `appTheme.ts`
- **Issue:** While `appTheme.ts` is designed as the canonical source, each feature has its own theme file that partially duplicates or overrides tokens. Over time, these will drift.
- **Risk Level:** Medium — style drift between features.
- **Recommended Fix:** Enforce a rule that all feature themes MUST compose from `appTheme.ts` tokens only. Add a linting rule or code review checklist.

### 11.3 `capacitor.config.ts` and mobile directories
- **Files:** `capacitor.config.ts`, `ios/`, `android/`
- **Issue:** Capacitor/Ionic mobile app scaffolding exists alongside the web app. If mobile builds are not actively maintained, the native configs will drift from the web app.
- **Risk Level:** Low — only affects mobile builds.
- **Recommended Fix:** If mobile is not a current priority, document the status and freeze updates.

---

## Summary — Priority Matrix

| Priority | Finding | Safe to Act Now |
|----------|---------|-----------------|
| 🔴 High | Supabase env var crash (`supabase.ts:6-8`) | Yes — add deferred error |
| 🔴 High | Silent failures in `useProjects.ts` | Yes — add toasts |
| 🔴 High | Monolithic Zustand store (`store/index.ts`) | No — requires refactoring |
| 🟡 Medium | ResourceCard duplication | Yes — delete root copy |
| 🟡 Medium | Two changeOrderPreviewAdapter files | Yes — consolidate |
| 🟡 Medium | Dark mode inconsistencies (12+ files) | Yes — systematic fix |
| 🟡 Medium | Console logging in production (100+ calls) | Yes — add logger |
| 🟡 Medium | Supabase queries without error handling | Yes — add wrapper |
| 🟡 Medium | Discarded Supabase migrations (9 files) | Yes — review & delete |
| 🟡 Medium | `dist/` in version control | Yes — git ignore |
| 🟡 Medium | Planner feature boundary unclear | No — requires design decision |
| 🟢 Low | Dead routes (`dispatch`, `qc`) | Yes — remove |
| 🟢 Low | `MarketingHome.tsx` unused | Yes — delete |
| 🟢 Low | `Calculator.tsx` wrapper | Yes — inline |
| 🟢 Low | Schedule blue vs cyan accent | Yes — cosmetic fix |
| 🟢 Low | ReinforcementPricing import source | Yes — clarify |
| 🟢 Low | Capacitor/mobile scaffolding | Document status |

---

## Recommended Next Steps

1. **Quick wins (safe to do now):** Delete dead files (`MarketingHome.tsx`, `Calculator.tsx` wrapper, root `ResourceCard.tsx`), remove dead routes (`dispatch`, `qc`), remove `dist/` from git tracking, review and delete discarded migrations.
2. **Medium effort:** Implement centralized logger to replace console calls, add user-facing error toasts for Supabase failures, consolidate duplicate adapters.
3. **Larger refactoring:** Split monolithic Zustand store, break up `ProposalGenerator.tsx`, clarify planner vs pour-planner boundaries, fix all dark mode inconsistencies.
4. **Production hardening:** Fix Supabase env var crash, add error monitoring to AppErrorBoundary, standardize Supabase error handling across all services.
