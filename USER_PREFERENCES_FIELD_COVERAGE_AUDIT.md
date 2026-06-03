# User Preferences Field Coverage Audit

**Date:** 2026-06-03  
**Scope:** Compare `public.user_preferences` schema to all preference fields the app saves, loads, or stores elsewhere.  
**Migrations:** None created (audit only).

---

## Supabase schema (reference)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | Default `gen_random_uuid()`; not sent by app |
| `user_id` | uuid UNIQUE | Auth user; upsert conflict target |
| `units` | text | `imperial` \| `metric` |
| `length_unit` | text | `feet` \| `meters` |
| `volume_unit` | text | `cubic_yards` \| `cubic_feet` \| `cubic_meters` |
| `measurement_system` | text | `imperial` \| `metric` |
| `currency` | text | `USD` \| `CAD` \| `EUR` \| `GBP` |
| `default_psi` | text | e.g. `3000` |
| `auto_save` | boolean | |
| `notifications` | jsonb | See notifications section |
| `sound_enabled` | boolean | Added in `20260618000000_expand_user_preferences.sql` |
| `haptics_enabled` | boolean | Added in `20260618000000_expand_user_preferences.sql` |
| `created_at` | timestamptz | DB default; not sent by app |
| `updated_at` | timestamptz | App sets on upsert; trigger also updates |

**Not in table:** `theme`, `darkMode`, `appearance`, `wasteFactor`, `defaultSlump`, `defaultPlacementMethod`.

---

## Field coverage table

| UI preference | App field / key | Current storage | Supabase column | Captured? | Recommended fix |
|---------------|-----------------|-----------------|-----------------|-----------|-------------------|
| Volume unit (Settings) | `volumeUnit` | Supabase + Zustand + `concretePreferences` fallback | `volume_unit` | **Yes** | None |
| Measurement system (Settings) | `measurementSystem` | Supabase + Zustand + localStorage fallback | `measurement_system` | **Yes** | None |
| Currency (Settings) | `currency` | Supabase + Zustand + localStorage fallback | `currency` | **Yes** | None |
| Default PSI (Settings) | `defaultPSI` | Supabase + Zustand + localStorage fallback | `default_psi` | **Yes** | None |
| Sound effects (Settings) | `soundEnabled` | Supabase + Zustand; `soundService` reads store | `sound_enabled` | **Yes** | Ensure `20260618000000` migration applied in production |
| Haptic feedback (Settings) | `hapticsEnabled` | Supabase + Zustand; `hapticService` reads store | `haptics_enabled` | **Yes** | Same migration deploy check |
| Auto-save (Settings) | `autoSave` | Supabase + Zustand | `auto_save` | **Yes** | None |
| Theme / light–dark (Settings) | `isDark` | Zustand persist `theme-storage` (localStorage) | — | **No** | Intentional split unless product wants cross-device theme sync → add `theme` column later |
| Email updates (Settings) | `notifications.emailUpdates` | Supabase JSONB + Zustand | `notifications` | **Yes** | Merge JSONB with defaults on load (see § Notifications) |
| Project reminders (Settings) | `notifications.projectReminders` | Same | `notifications` | **Yes** | Same |
| Weather alerts (Settings) | `notifications.weatherAlerts` | Same | `notifications` | `notifications` | **Yes** | Same |
| Project updates (no UI) | `notifications.projectUpdates` | Defaults in code; written on full save | `notifications` | **Partial** | Deep-merge with `DEFAULT_NOTIFICATIONS` on load; optional Settings toggles if product needs them |
| Team changes (no UI) | `notifications.teamChanges` | Same | `notifications` | **Partial** | Same |
| System alerts (no UI) | `notifications.systemAlerts` | Same | `notifications` | **Partial** | Same |
| Units (no Settings UI) | `units` | Supabase defaults `imperial`; always in upsert payload | `units` | **Yes** | Optional: expose in Settings if users should change |
| Length unit (no Settings UI) | `lengthUnit` | Supabase; used in Pour Planner / labor calc | `length_unit` | **Yes** | Optional: Settings control for `feet` vs `meters` |
| — (row identity) | — | DB only | `id` | **N/A** | Correct: omit from upsert |
| — (ownership) | `user.id` | Auth session | `user_id` | **Yes** | None |
| — (timestamps) | — | DB / trigger + app `updated_at` | `created_at`, `updated_at` | **Yes** | None |
| Project waste factor | `wasteFactor` | `projects.waste_factor` per project | — | **No** | Correct: project field, not user preference |
| Placement order / method | `placementOrder` | `projects` JSON / related columns | — | **No** | Correct: per-project workflow |
| Default slump | — | Not found in app | — | **No** | N/A — not implemented |
| Company profile | `companySettings` | `company_settings` table + `companySettings` localStorage | — | **No** | Correct: separate table |
| Schedule filter presets | per-user keys | `localStorage` (`scheduleFilterPresets`) | — | **No** | Optional future column or separate table if sync needed |
| Labor templates (user) | template list | `localStorage` (`generalTradeLaborTemplateStorage`) | — | **No** | Out of scope for `user_preferences` |
| Onboarding completed | flag | `localStorage` `onboarding_completed` | — | **No** | Intentional local flag |

---

## Write / load path summary

| Path | Location | Behavior |
|------|----------|----------|
| **Save (single)** | `src/services/userPreferencesService.ts` → `saveUserPreferences()` | `.upsert(..., { onConflict: 'user_id' })` |
| **Save (partial)** | `updateUserPreferences()` | Merges with `getUserPreferences()`, then `saveUserPreferences()` |
| **Load** | `getUserPreferences()` | `.select('*').eq('user_id', id).maybeSingle()` |
| **Migrate** | `migratePreferencesFromLocalStorage()` | Reads `concretePreferences`, upserts if no row |
| **Store** | `src/store/index.ts` → `usePreferencesStore` | Optimistic update → `updateUserPreferences()`; fallback `concretePreferences` on error |
| **Settings UI** | `src/pages/Settings.tsx` | `handlePreferenceChange` / `handleNotificationChange` → `updatePreferences()` |
| **Re-export** | `src/services/companySettingsService.ts` | Re-exports preference functions (legacy import path) |

**Direct `.insert` on `user_preferences`:** None found in repo.

---

## Verification checklist

### 1. Upsert uses `onConflict: 'user_id'`

**Pass.** `userPreferencesService.ts` line 117:

```typescript
.upsert(preferencesToRow(userId, preferences), { onConflict: 'user_id' })
```

`id` is not included in `preferencesToRow()`.

### 2. No direct insert for `user_preferences`

**Pass.** Grep found only `.select`, `.upsert` in `userPreferencesService.ts`. No `.insert`.

### 3. Load preferences only after auth user is available

**Pass (primary path).** `App.tsx` calls `loadPreferences()` only inside `if (user && !authLoading)`.

`getUserPreferences()` calls `requireAuthenticatedUserId()` and throws if unauthenticated.

**Note:** `Settings.tsx` imports `loadPreferences` but does not call it on mount; it relies on `App.tsx` initialization. Acceptable if user always hits app shell while signed in.

### 4. Safe defaults when no row exists

**Pass.** `getUserPreferences()` returns `{ ...DEFAULT_USER_PREFERENCES }` when `maybeSingle()` is empty.

**Caveat:** `usePreferencesStore` initial state is a **subset** (missing `volumeUnit`, `currency`, `measurementSystem`, `defaultPSI`, `units`, `lengthUnit`) until `loadPreferences()` completes. Runtime merge uses full `defaultPreferences` only on Supabase/localStorage fallback error path.

**Recommended fix (code, not migration):** Initialize store with `DEFAULT_USER_PREFERENCES` or align `PreferencesState` type with `UserPreferences`.

### 5. Notifications JSONB shape vs app usage

| Key | In `UserPreferences` type | In app defaults | In DB migration default | In Settings UI |
|-----|---------------------------|-----------------|-------------------------|----------------|
| `emailUpdates` | Yes | Yes | Yes | Yes |
| `projectReminders` | Yes | Yes | Yes | Yes |
| `weatherAlerts` | Yes | Yes | Yes | Yes |
| `projectUpdates` | Yes | Yes | No | No |
| `teamChanges` | Yes | Yes | No | No |
| `systemAlerts` | Yes | Yes | No | No |

**Save:** Full `notifications` object (all six keys) is written on upsert.

**Load:** `mapRowToPreferences` uses `data.notifications \|\| DEFAULT_NOTIFICATIONS`. If the row contains only the three-key DB default, the three hidden keys are **not** merged in unless the whole value is null/empty.

**Recommended fix:** On load, `{ ...DEFAULT_NOTIFICATIONS, ...(data.notifications as object) }`.

---

## Gaps and false positives

### Not bugs (out of scope for `user_preferences`)

- **Theme / `darkMode` / appearance:** `useThemeStore` + `theme-storage`; Settings theme button calls `toggleTheme()`, not Supabase.
- **`wasteFactor`:** Per-project on `projects` table (`store/index.ts`, Mix Design UI, pricing).
- **`defaultPlacementMethod` / placement order:** `placementOrder` on projects, `defaultPlacementOrder()` helper — not user prefs.
- **`defaultSlump`:** No references in `src/`.

### Schema vs app (all preference columns)

| Supabase column | Written by app? | Read by app? |
|-----------------|---------------|--------------|
| `units` | Yes | Yes |
| `length_unit` | Yes | Yes |
| `volume_unit` | Yes | Yes |
| `measurement_system` | Yes | Yes |
| `currency` | Yes | Yes |
| `default_psi` | Yes | Yes |
| `auto_save` | Yes | Yes |
| `notifications` | Yes | Yes |
| `sound_enabled` | Yes | Yes |
| `haptics_enabled` | Yes | Yes |

**Conclusion:** Every column in the provided schema is mapped in `userPreferencesService.ts` except system columns (`id`, `created_at`) handled by the database.

### Type system drift (non-schema)

- Canonical type: `src/types/index.ts` → `UserPreferences` (full shape).
- Duplicate minimal type: `src/types.ts` → `UserPreferences` (only `units`, `lengthUnit`, `volumeUnit`) — can confuse tooling.
- `PreferencesState` in `store/index.ts` under-types notifications and omits several fields from its interface.

---

## localStorage keys related to preferences

| Key | Purpose | Synced to Supabase? |
|-----|---------|---------------------|
| `concretePreferences` | Legacy + error fallback for user prefs | Migrated once via `migratePreferencesFromLocalStorage` if no DB row |
| `theme-storage` | Zustand theme (`isDark`) | No |
| `companySettings` | Company profile (separate feature) | Separate `company_settings` table |
| `onboarding_completed` | Onboarding flag | No |

---

## Migration status

| Need | Status |
|------|--------|
| New migration for field coverage | **Not required** — schema already covers app-written fields |
| `sound_enabled` / `haptics_enabled` in production | **Verify deployed** — `20260618000000_expand_user_preferences.sql` |
| RLS for upsert | **Already present** — SELECT, INSERT, UPDATE on `user_id = auth.uid()` |

---

## Summary

| Area | Result |
|------|--------|
| Schema covers app upsert payload | **Yes** (all listed columns mapped) |
| Upsert `onConflict: 'user_id'` | **Yes** |
| Direct insert | **None** |
| Auth-gated load | **Yes** (App + `requireAuthenticatedUserId`) |
| Defaults when no row | **Yes** (service-level) |
| Notifications shape | **Mostly yes**; recommend deep-merge on load for partial JSONB |
| Theme / waste / placement | **Correctly not in** `user_preferences` |
| Recommended code fixes (no migration) | Notifications merge on load; store initial state / types alignment |

**No migrations recommended from this audit.**
