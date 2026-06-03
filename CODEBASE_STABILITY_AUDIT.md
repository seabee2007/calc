# Concrete Calc Codebase Stability Audit
Audit scope: `src`, app config files, and `supabase` files under `C:\Users\Admin`.
This report has been updated after the TypeScript/ESLint stability pass and toolchain cleanup.
## Current validation status
- `npm run lint`: passed after narrowing the lint script to `eslint src`.
  - Previous `EPERM` failure from scanning protected user-profile folders is resolved.
  - Existing non-failing warning remains: TypeScript 5.6.3 is outside the officially supported `@typescript-eslint/typescript-estree` range of `>=4.7.4 <5.6.0`.
- `npx eslint src`: passed during the TypeScript/ESLint stability pass.
- `npx tsc -p tsconfig.app.json --noEmit`: passed during the TypeScript/ESLint stability pass and toolchain cleanup.
- `npm run build`: passed during the TypeScript/ESLint stability pass and toolchain cleanup.
  - Existing non-failing warnings remain:
    - Browserslist/caniuse-lite data is stale.
    - One generated chunk is larger than 500 kB after minification.
- `npm test`: not available because `package.json` has no `test` script and no test files/configs were found.
- `dist/`: ignored by git and has no tracked build artifacts to clean up.
## Completed cleanup work
- Narrowed `package.json` lint script from `eslint .` to `eslint src`.
- Fixed the previously reported TypeScript and ESLint errors without broad behavior changes.
- Fixed the React hook ordering issue in `StrengthProgress`.
- Fixed the immediate `MixDesignAdvisor`, `CalculationForm`, Framer Motion prop, and PDF typing blockers required for lint/typecheck/build stability.
- Created validation reports for the TypeScript/ESLint pass and toolchain cleanup.
## Remaining findings
### 1. Supabase `mix_profile` database constraint conflicts with UI values
- File path: `supabase/migrations/20250526082335_navy_waterfall.sql`, `src/types/curing.ts`, `src/components/projects/StrengthProgress.tsx`, `src/pages/Projects.tsx`
- Issue: The migration allows only `standard`, `rapid`, and `slow`, while the UI and TypeScript use `standard`, `highEarly`, `highStrength`, and `rapidSet`. Saving `highEarly`, `highStrength`, or `rapidSet` can fail in production.
- Risk level: High
- Recommended fix: Add a new migration that aligns the database constraint with the canonical app values, or add an explicit persistence mapping between UI values and database values. Do not edit already-applied production migrations directly.
- Safe to delete/update now: Safe to update now through a new migration.
### 2. Project inserts appear to omit required `user_id`
- File path: `supabase/migrations/20250522114507_fancy_sea.sql`, `src/store/index.ts`, `src/services/projectService.ts`
- Issue: `projects.user_id` is `NOT NULL` and RLS policies require ownership, but project creation paths appear to insert project fields without reliably assigning the authenticated user's id. This can make project creation fail under RLS or create inconsistent ownership behavior.
- Risk level: High
- Recommended fix: Confirm the intended ownership model, then include `auth.user.id` in all project insert paths or add a database-side default/trigger that safely assigns `auth.uid()`.
- Safe to delete/update now: Safe to update now after confirming the intended Supabase auth model.
### 3. Custom `users` table conflicts with Supabase auth usage
- File path: `supabase/migrations/20250522114507_fancy_sea.sql`, `supabase/migrations/20250522114721_rough_credit.sql`, `src/hooks/useAuth.ts`
- Issue: `projects.user_id` references a custom `users(id)` table, while subscriptions reference `auth.users(id)` and the app authenticates through `supabase.auth`. There is no visible trigger that mirrors `auth.users` into the custom `users` table.
- Risk level: High
- Recommended fix: Standardize foreign keys on `auth.users(id)` or add a reliable profile/user bootstrap trigger. Update RLS policies and service insert paths to match the chosen model.
- Safe to delete/update now: Safe to update now through migrations. Not safe to delete the custom table without migration planning.
### 4. Duplicate Supabase project data layers
- File path: `src/store/index.ts`, `src/services/projectService.ts`
- Issue: Project CRUD is implemented directly in the Zustand store and separately in `projectService.ts`. The store maps snake_case/camelCase fields manually, while `projectService.ts` returns raw rows. This duplication can create inconsistent project behavior.
- Risk level: Medium to High
- Recommended fix: Keep one project data layer. Prefer moving Supabase calls into `projectService.ts` with typed mapping helpers, then make the store call that service.
- Safe to delete/update now: Safe to update now. Safe to delete `projectService.ts` only after confirming no imports or planned branch usage.
### 5. Direct Supabase update bypasses store abstraction
- File path: `src/pages/Projects.tsx`, `src/store/index.ts`
- Issue: `handleDateChange` updates Supabase directly and then calls `updateProject`, which also updates Supabase. This duplicates writes and can create inconsistent error handling or stale UI state.
- Risk level: Medium
- Recommended fix: Add `pourDate` support to the store/service update path and call only that abstraction from the page.
- Safe to delete/update now: Safe to update now.
### 6. App loads projects before confirming auth state
- File path: `src/App.tsx`, `src/store/index.ts`, `src/hooks/useAuth.ts`
- Issue: `App` calls `loadProjects()` globally on mount, including public and unauthenticated pages. With RLS, this can produce Supabase errors and console noise before a user signs in.
- Risk level: Medium
- Recommended fix: Load projects only inside authenticated areas or after `useAuth` confirms a user exists.
- Safe to delete/update now: Safe to update now.
### 7. Supabase client throws at module import time
- File path: `src/lib/supabase.ts`
- Issue: Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` throws during module import, crashing the whole app rather than showing a controlled configuration error.
- Risk level: Medium
- Recommended fix: Keep fast-fail behavior in development if desired, but add a production-safe configuration boundary or error screen.
- Safe to delete/update now: Safe to update now.
### 8. Edge chat function has broad CORS and weak abuse controls
- File path: `supabase/functions/askConcrete/index.ts`
- Issue: The function allows `Access-Control-Allow-Origin: *`, accepts calls using the anon key from any origin, uses an OpenAI API key server-side, and has no visible auth enforcement, rate limiting, or abuse guard.
- Risk level: High
- Recommended fix: Restrict allowed origins, require authenticated Supabase JWTs if appropriate, validate payload size, add rate limiting, and check required provider secrets before making model calls.
- Safe to delete/update now: Safe to update now.
### 9. Chat function can call an undefined URL
- File path: `src/components/ConcreteChat.tsx`
- Issue: The module only warns when `VITE_SUPABASE_FUNCTIONS_URL` is missing, but `askConcrete()` can still fetch `${FN_BASE}/askConcrete`, which becomes `undefined/askConcrete`.
- Risk level: Medium
- Recommended fix: Disable chat or show a setup message when the function base URL is missing.
- Safe to delete/update now: Safe to update now.
### 10. Chat errors can expose raw backend messages
- File path: `src/components/ConcreteChat.tsx`, `supabase/functions/askConcrete/index.ts`
- Issue: The client renders raw error messages into the chat, and the function logs provider errors directly. This can expose implementation details or noisy backend failures.
- Risk level: Medium
- Recommended fix: Show generic user-facing failures and route sanitized technical details through controlled logging or monitoring.
- Safe to delete/update now: Safe to update now.
### 11. Edge chat function uses an old model string
- File path: `supabase/functions/askConcrete/index.ts`
- Issue: The function calls `gpt-3.5-turbo`, which is an old model choice and may have quality, support, or lifecycle risk.
- Risk level: Medium
- Recommended fix: Move provider/model selection into environment configuration and update to the approved current model for the product.
- Safe to delete/update now: Safe to update after product/provider decision.
### 12. Hardcoded WeatherAPI key in frontend bundle
- File path: `src/services/weatherService.ts`
- Issue: `WEATHER_API_KEY` is hardcoded in client-side code, so it will be exposed in the production bundle and can be abused.
- Risk level: High
- Recommended fix: Move weather requests behind a serverless function or backend proxy, rotate the exposed key, and enforce origin/rate controls.
- Safe to delete/update now: Safe to update now. Key rotation should be coordinated.
### 13. Weather service makes multiple sequential external requests
- File path: `src/services/weatherService.ts`, `src/components/calculations/CalculationForm.tsx`, `src/pages/MixDesignAdvisor.tsx`
- Issue: Getting weather performs one forecast call plus three history calls sequentially. This can be slow, fail partially, or hit API quotas from repeated UI actions.
- Risk level: Medium
- Recommended fix: Cache results, parallelize history calls if retained, add timeouts/retry policy, and consider fetching only data used by the active UI.
- Safe to delete/update now: Safe to update now.
### 14. Production console logging is widespread
- File path: `src/App.tsx`, `src/hooks/useAuth.ts`, `src/services/weatherService.ts`, `src/components/ConcreteChat.tsx`, `src/pages/Projects.tsx`, `src/components/projects/ProjectCard.tsx`, `src/pages/MixDesignAdvisor.tsx`
- Issue: `console.error` and `console.warn` are used in production paths for auth, project loading, date parsing, weather, chat, and mix-design flows.
- Risk level: Low to Medium
- Recommended fix: Replace with a small logger that suppresses or sanitizes logs in production and routes actionable errors to monitoring.
- Safe to delete/update now: Safe to update now.
### 15. Duplicate/conflicting type entry points remain an architectural risk
- File path: `src/types.ts`, `src/types/index.ts`
- Issue: Immediate typecheck blockers were fixed, but the codebase still has two overlapping type entry points. Future edits can easily reintroduce conflicts between project, calculation, weather, unit, mix-design, and pricing types.
- Risk level: Medium
- Recommended fix: Consolidate to one canonical type entry point after the Supabase model decisions are made.
- Safe to delete/update now: Safe to update now. Not safe to delete either file without confirming import resolution.
### 16. Project model remains tightly coupled to mix-profile persistence
- File path: `src/types.ts`, `src/types/index.ts`, `src/store/index.ts`, `src/pages/Projects.tsx`, `src/components/projects/StrengthProgress.tsx`
- Issue: `Project.mixProfile` is now represented well enough for typecheck stability, but persistence still depends on database values and mappings that are not aligned with the UI union.
- Risk level: High
- Recommended fix: Resolve the Supabase `mix_profile` migration and then make the app `Project` type, store mapping, and persistence fields match exactly.
- Safe to delete/update now: Safe to update now as part of the Supabase schema fix.
### 17. Unused subscription service and types
- File path: `src/services/subscriptionService.ts`, `src/types/subscription.ts`, `supabase/migrations/20250522114721_rough_credit.sql`
- Issue: Subscription service/types exist but no active UI route or import was found. Stripe edge function files are also marked as no longer needed.
- Risk level: Medium
- Recommended fix: Decide whether billing is in scope. If not, remove subscription service/types and archive billing migrations/functions carefully. If billing is planned, add the missing UI and service integration.
- Safe to delete/update now: Safe to delete only after confirming billing is not planned or deployed.
### 18. Old Stripe edge functions are placeholders
- File path: `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/create-portal-session/index.ts`, `supabase/functions/_shared/stripe.ts`
- Issue: These files only contain comments saying they can be deleted. They are dead/old code and can confuse deployment or function discovery.
- Risk level: Low
- Recommended fix: Remove them from the deployed function set if Stripe billing is no longer used.
- Safe to delete/update now: Safe to delete after confirming no Supabase deployment references these function names.
### 19. Duplicate historical foreign-key migrations
- File path: `supabase/migrations/20250524084456_steep_peak.sql`, `supabase/migrations/20250524084716_fragrant_bread.sql`, `supabase/migrations/20250524084752_maroon_castle.sql`, `supabase/migrations/20250524090020_small_fog.sql`
- Issue: Four migrations repeatedly drop and recreate the same `calculations_project_id_fkey` constraint. This is historical duplication and increases migration noise.
- Risk level: Low
- Recommended fix: Leave applied migrations intact for production history, but squash/clean them only in a resettable development baseline.
- Safe to delete/update now: Not safe to delete if these migrations may already be applied.
### 20. Dynamic Tailwind class will not be generated reliably
- File path: `src/pages/MixDesignAdvisor.tsx`
- Issue: `text-${getEvaporationRiskLevel(...).color}-600` is built dynamically. Tailwind cannot reliably detect this during build, so the intended color class may be absent in production CSS.
- Risk level: Medium
- Recommended fix: Map risk levels to explicit class strings such as `text-green-600`, `text-yellow-600`, and `text-red-600`.
- Safe to delete/update now: Safe to update now.
### 21. Dark mode is not implemented consistently
- File path: `tailwind.config.js`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Select.tsx`, `src/components/ui/Modal.tsx`, `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, many page components
- Issue: The UI hardcodes light colors such as `bg-white`, `text-gray-900`, and `bg-gray-50`; Tailwind has no visible `darkMode` configuration and there are almost no `dark:` variants.
- Risk level: Medium
- Recommended fix: Decide whether the product supports dark mode. If yes, add a theme strategy and centralize tokens in shared components. If no, remove dark-mode expectations from the product surface.
- Safe to delete/update now: Safe to update now.
### 22. Shared modal is duplicated by custom modal markup
- File path: `src/components/ui/Modal.tsx`, `src/components/projects/ProjectForm.tsx`, `src/pages/Projects.tsx`, `src/components/ui/Toast.tsx`
- Issue: `Modal` exists, but `ProjectForm` and delete confirmation implement their own fixed overlays. `Toast` also uses a full-screen blocking overlay, which is unusual for a toast.
- Risk level: Medium
- Recommended fix: Reuse `Modal` for modal dialogs and make toast non-blocking unless intentionally acting as an alert dialog.
- Safe to delete/update now: Safe to update now.
### 23. Unused `Tabs` component
- File path: `src/components/ui/Tabs.tsx`
- Issue: No imports/usages were found outside the component file itself.
- Risk level: Low
- Recommended fix: Delete it if no near-term UI uses tabs, or add it to active UI intentionally.
- Safe to delete/update now: Likely safe to delete now after one final import search in all branches.
### 24. Unused `ActionChecklist` component
- File path: `src/components/calculations/ActionChecklist.tsx`
- Issue: No active imports/usages were found outside the component file itself. Mix-design recommendations manually render similar checklist UI elsewhere.
- Risk level: Low
- Recommended fix: Either use this shared component for recommendations or delete it.
- Safe to delete/update now: Likely safe to delete now after one final import search in all branches.
### 25. Unused `EvapGauge` component
- File path: `src/components/calculations/EvapGauge.tsx`
- Issue: No active imports/usages were found outside the component file itself. `MixDesignAdvisor` manually renders evaporation risk UI instead.
- Risk level: Low
- Recommended fix: Replace the manual evaporation risk block with `EvapGauge`, or delete `EvapGauge`.
- Safe to delete/update now: Likely safe to delete now after one final import search in all branches.
### 26. Document builder/report generation remains over-coupled
- File path: `src/utils/pdf.ts`, `src/components/mix/SpecGenerator.tsx`, `src/pages/MixDesignAdvisor.tsx`, `src/pages/Projects.tsx`
- Issue: Immediate PDF typing/build errors were fixed, but project reports and mix-spec downloads still share document generation paths and synthetic project data in ways that make future changes risky.
- Risk level: Medium to High
- Recommended fix: Split document generation into explicit builders, for example `generateProjectReportPDF(project, psi)` and `generateMixSpecPDF(spec)`, with dedicated input types.
- Safe to delete/update now: Safe to update now.
### 27. Mix-design and material calculations are duplicated across features
- File path: `src/utils/calculations.ts`, `src/pages/Projects.tsx`, `src/pages/MixDesignAdvisor.tsx`, `src/utils/pdf.ts`, `src/components/mix/AdmixtureCalculator.tsx`, `src/components/mix/SpecGenerator.tsx`
- Issue: Projects, PDF reports, mix advisor, and admixture/spec components each calculate or format mix recommendations and materials in slightly different ways.
- Risk level: Medium
- Recommended fix: Centralize mix-design domain logic in a single service/module and make UI components render results instead of recomputing domain rules.
- Safe to delete/update now: Safe to update now.
### 28. Planner-like project workflow is scattered rather than centralized
- File path: `src/pages/Projects.tsx`, `src/pages/Calculator.tsx`, `src/components/projects/StrengthProgress.tsx`, `src/store/index.ts`
- Issue: Planner-like state exists across project selection, pour date, mix profile, waste factor, calculations, and strength progress. Some updates go through the store, while `Projects.tsx` also calls Supabase directly for pour date.
- Risk level: Medium
- Recommended fix: If a planner feature is intended, centralize planner state/actions in one service/store layer and route all project planning updates through it.
- Safe to delete/update now: Safe to update now.
### 29. Pricing location flow can silently return zero pricing
- File path: `src/components/calculations/PricingCalculator.tsx`, `src/utils/pricing.ts`
- Issue: `calculateConcreteCost` returns empty pricing when no supplier is selected, so users can see `$0.00` totals until location is selected.
- Risk level: Medium
- Recommended fix: Represent pricing as unavailable until a supplier is selected, and make the UI explain the missing location/supplier requirement.
- Safe to delete/update now: Safe to update now.
### 30. PWA manifest references missing icon files
- File path: `vite.config.ts`
- Issue: The PWA manifest references `favicon.ico`, `apple-touch-icon.png`, `mask-icon.svg`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, and `maskable-icon-512x512.png`, but these files were not found at the app root.
- Risk level: Medium
- Recommended fix: Add the referenced assets in the correct Vite public location or remove/update the manifest references.
- Safe to delete/update now: Safe to update now.
### 31. Vite/Tailwind config uses CommonJS `require` inside ESM project
- File path: `tailwind.config.js`, `package.json`
- Issue: The package is `"type": "module"`, but `tailwind.config.js` uses `require('@tailwindcss/typography')`. Depending on tooling version, this can break config loading.
- Risk level: Medium
- Recommended fix: Use ESM import syntax or rename config to CommonJS (`tailwind.config.cjs`) consistently.
- Safe to delete/update now: Safe to update now.
### 32. Resource and support links include placeholders
- File path: `src/pages/Resources.tsx`
- Issue: `articleList` links and the support CTA use `href="#"`, which can cause broken navigation and poor production UX.
- Risk level: Low
- Recommended fix: Replace with real routes/URLs or hide the sections until content exists.
- Safe to delete/update now: Safe to update now.
### 33. Reset password page has different layout/theme from other auth pages
- File path: `src/pages/auth/ResetPassword.tsx`, `src/pages/auth/Login.tsx`, `src/pages/auth/SignUp.tsx`
- Issue: Login and signup use the background image and overlay; reset password uses a plain gray page. This is inconsistent styling and can look like a different product surface.
- Risk level: Low
- Recommended fix: Reuse a shared auth layout component for all auth pages.
- Safe to delete/update now: Safe to update now.
### 34. Duplicate auth layout and form patterns
- File path: `src/pages/auth/Login.tsx`, `src/pages/auth/SignUp.tsx`, `src/pages/auth/ResetPassword.tsx`
- Issue: Auth pages duplicate layout, card, background, field, error, and navigation patterns.
- Risk level: Low
- Recommended fix: Extract shared `AuthLayout` and form helper components after the higher-risk Supabase work is complete.
- Safe to delete/update now: Safe to update now.
## Highest-priority fix order
1. Add a new Supabase migration to align `projects.mix_profile` with the app's canonical mix profile values.
2. Fix project ownership by making all project insert paths assign the authenticated user's id consistently.
3. Resolve the custom `users` table versus `auth.users` mismatch and update related RLS policies.
4. Consolidate project CRUD into one service/store path and remove direct page-level Supabase writes.
5. Gate project loading behind confirmed authentication.
6. Harden Supabase edge functions, especially chat CORS/auth/rate-limit behavior.
7. Move the hardcoded WeatherAPI key behind a backend/proxy path and rotate the exposed key.
8. Consolidate duplicate type entry points once the Supabase data model is finalized.
9. Split PDF/document generation into project-report and mix-spec builders.
10. Remove or wire unused components/services after a final import search.
