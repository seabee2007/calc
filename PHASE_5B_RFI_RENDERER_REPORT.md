# Phase 5B — RFI Professional Document Renderer Report

## Summary

Professional RFI preview and PDF export are wired into the Contract & Document Builder using Phase 5A shared paper components. Selecting **Generic RFI Pack** shows a white-paper RFI layout; Change Order and Residential Contract previews are unchanged.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/ui/renderers/RfiDocument.tsx` | RFI paper renderer (7 sections) |
| `src/features/documents/ui/adapters/rfiPreviewAdapter.ts` | Maps answers + project + company → `RfiDocumentView` |
| `src/features/documents/ui/pdf/rfiPdf.ts` | Draft PDF export via jsPDF |
| `src/features/documents/packs/rfi/questions.ts` | Document Builder intake fields |
| `src/features/documents/packs/rfi/template.ts` | Empty template (renderer owns layout) |
| `src/features/documents/packs/rfi/clauses.ts` | Empty clause list |
| `src/features/documents/packs/rfi/index.ts` | `GENERIC_RFI_PACK` metadata |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | RFI branch → `RfiDocument` in `PaperPreviewShell` |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | `GENERIC_RFI` pack, title sync, RFI PDF export |
| `src/features/documents/packs/registry.ts` | Register `GENERIC_RFI` catalog |
| `src/features/documents/registry/questionnaireRegistry.ts` | Register `rfi` question bank |

---

## Adapter mapping

| Answer key | Renderer field | Display |
|------------|----------------|---------|
| `rfiNumber` / `displayNumber` | `documentNumber` | Header box |
| `rfiTitle` / `title` / builder `title` | `documentTitle` | Shell `<h1>` |
| `status` | `status` | `DocumentStatusBadge` |
| `rfiDate` / `documentDate` | `generatedDate` | Header date |
| `question` | `question` | RFI Details |
| `drawingSpecReference` (+ `drawingReference` + `specReference`) | `drawingSpecReference` | Combined |
| `submittedBy` | `submittedBy` + signature submitted | |
| `submittedTo` | `submittedTo` | |
| `dueDate` | `dueDate` | Hidden row if `—` |
| `costImpact` | `costImpact` | Yes/No/text via `formatImpact` |
| `scheduleImpact` | `scheduleImpact` | |
| `response` | `response` | Response section |
| `respondedBy` | `respondedBy` | |
| `responseDate` | `responseDate` | |
| `attachmentDrawings` | `attachmentDrawings` | Attachments |
| `attachmentPhotos` | `attachmentPhotos` | |
| `attachmentSpecSections` | `attachmentSpecSections` | |
| `attachmentOtherReferences` | `attachmentOtherReferences` | |
| `reviewedBy` | `signatureReviewedBy` | Signature block |
| `signatureDate` | `signatureDate` | |

**Project / company (not from answers alone):**

- Project name, address (jobsite / client address), owner/client from `selectedProject.clientInfo`
- Contractor from `companySettings.companyName`
- Company header from `companySettings` (logo, address, phone, email, license)

All string fields pass through `cleanDocumentBody` + `displayValue()` — no raw `undefined`, `null`, or `[placeholder]` / `{{handlebars}}` tokens.

---

## Preview router change

```typescript
const isRfi = documentType === 'rfi' || packKey === 'GENERIC_RFI';

// After change_order branch:
if (rfiPreview) {
  return (
    <PaperPreviewShell>
      <RfiDocument view={rfiPreview} />
    </PaperPreviewShell>
  );
}
```

- Historical `previewVersion` still uses generic `PreviewPanel`
- Other unfinished types still use `PreviewPanel`

---

## PDF export

`DocumentBuilderPage.handleExport`:

- `change_order` → existing `generateChangeOrderPDF`
- `rfi` → `buildRfiPreviewFromDocumentAnswers` + `generateRfiPDF`
- else → existing `exportContractDraftPdf`

Filename pattern: `RFI-{documentNumber}.pdf`

---

## How to test in Document Builder

1. Open Contract & Document Builder
2. Select pack **Generic RFI Pack**
3. Choose a project (optional but recommended for address/client)
4. Fill RFI fields (at minimum **RFI title** and **Question**)
5. Open preview — white-paper RFI with company header and sections
6. **Draft PDF** exports RFI layout

---

## Validation results

| Command | Result |
|---------|--------|
| `npm run lint` | Repo-wide pre-existing issues; no new issues in Phase 5B files |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing repo drift |
| `npm test` | **Pass** — 27 files, 196 tests |
| `npm run build` | **Pass** |

---

## Known limitations

1. **Planner RFIs vs Document Builder** — Field Planner `rfi_requests` (Supabase) are not loaded into this preview; only Document Builder `answers` + selected project/company.
2. **Empty RFI pack template** — Assembly produces no clause sections; preview is entirely from `RfiDocument`, not generic clause list.
3. **Compliance / risk** — RFI pack uses draft-only posture; no attorney-reviewed export path.
4. **Signatures** — Preview blocks are read-only (no canvas capture in builder).
5. **Attachment fields** — Text references only; no file thumbnails in preview/PDF yet.
6. **Status values** — Free-text in intake; badge maps common labels (Draft, Submitted, etc.) with neutral fallback for planner statuses like "Open" or "Pending Response".

---

## Next step — Phase 5C

Submittal Cover Sheet renderer using the same `ProfessionalDocumentShell` + adapter + optional PDF pattern.
