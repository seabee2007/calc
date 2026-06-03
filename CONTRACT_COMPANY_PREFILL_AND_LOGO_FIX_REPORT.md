# Contract Builder Company Prefill + Logo Size Fix

**Date:** 2026-06-03

## Issues addressed

1. Residential contract paper preview logo was too small.
2. Contract Builder contractor fields did not prefill from saved company settings (especially without a project selected).
3. Preview should show company name, logo, phone, email, license, and address when available.

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/ui/components/documentHeaderTheme.ts` | **New** — shared preview/PDF logo sizing constants |
| `src/features/documents/ui/components/ProfessionalDocumentShell.tsx` | Larger logo class (RFI/CO shell) |
| `src/features/documents/ui/renderers/ResidentialContractDocument.tsx` | Larger logo class |
| `src/features/documents/ui/contractPdf.ts` | Logo in PDF header; `logoUrl` on export header type |
| `src/features/documents/ui/contractPrefill.ts` | `mapCompanySettingsToContractPrefillSource`, `companyPrefillFingerprint` |
| `src/features/documents/ui/contractPrefill.test.ts` | Company prefill + fingerprint tests |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Company-only prefill, settings load, export logo |

## 1. Logo size change

**Preview (shared):**

```text
className: h-14 max-h-16 max-w-[120px] w-auto object-contain
```

- Height ~56px (`h-14`), cap 64px (`max-h-16`)
- Max width 120px
- `object-contain` — no stretch

**PDF (residential contract export):**

- `48 × 18` mm via `DOCUMENT_HEADER_LOGO_PDF_MM` (up from change-order’s 40×16)
- Best-effort `doc.addImage`; skipped if image cannot load (CORS/format)

**Unchanged:** `DocumentSignatureBlock` signature images (separate from header logo).

## 2. Company settings → contractor prefill mapping

| Company settings (`company_settings` / store) | Contract answer key |
|-----------------------------------------------|---------------------|
| `companyName` | `contractorLegalName` |
| `email` | `contractorEmail` |
| `phone` | `contractorPhone` (formatted US) |
| `licenseNumber` | `contractorLicenseNumber` |
| `address` (single formatted string from Settings) | `contractorAddressStreet/Street2/City/State/Zip` via `parseLegacyUSAddress` |

**Note:** Settings stores one formatted `address` string (not separate DB columns). Structured contractor address fields are parsed from that string; a fully split business address in Settings would require a future schema/UI enhancement.

## 3. Overwrite prevention (unchanged rule, now works for company)

- Prefill runs only into fields that are **blank** (`isBlank`) and **not** in `dirtyFields`.
- User edits mark fields dirty → values preserved.
- **Refresh from project** (`applyPrefill(true)`) still overwrites per existing behavior.
- Company prefill no longer requires a selected project.

## 4. Document Builder behavior fixes

- **`applyPrefill`** — Merges company + project prefill; project optional.
- **Prefill effect** — Runs on company settings fingerprint and on project/proposal/jobsite changes (`company:…` key when no project).
- **`loadCompanySettings()`** on Document Builder mount so saved profile is available after navigation.
- **PDF export** — Passes `logoUrl` from store into `exportContractDraftPdf`.

## 5. Preview company data

`buildResidentialContractDisplayContext` already falls back to `companySettings` for header block (name, logo, phone, email, license, address). With prefill + settings load, form answers and header stay aligned.

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 27 files, **198** tests (+2 company prefill tests) |
| `npm run build` | **PASS** |
| `npx tsc -p tsconfig.app.json --noEmit` | **251** errors (unchanged band; no new regressions targeted) |

## Manual acceptance checklist

1. Settings → save company name, license, address, phone, email, logo.
2. Contract Builder → Generic Residential Contract.
3. Contractor fields prefilled (even before picking a project).
4. Preview shows larger logo + company contact block.
5. Edit a contractor field → value sticks.
6. Refresh → company settings still apply to empty fields only.

## Out of scope (per request)

- Supabase schema
- Document engine / clause text
- Change Order builder logic (shell logo size only via shared class)
- RFI renderer content (shell logo size only via shared class)
