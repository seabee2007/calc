# Supabase Project Schema Implementation Report
## Summary
Implemented the approved high-priority Supabase project schema/RLS plan with one new migration and narrow app changes. Historical migrations were not edited, existing project data was not dropped, the custom `public.users` table was not deleted, and RLS remains enabled.
## Migration File Created
- `supabase/migrations/20260603070000_fix_project_ownership_rls.sql`
## Schema Changes
- Added `public.sync_auth_user_to_public_users()` as a `SECURITY DEFINER` trigger function.
- Added `sync_auth_user_to_public_users` trigger on `auth.users` for insert and email update events.
- Backfills `public.users` from existing `auth.users` rows where no matching `id` or email already exists.
- Sets `public.projects.user_id DEFAULT auth.uid()` as a database safety fallback.
- Replaces the stale `projects_mix_profile_check` constraint.
- Aligns allowed `projects.mix_profile` values with the app union:
  - `standard`
  - `highEarly`
  - `highStrength`
  - `rapidSet`
- Migrates legacy values before adding the new constraint:
  - `rapid` → `rapidSet`
  - `slow` → `highStrength`
  - unknown/null values → `standard`
## RLS Policies Changed
- Dropped the broad existing project policy:
  - `Users can manage own projects`
- Added explicit ownership policies on `public.projects`:
  - `Users can read own projects`
  - `Users can insert own projects`
  - `Users can update own projects`
  - `Users can delete own projects`
- Insert and update policies use `WITH CHECK (user_id = auth.uid())`.
- Select, update, and delete policies use `USING (user_id = auth.uid())`.
## App Files Changed
- `src/store/index.ts`
  - Project creation now gets the authenticated Supabase user.
  - Inserts explicitly include `user_id: user.id`.
  - Keeps the database `DEFAULT auth.uid()` as a fallback rather than relying on it as the only ownership path.
- `src/services/projectService.ts`
  - The secondary project creation path also gets the authenticated user and includes `user_id`.
- `src/pages/Projects.tsx`
  - Removed the duplicate direct Supabase `pour_date` update.
  - Pour-date updates now route through the existing `updateProject` store path.
  - Project creation now awaits the insert before closing the form and showing success.
  - Project loading remains in the authenticated Projects route instead of the global app mount.
- `src/App.tsx`
  - Removed global `loadProjects()` call so projects are not loaded before auth is confirmed.
## Validation Results
- `npm run lint`: passed.
  - Existing non-failing warning remains: TypeScript 5.6.3 is outside the officially supported `@typescript-eslint/typescript-estree` range of `>=4.7.4 <5.6.0`.
- `npx tsc -p tsconfig.app.json --noEmit`: passed with no output.
- `npm run build`: passed.
  - Existing non-failing Browserslist/caniuse-lite stale-data warning remains.
  - Existing non-failing large chunk warning remains.
## Manual Test Checklist
These checks still need to be completed against a live local or Supabase-backed environment with a signed-in user:
- Sign in.
- Create a project.
- Edit project mix profile.
- Edit pour date.
- Refresh page and confirm the project still loads.
- Sign out and confirm projects do not load publicly.
- Sign back in and confirm only owned projects load.
## Rollback Notes
- App rollback:
  - Revert changes in `src/App.tsx`, `src/pages/Projects.tsx`, `src/store/index.ts`, and `src/services/projectService.ts`.
- Database rollback, if the new migration has been applied:
  - Restore the prior project policy only if needed:
    - Drop the four explicit project policies.
    - Recreate `Users can manage own projects` with `USING (user_id = auth.uid())`.
  - Restore the prior mix profile constraint only if the app is also reverted to old persisted values:
    - Drop `projects_mix_profile_check`.
    - Map `rapidSet` and `highStrength` back only if that data rollback is explicitly desired.
    - Re-add the old constraint for `standard`, `rapid`, and `slow`.
  - Remove `projects.user_id DEFAULT auth.uid()` only if project inserts are reverted to another ownership assignment strategy.
  - Drop `sync_auth_user_to_public_users` trigger and `public.sync_auth_user_to_public_users()` only if the custom `public.users` sync is no longer desired.
- Do not deploy this migration to production until project create/edit/refresh/sign-out/sign-in behavior has been manually verified.
