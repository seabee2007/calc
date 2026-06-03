# Company Settings Data Loss Audit (Read-Only)

**Date:** 2026-06-03  
**Scope:** `public.company_settings` — why saved rows might disappear or appear empty.  
**Constraints:** No code changes, migrations, resets, seeds, or deletions performed during this audit.

---

## Executive summary

The application has **one explicit Supabase DELETE** for `company_settings` (`deleteCompanySettings`), but it is **not called anywhere in the UI or app init**. Logout and stale-session cleanup **do not** delete database rows.

A **completely empty table** (zero rows) is most likely explained by **environment/project mismatch**, **`supabase db reset` / dashboard truncate**, or **`auth.users` deletion cascading** — not by routine Settings save paths.

A **row that still exists but all columns are blank** is plausible from **auto-save racing before `loadCompanySettings` finishes**, or from **`updateCompanySettings` merging empty local form state over good DB data**.

---

## 1. Current schema

**Source:** `supabase/migrations/20250125000000_add_storage_and_company_settings.sql` + `20260612000000_company_tax_settings.sql`

### Columns (effective)

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `id` | `uuid` | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | — | **NOT NULL**, **UNIQUE** |
| `company_name` | `text` | `''` | |
| `address` | `text` | `''` | Single string (no split street/city columns) |
| `phone` | `text` | `''` | |
| `email` | `text` | `''` | |
| `license_number` | `text` | `''` | |
| `motto` | `text` | `''` | |
| `logo_url` | `text` | nullable | |
| `logo_path` | `text` | nullable | |
| `created_at` | `timestamptz` | `now()` | |
| `updated_at` | `timestamptz` | `now()` | Trigger-maintained |
| `tax_system` | `text` | `'none'` | Added in tax migration |
| `tax_rate_percent` | `numeric` | `0` | |
| `tax_application` | `text` | `'materials_only'` | |

### Keys and references

| Item | Definition |
|------|------------|
| **Primary key** | `id` |
| **Unique constraint** | `user_id` (one row per auth user) |
| **Foreign key** | `user_id` → `auth.users(id)` |
| **ON DELETE CASCADE** | **Yes** — deleting an `auth.users` row **deletes** that user’s `company_settings` row |

There is **no** `business_address` JSON column in schema; the app stores one formatted `address` string (from Settings `USAddressFields` → `formatUSAddress`).

### RLS

RLS **enabled**. Policies (all `auth.uid() = user_id`):

| Policy | Operation |
|--------|-----------|
| Users can view their own company settings | `SELECT` |
| Users can insert their own company settings | `INSERT` |
| Users can update their own company settings | `UPDATE` |
| Users can delete their own company settings | `DELETE` |

**Implication:** The anon/authenticated client can DELETE its own row if code calls `.delete()`. Dashboard SQL editor / service role bypasses RLS and sees all rows.

---

## 2. All write paths

### 2.1 `getCompanySettings` (read, not write)

| | |
|--|--|
| **File** | `src/services/companySettingsService.ts` |
| **Function** | `getCompanySettings()` |
| **SQL** | `SELECT * FROM company_settings WHERE user_id = ?` + `.single()` |
| **When** | Before every `updateCompanySettings` / `saveCompanySettings` merge; on `loadCompanySettings` |
| **Auth** | Requires `supabase.auth.getUser()` — throws if not authenticated |
| **Empty row risk** | If no row: returns in-memory **defaults without `id`** (not a DB write). PGRST116 treated as “not found”. |

### 2.2 `saveCompanySettings` (insert + upsert)

| | |
|--|--|
| **File** | `src/services/companySettingsService.ts` |
| **Function** | `saveCompanySettings(settings)` |
| **SQL** | `.upsert(dbData, { onConflict: 'user_id' }).select().single()` |
| **Payload** | Always includes: `user_id`, `company_name`, `address`, `phone`, `email`, `license_number`, `motto`, `logo_url`, `logo_path`; optional tax fields if defined |
| **Null handling** | `logo_url` / `logo_path` use `?? null`; text fields use `\|\| ''` → **missing/undefined becomes empty string** |
| **When** | Called from `updateCompanySettings`, `migrateFromLocalStorage` |
| **Before auth ready** | Throws `User not authenticated` if no user |
| **Overwrite risk** | **High** when called with a full merged object whose text fields are `''` — **updates row to blank values** (does not remove row) |

### 2.3 `updateCompanySettings` (read-merge-write)

| | |
|--|--|
| **File** | `src/services/companySettingsService.ts` |
| **Function** | `updateCompanySettings(updates)` |
| **Flow** | `getCompanySettings()` → spread merge `{ ...current, ...updates }` → `saveCompanySettings(merged)` |
| **When** | All store-driven saves (Settings, onboarding, logo patch, tax dropdowns) |
| **Overwrite risk** | **High** if `updates` contains empty strings for fields that should be preserved — merge **replaces** non-undefined keys, including `''` |

### 2.4 Store: `loadCompanySettings`

| | |
|--|--|
| **File** | `src/store/index.ts` → `useSettingsStore` |
| **Function** | `loadCompanySettings` |
| **SQL** | Via `getCompanySettings()` only |
| **When** | `App.tsx` init when `user && !authLoading`; `DocumentBuilderPage` mount; Settings page uses store |
| **On failure** | Falls back to `localStorage.getItem('companySettings')` — **client only**, no DB delete |
| **Overwrite risk** | None on DB (read path) |

### 2.5 Store: `updateCompanySettings`

| | |
|--|--|
| **File** | `src/store/index.ts` |
| **Function** | `updateCompanySettings(newSettings)` |
| **SQL** | Builds partial `supabaseSettings` (only keys present on patch) → `updateCompanySettings` service |
| **When** | Settings auto-save, manual save, logo upload/remove, tax changes, ProfileSetup submit |
| **On Supabase error** | Merges into Zustand + **`localStorage.setItem('companySettings', ...)`** — does **not** delete DB row |
| **Overwrite risk** | **Medium–High** for debounced text save (see §7) |

**Callers (non-exhaustive):**

| Caller | Payload pattern |
|--------|-----------------|
| `Settings.tsx` `debouncedSave` | Full `localCompanySettings` + formatted address (all keys set) |
| `Settings.tsx` `forceSaveChanges` | Same full object |
| `Settings.tsx` `handleCompanyImmediateChange` | Single field patch |
| `Settings.tsx` `handleLogoUpload` | `logoUrl`, `logoPath`, `logo` |
| `Settings.tsx` `handleRemoveLogo` | `logo`, `logoUrl`, `logoPath` → `null` |
| `ProfileSetup.tsx` | `{ ...companySettings, ...formData }` |
| Tax / other Settings handlers | Partial tax fields |

### 2.6 `migrateFromLocalStorage`

| | |
|--|--|
| **File** | `src/services/companySettingsService.ts` |
| **Function** | `migrateFromLocalStorage()` |
| **When** | `App.tsx` → `migrateSettings()` after login (skipped on Capacitor webview) |
| **Guard** | If `getCompanySettings()` returns row with **`id`**, returns early — **no write** |
| **Write** | If no DB row and `localStorage.companySettings` exists → `saveCompanySettings` from parsed JSON |
| **Overwrite risk** | Can **insert** a row with **empty strings** if localStorage has empty/partial JSON; does not truncate table |

### 2.7 Edge / SQL (read-only)

| Location | Operation |
|----------|-----------|
| `supabase/functions/client-project-portal/index.ts` | `SELECT` company_name, email, phone, logo_url |
| `20260617000000_change_order_public_context.sql` | `SELECT * FROM company_settings WHERE user_id = owner_id` inside SECURITY DEFINER function |

**No app writes** from edge functions or that RPC.

---

## 3. All delete paths

### Application code

| File | Function | SQL | Called from app? |
|------|----------|-----|----------------|
| `src/services/companySettingsService.ts` | `deleteCompanySettings()` | `.from('company_settings').delete().eq('user_id', user.id)` | **No** — definition only; **zero references** in `src/` |

**Grep result:** `deleteCompanySettings` appears only in `companySettingsService.ts`.

### Storage (related, not table row)

| File | Action |
|------|--------|
| `storageService.deleteLogo(path)` | `storage.from('logos').remove([path])` — logo file only |
| `deleteCompanySettings()` | Also removes logo from storage if `logoPath` set |

### Migrations / scripts

| Item | Deletes `company_settings`? |
|------|----------------------------|
| Applied migrations under `calc/supabase/migrations/` | **No** `DROP TABLE` / `TRUNCATE` on `company_settings` |
| `calc/.bolt/supabase_discarded_migrations/*` | Drops legacy `users`/`projects` — **not** `company_settings` (not applied unless manually run) |
| `package.json` scripts | **No** `supabase db reset`, `db push`, or seed commands |
| `supabase/config.toml` `[db.seed]` | References `./seed.sql` — **file not present** in repo |

### Conclusion

**No production code path routinely deletes `company_settings` rows.** The only programmatic DELETE is unused `deleteCompanySettings()`.

---

## 4. Auth / logout behavior

| Component | Behavior re `company_settings` |
|-----------|-------------------------------|
| `AuthContext.tsx` `signOut` | `supabase.auth.signOut()` + `clearStaleAuthSession()` → **local** session clear; sets `user`/`profile` null |
| `authSession.ts` `clearStaleAuthSession` | `signOut({ scope: 'local' })` only |
| `onAuthStateChange` `SIGNED_OUT` | Clears React auth state only |
| Zustand `useSettingsStore` | **No reset** on logout — in-memory `companySettings` may remain until reload |
| `localStorage` `companySettings` | **Not cleared** on logout (no `removeItem` in auth flow) |

**Does not:** call `deleteCompanySettings`, Supabase table delete, or `localStorage.clear()`.

### CASCADE if `auth.users` row deleted

Because `user_id REFERENCES auth.users(id) ON DELETE CASCADE`:

- Deleting a user in Supabase Auth (dashboard or admin API) **deletes** that user’s `company_settings` row.
- If the project had **only one user**, the table would appear **empty** after user deletion.

**Does not change `user_id`** on logout or token refresh.

---

## 5. Environment check

### How the app connects

| Variable | Used in |
|----------|---------|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` (all client DB access) |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` |

Client is created at module load; missing vars throw at startup.

### Local `.env.local` (audit extraction — project ref only)

| Source | Project ref |
|--------|-------------|
| `calc/.env.local` → `VITE_SUPABASE_URL` | **`bhxbxcexssolsdgvgxjz`** (hostname pattern `https://<ref>.supabase.co`) |

### Production / Netlify

| Source | Finding |
|--------|---------|
| `calc/netlify.toml` | Build command only — **no** `VITE_SUPABASE_*` values committed |
| Production URL | Must be set in **Netlify environment variables** (not in repo) |

### Local Supabase CLI vs cloud

| Source | Value |
|--------|--------|
| `calc/supabase/config.toml` `project_id` | `"calc"` (CLI local project name) |
| Dev app with `.env.local` | Points at **cloud** project `bhxbxcexssolsdgvgxjz`, not `127.0.0.1:54321` unless `.env.local` is changed |

**Risk:** Data verified “last night” in **Supabase Studio project A** while the app today uses **project B**, or Studio was on **local** DB while the app uses **cloud** (or vice versa). That presents as “table empty” with no application DELETE.

**Action for operator:** In dashboard → Project Settings, confirm project ref matches `bhxbxcexssolsdgvgxjz` (or whatever `.env.local` / Netlify use).

---

## 6. Migration / reset risk

| Risk | Severity | Notes |
|------|----------|--------|
| `supabase db reset` (manual CLI) | **Critical** if run against the same DB you inspected | Wipes public schema data; not in npm scripts |
| Dashboard “truncate” / delete all rows | **Critical** | Outside codebase |
| Migrations re-run on empty DB | Creates empty table, not delete mid-flight | `CREATE TABLE IF NOT EXISTS` |
| Seed `seed.sql` | **Low** in repo | Referenced in config but **missing**; no seed SQL for company_settings found |
| Discarded `.bolt` migrations | **Low** unless manually applied | Do not touch `company_settings` |

---

## 7. Root cause candidates (ranked)

### Critical

1. **Wrong Supabase project or local vs cloud mismatch**  
   Table empty in project B while data was saved to project A. Strong given CLI `project_id = "calc"` vs `.env.local` cloud ref `bhxbxcexssolsdgvgxjz`.

2. **Database reset / manual truncate**  
   `supabase db reset`, branch reset, or SQL `TRUNCATE` / `DELETE FROM company_settings` in dashboard — explains **zero rows** for all users.

3. **`auth.users` deleted (CASCADE)**  
   Removing the auth user removes the `company_settings` row. Single-user projects → table looks empty.

### High

4. **Auto-save overwriting row with empty strings** (row may still exist)  
   - `Settings.tsx` initializes local state when `companyName !== undefined` — **true for default `''`** before load completes.  
   - Debounced auto-save sends **full** local object to `updateCompanySettings`.  
   - Service merge: `{ ...dbRow, ...emptyLocal }` → **blank columns**.  
   User may describe this as “data deleted” even if one row remains.

5. **`migrateFromLocalStorage` inserting empty profile**  
   If no DB `id` yet and localStorage has `{}` or stale empty object, upsert creates an **empty row**.

### Medium

6. **Supabase update failure + localStorage fallback**  
   UI shows merged local state; DB unchanged or prior state — confusing, not table-wide empty.

7. **RLS + wrong user session**  
   App sees no row (PGRST116); dashboard with service role still shows rows. Unlikely if operator says table is literally empty in SQL editor.

### Low

8. **`deleteCompanySettings()`**  
   Implemented but **uncalled** — only risk if invoked from console/custom script.

9. **Logo delete path**  
   Sets `logo_url` / `logo_path` to `null` only — does not remove row.

10. **Unused-import / unrelated refactors** | N/A to data loss |

---

## 8. Recommended fix plan (do not implement yet)

### Immediate operator checks (no code)

1. Confirm **project ref** in Supabase dashboard matches `VITE_SUPABASE_URL` in `.env.local` and Netlify (`bhxbxcexssolsdgvgxjz` from local audit).
2. In SQL editor: `SELECT count(*) FROM company_settings;` and `SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 5;`
3. Check **Auth → Users** for deleted users / new sign-up with different UUID.
4. Review **Supabase logs** / team actions for reset, branch merge, or truncate.
5. Enable **Point-in-Time Recovery** / backup restore if available on plan.

### Safest code hardening (future PR)

1. **Gate writes until load completes**  
   `settingsHydrated` flag; block `debouncedSave` / `updateCompanySettings` until `loadCompanySettings` succeeds once per session.

2. **Fix Settings init guard**  
   Initialize local form only when `companySettings.id` exists (or `loading === false` after successful load), not `companyName !== undefined`.

3. **Never merge empty strings over non-empty DB fields**  
   In `updateCompanySettings` service: skip keys where `updates[key] === ''` and `current[key]` is non-empty unless explicit “clear field” intent.

4. **Use `.maybeSingle()`** on read for clearer “no row” handling (optional).

5. **Remove or guard `deleteCompanySettings`**  
   Delete export or restrict to explicit “Delete my business profile” with confirmation; audit-log.

6. **Post-save verification**  
   After upsert, `select` row and compare critical fields; toast on unexpected empty snapshot.

7. **Environment guard in dev**  
   Log Supabase project ref once at startup (ref only, not keys) to reduce Studio mismatch.

8. **Backup / audit column** (schema change — only if approved)  
   `updated_by`, `last_known_good` JSON — lower priority.

### Do not do first

- Blind `db reset` or re-seed on production.
- Re-run migrations without backup.
- Assume bug is logo delete or Contract Builder prefill (those paths do not DELETE rows).

---

## Appendix A — Search index (exact terms)

| Term | Finding |
|------|---------|
| `company_settings` | Service, migrations, edge function SELECT, RPC SELECT |
| `deleteCompany` | `deleteCompanySettings` only |
| `clearCompany` | None |
| `saveCompanySettings` | `companySettingsService.ts` |
| `loadCompanySettings` | `store/index.ts`, `App.tsx`, `Settings.tsx` |
| `resetStore` / `clearStore` | None for settings store |
| `signOut` | Auth only; no DB delete |
| `onAuthStateChange` | Session state only |
| `setCompanySettings` | Zustand `set({ companySettings })` only |

---

## Appendix B — `useAuth` / hooks

`src/hooks/useAuth.ts` re-exports `AuthContext` only — no extra delete logic.

---

*End of read-only audit. No repository files were modified.*
