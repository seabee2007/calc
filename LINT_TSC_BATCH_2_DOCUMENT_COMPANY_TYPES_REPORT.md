# LINT / TYPESCRIPT CLEANUP — BATCH 2 DOCUMENT + COMPANY SETTINGS TYPE CONTRACTS REPORT
## Scope
This batch focused on document/company-settings type-contract drift between `DocumentBuilderPage`, preview adapters, PDF exporters, and document service boundaries.
The work kept DB schema and stored snapshot shape intact while normalizing document-rendering company settings at explicit boundaries.

## Files changed
- `src/features/documents/ui/documentCompanySettings.ts` (new)
- `src/features/documents/ui/DocumentBuilderPage.tsx`
- `src/features/documents/ui/panels/DocumentPreviewRouter.tsx`
- `src/features/documents/ui/adapters/changeOrderPreviewAdapter.ts`
- `src/features/documents/ui/adapters/rfiPreviewAdapter.ts`
- `src/features/documents/ui/adapters/farPreviewAdapter.ts`
- `src/features/documents/ui/adapters/submittalPreviewAdapter.ts`
- `src/features/documents/ui/adapters/dailyReportPreviewAdapter.ts`
- `src/features/documents/ui/adapters/qcReportPreviewAdapter.ts`
- `src/features/documents/ui/adapters/warrantyCloseoutPreviewAdapter.ts`
- `src/features/documents/ui/adapters/punchListPreviewAdapter.ts`
- `src/features/documents/ui/adapters/farPreviewAdapter.test.ts`
- `src/features/documents/ui/adapters/punchListPreviewAdapter.test.ts`
- `src/features/documents/ui/adapters/qcReportPreviewAdapter.test.ts`
- `src/features/documents/ui/adapters/warrantyCloseoutPreviewAdapter.test.ts`
- `src/features/documents/ui/pdf/rfiPdf.ts`
- `src/features/documents/ui/pdf/farPdf.ts`
- `src/features/documents/ui/renderers/residentialContractContext.ts`
- `src/features/documents/ui/renderers/ResidentialContractDocument.tsx`
- `src/services/projectDocumentService.ts`
- `src/services/projectDocumentSnapshots.ts`
- `src/services/exportProjectDocumentPdf.ts`
- `src/utils/changeOrderDocumentContext.ts`

## Issue fixed per file
- `src/features/documents/ui/documentCompanySettings.ts`
  - Added shared `DocumentCompanySettings` normalization helper (`normalizeCompanySettingsForDocument`) with stable string/tax defaults and `logoUrl` handling.
- `src/features/documents/ui/DocumentBuilderPage.tsx`
  - Normalized settings once and propagated normalized shape through preview/export/save boundaries.
  - Updated save payload to use normalized company settings.
  - Updated preview router props to use normalized company settings.
  - Fixed ResizeObserver nullability typing in preview toggle layout effect.
- `src/features/documents/ui/panels/DocumentPreviewRouter.tsx`
  - Continued typed propagation of normalized `DocumentCompanySettings` into all document adapters/renderers.
- `src/features/documents/ui/adapters/*.ts` (change order, RFI, FAR, submittal, daily report, QC report, warranty/closeout, punch list)
  - Replaced ad-hoc `Pick<CompanySettings> & { logo? }` contracts with normalized `DocumentCompanySettings`.
  - Removed legacy `logo` fallback usage in favor of normalized `logoUrl`.
  - Preserved renderer data and display behavior.
- `src/features/documents/ui/pdf/rfiPdf.ts` and `src/features/documents/ui/pdf/farPdf.ts`
  - Relaxed info-box row typing to accept optional/null row values safely.
  - Added internal `'—'` fallback at render boundary to satisfy strict typing without layout changes.
- `src/features/documents/ui/renderers/residentialContractContext.ts`
  - Switched to normalized company settings source input and normalized at context boundary.
  - Removed legacy logo alias dependency.
- `src/features/documents/ui/renderers/ResidentialContractDocument.tsx`
  - Updated prop contract to normalized `DocumentCompanySettings`.
- `src/services/projectDocumentService.ts`
  - Updated draft/workflow service payload contracts to accept normalized company settings source type.
  - Removed cast to full DB `CompanySettings` where not needed.
- `src/services/projectDocumentSnapshots.ts`
  - Removed unsafe cast to `CompanySettings`.
  - Returned typed minimal document company settings source from snapshot reconstruction.
  - Updated snapshot builder input contract to normalized source type.
- `src/services/exportProjectDocumentPdf.ts`
  - Added normalization boundary for merged runtime/snapshot company settings.
  - Removed invalid `companySettings.logo` usage.
  - Passed normalized settings consistently to adapters and contract PDF export.
- `src/utils/changeOrderDocumentContext.ts`
  - Updated context builder input to normalized settings source and normalized internally.
  - Removed legacy logo alias dependency.
- Adapter tests (`far`, `punch list`, `QC`, `warranty/closeout`)
  - Updated fixtures to satisfy normalized company settings contract and union typing.

## Validation results
## Targeted validation
- Targeted ESLint on touched Batch 2 files:
  - Result: pass (0 errors), 3 warnings in `DocumentBuilderPage.tsx` (`react-hooks/exhaustive-deps`, pre-existing).
- Targeted TypeScript check for touched Batch 2 paths:
  - Result: no remaining diagnostics in the Batch 2 document/company-settings cluster.

## Full validation
- `npm run lint`
  - Result: fails (existing repo-wide lint backlog).
  - Before Batch 2: 213 findings total.
  - After Batch 2: 213 findings total (`ESLINT_ERRORS=170`, `ESLINT_WARNINGS=43`).
  - Net: no regression, no global lint reduction in this batch.
- `npx tsc --noEmit -p tsconfig.app.json`
  - Result: fails (existing repo-wide type backlog).
  - Before Batch 2: 241 errors.
  - After Batch 2: 223 errors.
  - Net: -18 TypeScript errors.
- `npm test`
  - Result: pass.
  - 43 test files passed, 264 tests passed.
- `npm run build`
  - Result: pass.
  - Vite production build completed successfully; PWA assets generated.

## Remaining top errors
- TypeScript (`tsconfig.app.json`) still dominated by:
  - `TS6133` unused declarations/imports in multiple non-Batch-2 modules.
  - `TS2322` / `TS2345` assignment mismatches in planner/navigation/scheduling areas outside this batch.
- ESLint backlog still dominated by:
  - `no-unused-vars`
  - `@typescript-eslint/no-explicit-any`
  - hook dependency warnings in several existing components.

## Constraint check
- No DB schema changes made.
- No saved document snapshot schema change made.
- No `any` added to bypass the targeted issues.
- No `ts-ignore` added.
- No intentional PDF layout redesign; changes were type-safety boundary/fallback fixes.

## Recommendation for next batch
- Focus next on non-document global backlog with small, safe batches:
  - Resolve high-volume `TS6133` / `no-unused-vars` first for quick count reduction.
  - Then address cross-module `TS2322` / `TS2345` hotspots in planner routes/drawers and lazy-page typing.
  - Keep document company-settings boundary as-is to prevent contract drift from recurring.
