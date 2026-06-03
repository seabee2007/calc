# User Preferences Schema Fix Report

## Problem

Saving preferences failed with Supabase/PostgREST error:

```
PGRST204: Could not find the 'haptics_enabled' column of 'user_preferences' in the schema cache
```

The app upserts `haptics_enabled` and `sound_enabled`, but the initial `user_preferences` migration never created those columns.

## Fields audited

### Written to `user_preferences` (app)

| App field (camelCase) | DB column | In original migration |
|----------------------|-----------|------------------------|
| `units` | `units` | Yes |
| `lengthUnit` | `length_unit` | Yes |
| `volumeUnit` | `volume_unit` | Yes |
| `measurementSystem` | `measurement_system` | Yes |
| `currency` | `currency` | Yes |
| `defaultPSI` | `default_psi` | Yes |
| `autoSave` | `auto_save` | Yes |
| `soundEnabled` | `sound_enabled` | **No** |
| `hapticsEnabled` | `haptics_enabled` | **No** |
| `notifications` | `notifications` (jsonb) | Yes |
| — | `updated_at` (upsert + trigger) | Yes |

### Not stored in `user_preferences`

| Field | Where it lives |
|-------|----------------|
| `theme` / `appearance` | `themeStore` (`zustand` persist key `theme-storage`), not Supabase |
| Company settings | `company_settings` table |

Default values when no row exists are returned in `getUserPreferences()` in `companySettingsService.ts` (including `soundEnabled: true`, `hapticsEnabled: true`).

## Migration

**File:** `supabase/migrations/20260618000000_expand_user_preferences.sql`

- Adds `sound_enabled BOOLEAN NOT NULL DEFAULT true`
- Adds `haptics_enabled BOOLEAN NOT NULL DEFAULT true`
- Idempotently reaffirms `user_id NOT NULL`, `UNIQUE(user_id)`, RLS, and SELECT/INSERT/UPDATE policies
- Sends `NOTIFY pgrst, 'reload schema'` to refresh PostgREST schema cache

Historical migrations were not modified.

## App changes

No code changes required. `updateUserPreferences()` already sends only columns that exist after this migration. Local fallback in `usePreferencesStore` (`concretePreferences` in `localStorage`) is unchanged.

## Deploy steps

1. Apply migration: `supabase db push` or run SQL in the Supabase SQL editor.
2. If PGRST204 persists, reload schema in Dashboard → Settings → API, or restart the project.
3. Re-test Settings toggles for Sound and Haptics.

## Validation

Commands run from `calc/`:

| Command | Result |
|---------|--------|
| `npm run lint` | Exit 1 — 202 pre-existing issues repo-wide (none introduced by this migration; `companySettingsService.ts` has an existing unused `data` binding at line 311) |
| `npx tsc -p tsconfig.app.json --noEmit` | Exit 2 — pre-existing drift (duplicate `UserPreferences` in `types.ts` vs `types/index.ts`, store typing mismatch, etc.) |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** — Vite production build + PWA |
