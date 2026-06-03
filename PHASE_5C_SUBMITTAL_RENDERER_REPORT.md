# Phase 5C — Submittal Cover Sheet Professional Renderer Report

## Summary

Professional Submittal Cover Sheet preview and PDF export are wired into the Contract & Document Builder using Phase 5A shared paper components. Selecting **Submittal Cover Sheet** (`GENERIC_SUBMITTAL`) shows a white-paper submittal layout; Change Order, RFI, and Residential Contract previews are unchanged.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/ui/renderers/SubmittalDocument.tsx` | Submittal paper renderer (8 sections) |
| `src/features/documents/ui/adapters/submittalPreviewAdapter.ts` | Maps answers + project + company → `SubmittalDocumentView` |
| `src/features/documents/ui/pdf/submittalPdf.ts` | Draft PDF export via jsPDF |
| `src/features/documents/packs/submittal/questions.ts` | Document Builder intake (quick / standard / advanced) |
| `src/features/documents/packs/submittal/template.ts` | Minimal template (renderer owns layout) |
| `src/features/documents/packs/submittal/clauses.ts` | Empty clause list |
| `src/features/documents/packs/submittal/index.ts` | `GENERIC_SUBMITTAL_PACK` metadata |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | Submittal branch → `SubmittalDocument` in `PaperPreviewShell` |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | `GENERIC_SUBMITTAL` pack, title sync, submittal PDF export, meta panel hide contract title |
| `src/features/documents/packs/registry.ts` | Register `GENERIC_SUBMITTAL` catalog |
| `src/features/documents/registry/questionnaireRegistry.ts` | Register `submittal` question bank |
| `src/features/documents/registry/documentTypeRegistry.ts` | `submittal` runtime-supported type |

---

## Pack metadata

| Field | Value |
|-------|--------|
| `packKey` | `GENERIC_SUBMITTAL` |
| `label` | Submittal Cover Sheet |
| `documentType` | `submittal` |
| `status` | `draft_only` |
| `attorneyReviewed` | `false` |
| `finalExportAllowed` | `true` |
| `templateKey` | `GENERIC_SUBMITTAL_TEMPLATE` |

---

## Adapter mapping

| Answer key | View field | Notes |
|------------|------------|-------|
| `submittalNumber` | `documentNumber` | Fallback `Draft` |
| `submittalTitle` / `title` / builder `title` | `documentTitle` | Fallback `Submittal Cover Sheet` |
| `status` | `status` | Select labels resolved; default `Draft` |
| `submittalDate` / `documentDate` | `generatedDate` | Formatted or passthrough |
| `specSection` | `specSection` | |
| `productData` | `productData` + `attachmentProductData` | |
| `shopDrawings` | `shopDrawings` + `attachmentShopDrawings` | |
| `samples` | `samples` + `attachmentSamples` | |
| `manufacturer` | `manufacturer` | |
| `supplier` | `supplier` | |
| `reviewer` | `reviewer` | |
| `submittedBy` | `submittedBy`, `signatureSubmittedBy` | |
| `submittedTo` | `submittedTo` | |
| `dueDate` | `dueDate` | Hidden in UI when `—` |
| `reviewStatus` | `reviewStatus` | Select labels resolved |
| `reviewerComments` | `reviewerComments` | |
| `contractorStatement` | `contractorStatement` | Default conformance text if blank |
| `attachments` | `attachmentOther` | |
| `certifications` | `attachmentCertifications` | |
| `relatedRfi` / `relatedChangeOrder` | `references` | Combined `RFI: … · Change Order: …` |
| `reviewedBy` | `signatureReviewedBy` | Falls back to `reviewer` |
| `signatureDate` | `signatureDate` | |

**Project / company (fallback only):**

- Project name, address, owner/client from `selectedProject`
- Contractor from `companySettings.companyName`
- Company header: logo, address, phone, email, license

All string fields pass through `cleanDocumentBody` + `displayValue()` — no raw `undefined`, `null`, or placeholder tokens.

---

## Preview router change

```typescript
const isSubmittal = documentType === 'submittal' || packKey === 'GENERIC_SUBMITTAL';

// After change_order and RFI branches:
if (submittalPreview) {
  return (
    <PaperPreviewShell>
      <SubmittalDocument view={submittalPreview} />
    </PaperPreviewShell>
  );
}
```

- Change Order, RFI, and Residential branches unchanged
- Historical `previewVersion` still uses generic `PreviewPanel`

---

## PDF export routing

`DocumentBuilderPage.handleExport`:

- `change_order` → `generateChangeOrderPDF` (unchanged)
- `rfi` → `generateRfiPDF` (unchanged)
- `submittal` → `buildSubmittalPreviewFromDocumentAnswers` + `generateSubmittalPDF`
- else → `exportContractDraftPdf` (residential, unchanged)

Filename pattern: `SUBMITTAL-{documentNumber}.pdf`

---

## How to test in Document Builder

1. Open Contract & Document Builder
2. Select pack **Submittal Cover Sheet**
3. Choose a project (recommended for address/client/contractor fallbacks)
4. Fill submittal fields (at minimum **Submittal title**)
5. Confirm live paper preview updates
6. **Draft PDF** exports submittal layout

**Regression:** Change Order, RFI, and Residential packs still use their dedicated previews; pack dropdown shows one **Submittal Cover Sheet** entry (label matches `pack.label` and `templateLabel` override).

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 28 files, 203 tests |
| `npm run build` | **Pass** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing repo drift (~251 errors); **no errors in Phase 5C files** |

---

## Known limitations

1. **Empty submittal template/clauses** — Assembly produces no clause sections; preview is entirely from `SubmittalDocument`, not generic clause list.
2. **Draft-only pack** — Same posture as RFI; no attorney-reviewed export path.
3. **Saved version preview** — Selecting a historical version still uses `PreviewPanel`, not the professional submittal renderer.
4. **Signatures** — Preview blocks are read-only (no canvas capture in builder).
5. **Attachment fields** — Text references only; no file thumbnails in preview/PDF.
6. **Compliance profile** — Submittal uses default residential compliance fallback until a dedicated profile is added (optional follow-up).
7. **RFI not in documentTypeRegistry** — Submittal was added per spec; RFI remains pack-only registration.

---

## Out of scope (unchanged)

- Supabase schema / RLS / auth
- Pricing math
- Change Order / Residential / RFI renderer behavior
- Document engine core assembly logic
- Planner routes
