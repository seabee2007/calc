# Phase 5G — Punch List Professional Document Renderer Report

## Summary

Professional Punch List preview and PDF export are wired into the Contract & Document Builder using Phase 5A shared paper components. Selecting **Punch List** (`GENERIC_PUNCH_LIST`) shows a white-paper punch list layout with item cards. Saved drafts route to **Project → Documents → Punch Lists**. Change Order, RFI, Submittal, Daily Report, QC Report, Warranty / Closeout, and Residential Contract previews are unchanged.

---

## Files created

| File | Purpose |
|------|---------|
| `src/features/documents/packs/punchList/questions.ts` | Intake bank (quick / standard / advanced); `STATUS_OPTIONS`, `PRIORITY_OPTIONS`, `CATEGORY_OPTIONS`, `ITEM_STATUS_OPTIONS` |
| `src/features/documents/packs/punchList/template.ts` | Minimal `GENERIC_PUNCH_LIST_TEMPLATE` |
| `src/features/documents/packs/punchList/clauses.ts` | Empty clause list |
| `src/features/documents/packs/punchList/index.ts` | `GENERIC_PUNCH_LIST_PACK` metadata |
| `src/features/documents/ui/renderers/PunchListDocument.tsx` | Paper renderer (9 sections, item cards, conditional impacts/comments) |
| `src/features/documents/ui/adapters/punchListPreviewAdapter.ts` | Maps answers + project + company → view model |
| `src/features/documents/ui/adapters/punchListPreviewAdapter.test.ts` | Adapter smoke test |
| `src/features/documents/ui/pdf/punchListPdf.ts` | Draft PDF export via jsPDF |

## Files changed

| File | Change |
|------|--------|
| `src/features/documents/packs/registry.ts` | Registered `GENERIC_PUNCH_LIST` catalog |
| `src/features/documents/registry/questionnaireRegistry.ts` | `punch_list` question bank |
| `src/features/documents/registry/documentTypeRegistry.ts` | `punch_list` runtime-supported type |
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | Punch list branch after Warranty / Closeout, before Residential |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Pack routing, title sync, PDF export, project save gate |
| `src/services/projectDocumentDisplay.ts` | **Punch Lists** group, pack mapping, `filterDocumentsTabBuilderDocuments().punchLists` |
| `src/services/projectDocumentDisplay.test.ts` | `GENERIC_PUNCH_LIST` routing test |
| `src/services/projectDocumentSnapshots.ts` | `punch_list` document number extraction |
| `src/services/projectDocumentService.ts` | `BuilderDocumentType` + label |
| `src/pages/planner/PlannerDocumentsPage.tsx` | “Punch lists” section, “New punch list” button (after QC Reports, before Closeout) |

**Not changed:** Supabase schema/RLS, document engine core, CO/RFI/Submittal/Daily/QC/Warranty/Residential renderer or PDF files, planner route definitions, existing save RPC logic.

---

## Pack metadata

| Field | Value |
|-------|--------|
| `packKey` | `GENERIC_PUNCH_LIST` |
| `label` | Punch List |
| `documentType` | `punch_list` (existing union value) |
| `status` | `draft_only` |
| `finalExportAllowed` | `true` |
| `templateKey` | `GENERIC_PUNCH_LIST_TEMPLATE` |

---

## Adapter mapping (selected)

| Answer key | View field |
|------------|------------|
| `listDate` / `documentDate` | `generatedDate` |
| `punchListNumber` | `documentNumber` |
| `overallStatus` / `status` (document) | `status` |
| `preparedBy` | `preparedBy`, `signaturePreparedBy` |
| `inspectionDate` / `inspectionLocation` / `summary` | inspection summary section |
| `itemNumber`, `itemDescription`, … | single `PunchListItemView` in `items[]` |
| `itemStatus` (preferred) / `status` (item fallback) | `itemStatus` on item row |
| `category`, `priority` | select label resolution via shared constants |
| `costImpact`, `scheduleImpact` | impacts section (conditional) |
| `ownerComment`, `contractorResponse` | comments section |
| `photoReferences`, `attachmentNotes` | attachments section |
| `finalAcceptanceBy` / `finalAcceptanceDate` | final acceptance + `signatureOwner` (fallback: project client) |
| `verifiedBy` (on item) | `signatureVerifiedBy` |
| `signatureDate` | `signatureDate` |

**Title:** explicit `title` → `Punch List — {punchListNumber}` → `Punch List — {projectName}` → `Punch List`.

**Items:** One primary item built from flat standard/advanced keys; `items` has 0 or 1 row (push only when `itemNumber`, `itemDescription`, `locationArea`, or `responsibleParty` has content). Renderer shows “No punch items recorded” when empty.

---

## Preview router change

After Warranty / Closeout, before Residential:

- `isPunchList` when `documentType === 'punch_list'` or `packKey === 'GENERIC_PUNCH_LIST'`
- `buildPunchListPreviewFromDocumentAnswers` → `<PunchListDocument />`

---

## PDF export routing

- `isPunchListDocument` → `generatePunchListPDF`
- Filename: `PUNCH-LIST-{punchListNumber or listDate}.pdf`
- Sections aligned with renderer; empty impact blocks skipped

---

## Project document routing / grouping

| Type / pack | Planner location |
|-------------|------------------|
| `punch_list` | Documents → **Punch Lists** |
| `GENERIC_PUNCH_LIST` | Resolves to `punch_list` via `PACK_TO_TYPE` |

**Planner:** “New punch list” → `?packKey=GENERIC_PUNCH_LIST&documentType=punch_list` (via `contractBuilderToolHref`).

Punch lists remain on the Documents tab (`isDocumentsTabBuilderDocument` unchanged); excluded from CO / RFI / FAR buckets only.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **215 passed** (33 files) |
| `npm run build` | **Success** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing project debt; no new errors in punch-list renderer/adapter/PDF files |

---

## Known limitations

- **Single punch item per document** until the question engine supports repeatable rows (`QuestionType` has no repeater).
- No attachment file uploads in builder (text references only).
- No legal contract clauses (intentional for this phase).

---

## Regression confirmation

- Change Order, RFI, Submittal, Daily Report, QC Report, Warranty / Closeout, Residential: unchanged  
- Single **Punch List** pack in dropdown  
- Daily / Submittal / QC / Closeout saved drafts still route to correct Documents sections  

---

## Manual acceptance checklist

1. Builder → Punch List pack + project  
2. Fill quick + primary item fields → live preview (item card)  
3. Save → **Documents → Punch Lists** only  
4. Reopen, export PDF, verify dark-mode paper preview  
5. Confirm no appearance under CO, RFIs, FARs, Daily, Submittals, QC Reports, or Closeout / Warranty  
