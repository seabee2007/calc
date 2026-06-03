# Company Settings Blanking Prevention

**Date:** 2026-06-03

## Problem confirmed

`public.company_settings` row remained, but text columns were overwritten with empty strings while logo and tax columns were preserved. That matches auto-save / merge sending default empty form values before hydration completed.

## Solution (no schema / RLS changes)

Three layers:

1. **Hydration gate** — no protected-text writes until `loadCompanySettings` finishes.
2. **Form init gate** — local Settings form fills only after `companySettingsHydrated`.
3. **Merge protection** — service merge blocks empty strings replacing non-empty protected fields unless explicitly allowed.

---

## Files changed

| File | Change |
|------|--------|
| `src/services/companySettingsMerge.ts` | **New** — protected field merge + patch helpers |
| `src/services/companySettingsMerge.test.ts` | **New** — unit tests (5 cases) |
| `src/services/companySettingsService.ts` | `updateCompanySettings` uses merge; exports options type |
| `src/store/index.ts` | `companySettingsHydrated`; skip pre-hydration text saves; pass options |
| `src/pages/Settings.tsx` | Hydration-gated form init, auto-save, manual save |
| `src/components/onboarding/ProfileSetup.tsx` | Intentional save: `allowEmptyTextOverwrite: true` |
| `src/components/onboarding/OnboardingFlow.tsx` | Same for onboarding completion |

---

## 1. Hydration guard

**Store:** `companySettingsHydrated`

- Starts `false`.
- Set `false` when `loadCompanySettings` starts.
- Set `true` after successful Supabase load **or** error fallback (localStorage / defaults known).

**`updateCompanySettings` (store):**

- If not hydrated and patch touches protected text (and is not logo/tax-only) → **return early** (no Supabase call).
- DEV log: `[companySettings] Save skipped: settings not hydrated yet`

**Settings page:**

- Debounced auto-save returns early if `!companySettingsHydrated` (DEV log).
- Manual `forceSaveChanges` / Save button skips if not hydrated (DEV log).

**Logo / tax:** Still allowed before hydration via `patchIsLogoOrTaxOnly` (store) and non-protected merge keys (service).

---

## 2. Local form initialization

**Before:** Initialized when `companyName !== undefined` — true for default empty store → triggered auto-save with blanks.

**After:** Initializes only when `companySettingsHydrated && !isLocalStateInitialized`.

- User edits update local state immediately.
- Auto-save debounce runs only if `companySettingsHydrated`.
- Business address changes use `handleBusinessAddressChange` (same guard).

---

## 3. Empty string overwrite protection

**Protected fields:**

- `companyName` → `company_name`
- `address`
- `phone`
- `email`
- `licenseNumber` → `license_number`
- `motto`

**`mergeCompanySettingsUpdates(current, updates, options)`:**

| `allowEmptyTextOverwrite` | Behavior |
|---------------------------|----------|
| `false` (default) | Empty string does **not** replace non-empty protected value |
| `true` | User may clear fields intentionally |

**Call sites:**

| Path | `allowEmptyTextOverwrite` |
|------|---------------------------|
| Settings debounced auto-save | `false` |
| Settings manual Save / `forceSaveChanges` | `true` |
| Logo upload / remove | N/A (logo fields, not protected) |
| Tax dropdowns / rate | N/A (tax fields) |
| Onboarding / ProfileSetup submit | `true` |

---

## 4. Logo exception

Unchanged behavior: `logo_url` / `logo_path` may be set to `null` on remove; not in protected text list.

---

## 5. Tax fields

`tax_system`, `tax_rate_percent`, `tax_application` are not protected; save normally at any time after hydration (or as logo/tax-only patch before hydration in store).

---

## 6. Dev logging

Only when `import.meta.env.DEV`:

- Store skip (not hydrated + protected text patch)
- Settings auto-save skip (not hydrated)
- Settings manual save skip (not hydrated)

No production console spam.

---

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 28 files, **203** tests (+5 merge tests) |
| `npm run build` | **PASS** |
| `npx tsc -p tsconfig.app.json --noEmit` | **251** errors (unchanged band; no new regressions targeted) |

---

## Manual test checklist

1. Put real company data in Supabase (`company_settings`).
2. Reload app — do not open Settings; confirm row text columns unchanged in SQL.
3. Open Settings — fields should match DB.
4. Edit one field — wait for auto-save — only that field should change in DB.
5. Refresh — all fields remain.
6. **Save** button with a field cleared — blank allowed (manual).
7. Delete logo — only `logo_url` / `logo_path` nulled; text columns preserved.

---

## Out of scope (unchanged)

- Supabase schema / RLS
- `deleteCompanySettings()` (still unused)
- `migrateFromLocalStorage` behavior
- Environment / project mismatch (see `COMPANY_SETTINGS_DATA_LOSS_AUDIT.md`)
