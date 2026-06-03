# Phase 5E — QC Report Professional Document Renderer Report

## Summary

Professional QC Report preview and PDF export are wired into the Contract & Document Builder using Phase 5A shared paper components. Selecting **QC Report** (`GENERIC_QC_REPORT`) shows a white-paper field quality-control layout. Saved drafts route to **Project → Documents → QC Reports**. Change Order, RFI, Submittal, Daily Report, and Residential Contract previews are unchanged.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/packs/qcReport/questions.ts` | Intake bank (quick / standard / advanced) |
| `src/features/documents/packs/qcReport/template.ts` | Minimal `GENERIC_QC_REPORT_TEMPLATE` |
| `src/features/documents/packs/qcReport/clauses.ts` | Empty clause list |
| `src/features/documents/packs/qcReport/index.ts` | `GENERIC_QC_REPORT_PACK` metadata |
| `src/features/documents/ui/renderers/QcReportDocument.tsx` | QC Report paper renderer (10 sections, conditional concrete/testing) |
| `src/features/documents/ui/adapters/qcReportPreviewAdapter.ts` | Maps answers + project + company → `QcReportDocumentView` |
| `src/features/documents/ui/adapters/qcReportPreviewAdapter.test.ts` | Adapter smoke test |
| `src/features/documents/ui/pdf/qcReportPdf.ts` | Draft PDF export via jsPDF |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/types.ts` | Added `qc_report` to `DocumentType` union |
| `src/features/documents/packs/registry.ts` | Registered `GENERIC_QC_REPORT` catalog |
| `src/features/documents/registry/questionnaireRegistry.ts` | Registered `qc_report` question bank |
| `src/features/documents/registry/documentTypeRegistry.ts` | `qc_report` runtime-supported type |
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | QC Report branch after Daily Report |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Pack routing, title sync, PDF export, project save gate, hide contract title |
| `src/services/projectDocumentDisplay.ts` | `PACK_TO_TYPE`, `DEFAULT_PACK_BY_DOCUMENT_TYPE`, explicit `qc_report` meta |
| `src/services/projectDocumentDisplay.test.ts` | QC pack routing test |
| `src/services/projectDocumentSnapshots.ts` | `qc_report` document number extraction |
| `src/services/projectDocumentService.ts` | `BuilderDocumentType` + label for `qc_report` |
| `src/pages/planner/PlannerDocumentsPage.tsx` | “New QC report” button, empty state copy |

**Not changed:** Supabase schema/RLS, document engine core, CO/RFI/Submittal/Daily/Residential renderer files, planner route definitions, concrete inspection checklist DB logic.

---

## Pack metadata

| Field | Value |
|-------|--------|
| `packKey` | `GENERIC_QC_REPORT` |
| `label` | QC Report |
| `documentType` | `qc_report` |
| `status` | `draft_only` |
| `finalExportAllowed` | `true` |
| `templateKey` | `GENERIC_QC_REPORT_TEMPLATE` |

---

## Adapter mapping

| Answer key | View field | Notes |
|------------|------------|-------|
| `reportNumber` | `documentNumber` | Fallback `Draft` |
| `reportDate` / `documentDate` | `generatedDate` | Formatted with `date-fns` |
| `overallStatus` / `status` | `status` | Select labels; default `Draft` |
| `preparedBy` | `preparedBy`, `signaturePreparedBy` | In `projectRows` |
| `inspectionType` | `inspectionType` | Select labels |
| `inspectionLocation` | `inspectionLocation` | |
| `specificationReference` | `specificationReference` | |
| `drawingReference` | `drawingReference` | |
| `workInspected` | `workInspected` | |
| `inspectionMethod` | `inspectionMethod` | |
| `acceptanceCriteria` | `acceptanceCriteria` | |
| `observations` | `observations` | |
| `summary` | `summary` | |
| `qcNotes` | `qcNotes` | |
| `deficiencies` … `reinspectionDate` | same | Deficiency section |
| Concrete QC fields | same | Shown when any value present |
| `testType` … `sampleNumbers` | same | Testing section |
| `inspectorName` … `ownerRepresentative` | same | Inspector section |
| `photos`, `attachments`, `attachmentNotes` | same | |
| `reviewedBy` | `reviewedBy`, `signatureReviewedBy` | |
| `signatureDate` | `signatureDate` | Falls back to report date |

**Title:** `title` state, or `QC Report — {reportNumber} — {inspectionType}`, or date/project fallbacks, or `QC Report`.

**Project / company (fallback only):** project name, address, owner/client, contractor header from `selectedProject` / `companySettings`.

All strings through `cleanDocumentBody` + `displayValue()` → `—` for empty values.

---

## Preview router change

In `DocumentPreviewRouter.tsx`, after Daily Report and before Residential:

- `isQcReport` when `documentType === 'qc_report'` or `packKey === 'GENERIC_QC_REPORT'`
- `buildQcReportPreviewFromDocumentAnswers` → `<QcReportDocument view={…} />`
- Historical `previewVersion` still uses generic `PreviewPanel`

CO, RFI, Submittal, Daily Report, and Residential branches are unchanged in ordering and logic.

---

## PDF export routing

In `DocumentBuilderPage.handleExport`:

- `isQcReportDocument` → `buildQcReportPreviewFromDocumentAnswers` → `generateQcReportPDF`
- Filename: `QC-REPORT-{reportNumber or generatedDate}.pdf`
- Footer: `Generated by Concrete Calc · Page N of M`

CO, RFI, Submittal, Daily Report, and Residential PDF paths are untouched.

---

## Project document routing / grouping

| Effective type / pack | Planner location |
|----------------------|------------------|
| `qc_report` | Documents → **QC Reports** |
| `inspection_report` | Documents → **QC Reports** (via `QC_TYPES`) |
| `GENERIC_QC_REPORT` pack | Resolves to `qc_report` even if `document_type` drifts |

Excluded from Change Orders, RFIs, and FARs via `isDocumentsTabBuilderDocument`.

**Planner:** “New QC report” opens `/tools/contract-builder?project=…&packKey=GENERIC_QC_REPORT&documentType=qc_report`.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **211 passed** (31 files), including `qcReportPreviewAdapter.test.ts` and QC routing test |
| `npm run build` | **Success** |
| `npx tsc -p tsconfig.app.json --noEmit` | **Exit 2** — pre-existing project-wide type debt; **no matches** in QC Report file paths |

---

## Known limitations

- No link between builder QC Report drafts and existing **Concrete Inspection Checklist** / `concreteInspectionService` records (future integration).
- `qc_inspection` remains a separate `DocumentType` value for future packs; this phase uses `qc_report` only.
- Photo/attachment fields are text references, not file uploads in the builder.

---

## Regression confirmation

- Change Order preview/PDF: unchanged  
- RFI preview/PDF: unchanged  
- Submittal preview/PDF: unchanged  
- Daily Report preview/PDF: unchanged  
- Residential Contract preview/PDF: unchanged  
- Pack dropdown: single **QC Report** entry via `GENERIC_QC_REPORT` pack only  
- Saved Daily Reports / Submittals: still route to correct Documents sections  

---

## Manual acceptance checklist

1. Open Contract & Document Builder → select **QC Report** pack.  
2. Select a project → confirm project/company info in preview.  
3. Fill quick + standard + advanced fields → live preview updates.  
4. Save draft → appears under **Documents → QC Reports** only.  
5. Reopen → fields restore; Export PDF → paper style; dark mode preview stays readable.  
6. Confirm CO / RFI / Submittal / Daily / Residential still behave as before.
