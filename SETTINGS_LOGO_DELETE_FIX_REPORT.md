# Settings Logo Delete Fix

**Date:** 2026-06-03

## Bug

In **Settings → Company Information**, the red delete button on the company logo did not persist removal. The preview could disappear briefly, but after refresh the logo returned because `logo_url` / `logo_path` were not reliably cleared in Supabase.

## Root cause

1. **Store patch mapping** — `updateCompanySettings` always forwarded every field to the service, including `undefined` values. Partial updates (e.g. logo-only delete) could overwrite merged settings incorrectly, and `logoUrl: newSettings.logoUrl || newSettings.logo` treated `null` as falsy when paired with an omitted sibling field, producing `undefined` instead of `null` so the DB column was not cleared.
2. **Upsert payload** — `logo_url` / `logo_path` now explicitly use `?? null` when saving.

## Fix

### `src/store/index.ts`

- Build `supabaseSettings` from **only defined / intentionally cleared** fields.
- Logo removal uses `'logoUrl' in newSettings || 'logo' in newSettings` with `?? null` so `null` is sent to Supabase.

### `src/services/companySettingsService.ts`

- `logo_url` and `logo_path` written as `settings.logoUrl ?? null` and `settings.logoPath ?? null`.

### `src/pages/Settings.tsx`

- `handleRemoveLogo`:
  - Attempts storage delete via `deleteLogo(path)` when `logoPath` exists; storage failure is logged and does **not** block DB clear.
  - Calls `updateCompanySettings({ logo: null, logoUrl: null, logoPath: null })`.
  - Clears file input.
  - Toast: **"Company logo removed"** / **"Could not remove company logo"**.
  - `isRemovingLogo` disables the delete button while in flight.

## Behavior (unchanged schema)

| Step | Behavior |
|------|----------|
| Delete click | Clears Zustand `companySettings` logo fields after successful save |
| Supabase | `company_settings.logo_url` and `logo_path` set to `null` |
| Storage | Removes file when `logo_path` is present (`logos` bucket); non-fatal if storage fails |

## Manual acceptance

1. Upload logo → save → refresh → logo visible.
2. Click delete → logo disappears immediately.
3. Refresh → logo stays removed.
4. Confirm `company_settings.logo_url` / `logo_path` are null in Supabase.

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 27 files, 196 tests |
| `npm run build` | **PASS** |

## Files changed

- `src/pages/Settings.tsx`
- `src/store/index.ts`
- `src/services/companySettingsService.ts`

## Limitation

If storage delete fails (permissions, missing object), the DB reference is still cleared. Orphaned files in the `logos` bucket may remain until manual cleanup or a future storage-gc task.
