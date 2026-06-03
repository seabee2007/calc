# User Preferences Upsert Fix Report

## Problem

Saving preferences failed after schema columns were added:

```
23505 duplicate key value violates unique constraint "user_preferences_user_id_key"
```

## Root cause

`updateUserPreferences` already called `.upsert()`, but **without** `onConflict: 'user_id'`.

PostgREST defaults conflict resolution to the primary key (`id`). Each save generated a new `id` and attempted an **INSERT**, which violated `UNIQUE(user_id)` when a row already existed for that user.

## Fix

**New file:** `src/services/userPreferencesService.ts`

- Single save path: `saveUserPreferences()` → `.upsert(payload, { onConflict: 'user_id' })`
- `updateUserPreferences()` merges partial updates, then calls `saveUserPreferences()`
- `getUserPreferences()` uses `.maybeSingle()` (no row → defaults)
- Payload includes only existing table columns (no `id`, no `theme`)
- Returns mapped row from `.select().single()` after upsert

**Updated imports:**

- `src/store/index.ts` imports preferences from `userPreferencesService`
- `src/services/companySettingsService.ts` re-exports the same functions for backward compatibility

## Columns written (unchanged set)

| DB column | App field |
|-----------|-----------|
| `user_id` | authenticated user id |
| `units` | `units` |
| `length_unit` | `lengthUnit` |
| `volume_unit` | `volumeUnit` |
| `measurement_system` | `measurementSystem` |
| `currency` | `currency` |
| `default_psi` | `defaultPSI` |
| `auto_save` | `autoSave` |
| `sound_enabled` | `soundEnabled` |
| `haptics_enabled` | `hapticsEnabled` |
| `notifications` | `notifications` (jsonb) |
| `updated_at` | ISO timestamp |

`theme` is not stored in `user_preferences` (handled by `themeStore`).

## Audit: direct inserts

Searched the repo for:

- `.from('user_preferences').insert`
- `.from("user_preferences").insert`

**No matches.** All saves go through `userPreferencesService`.

## RLS

Existing policies (unchanged):

- INSERT with `auth.uid() = user_id`
- UPDATE with `auth.uid() = user_id`
- SELECT with `auth.uid() = user_id`

Upsert requires both INSERT and UPDATE policies; both are present from migration `20250125000000`.

## Acceptance test (manual)

1. Sign in.
2. Change haptics / sound / units → save (auto-save or explicit).
3. Change another preference → save again.
4. Expect **no** `23505` error.
5. In Supabase: one row per `user_id`, values updated.
6. Refresh → preferences load from that row.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Repo-wide pre-existing issues; no new issues in preference service files |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing drift |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |
