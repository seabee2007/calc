# RFI / FAR Document Builder Workflow Integration Report

## Summary

Planner **New RFI** and **New FAR** now open the Document Builder. Builder-created drafts appear on the project RFIs and FARs tabs with a **View / Respond** drawer for workflow status and responses. A new **GENERIC_FAR** pack supports FAR creation, preview, and PDF export. Legacy workflow records still use `RfiDetailDrawer` / `FarDetailDrawer`.

---

## Files changed

| Area | Files |
|------|--------|
| Workflow status | `src/services/builderWorkflowStatus.ts`, `builderWorkflowStatus.test.ts` |
| Persistence | `src/services/projectDocumentService.ts` (`saveProjectDocumentWorkflowAnswers`, `listProjectFarBuilderDocuments`) |
| Snapshots | `src/services/projectDocumentSnapshots.ts` (`companySettingsFromDocumentSnapshot`, `far` doc number keys) |
| Display | `src/services/projectDocumentDisplay.ts` (`GENERIC_FAR` pack mapping, `far` default pack) |
| RFI pack | `src/features/documents/packs/rfi/questions.ts` (status → select) |
| FAR pack (new) | `src/features/documents/packs/far/*` |
| FAR UI (new) | `ui/adapters/farPreviewAdapter.ts`, `ui/renderers/FarDocument.tsx`, `ui/pdf/farPdf.ts`, `farPreviewAdapter.test.ts` |
| Registry / builder | `packs/registry.ts`, `registry/questionnaireRegistry.ts`, `registry/documentTypeRegistry.ts`, `types.ts`, `DocumentPreviewRouter.tsx`, `DocumentBuilderPage.tsx` |
| Planner UI | `BuilderDocumentReviewDrawer.tsx`, `PlannerBuilderDocumentRow.tsx`, `RfisDocumentsPanel.tsx`, `FarsDocumentsPanel.tsx`, `PlannerAdjustmentsPage.tsx` |
| Top nav counts | `src/hooks/useProjectTabCounts.ts` |
| Tests | `projectDocumentDisplay.test.ts` |

---

## FAR pack files created

- `src/features/documents/packs/far/questions.ts`
- `src/features/documents/packs/far/template.ts`
- `src/features/documents/packs/far/clauses.ts`
- `src/features/documents/packs/far/index.ts` (`GENERIC_FAR`, `documentType: far`)
- `src/features/documents/ui/adapters/farPreviewAdapter.ts`
- `src/features/documents/ui/renderers/FarDocument.tsx`
- `src/features/documents/ui/pdf/farPdf.ts`

---

## New RFI / New FAR routing

Uses [`contractBuilderToolHref`](src/utils/plannerRoutes.ts) query params: `project`, `packKey`, `documentType`.

| Action | URL pattern |
|--------|-------------|
| New RFI | `/tools/contract-builder?project={id}&packKey=GENERIC_RFI&documentType=rfi` |
| New FAR | `/tools/contract-builder?project={id}&packKey=GENERIC_FAR&documentType=far` |
| Open saved doc | `/tools/contract-builder?project={id}&id={documentId}` |

`CreateRfiModal` / `CreateFieldAdjustmentModal` removed from **project** RFIs/FARs panels only (still used on Board, tasks, employee quick actions).

---

## Response modal behavior

[`BuilderDocumentReviewDrawer.tsx`](src/components/planner/documents/BuilderDocumentReviewDrawer.tsx):

- Loads latest version via `getProjectDocument` + `restoreBuilderStateFromSnapshot`
- Read-only summary (title, number, question/description)
- Editable workflow **status** (RFI or FAR status lists)
- RFI: response, respondedBy, responseDate
- FAR: reviewerResponse, reviewedBy, responseDate, approvalDecision
- **Save** → `saveProjectDocumentWorkflowAnswers`
- **Export PDF** → `generateRfiPDF` / `generateFarPDF`
- **Open in Document Builder** → `contractBuilderToolHref(projectId, documentId)`

[`PlannerBuilderDocumentRow`](src/components/planner/PlannerBuilderDocumentRow.tsx): **View / Respond** for RFI/FAR builder drafts; status from `resolveBuilderWorkflowStatusDisplay`.

---

## Status persistence strategy

| Storage | Values | Purpose |
|---------|--------|---------|
| `contract_documents.status` | `draft`, `finalized`, `archived` only | Unchanged; never Submitted/Closed/etc. |
| `answers.status` | Draft, Submitted, Under Review, Answered, Approved, … | User-facing workflow state in JSON |
| `builder_workflow_status` | Copied from `answers.status` on save via `extractBuilderWorkflowStatus` | List badges and quick reads |

`saveProjectDocumentWorkflowAnswers` merges partial answers, re-assembles via `buildDocumentInput` → `assembleDocument`, appends a new immutable version with `saveProjectDocumentDraft`, preserving `document.status` (typically `draft`).

---

## PDF export path

| Type | Generator |
|------|-----------|
| RFI | `buildRfiPreviewFromDocumentAnswers` → `generateRfiPDF` |
| FAR | `buildFarPreviewFromDocumentAnswers` → `generateFarPDF` |
| Other | Unchanged (residential generic export not used for RFI/FAR) |

Document Builder export switch includes `isFarDocument` branch.

---

## List / count behavior

| Location | RFI | FAR |
|----------|-----|-----|
| RFIs / FARs tab | Workflow rows + builder drafts section | Same |
| Documents page | Excluded via `isDocumentsTabBuilderDocument` | Excluded |
| Top nav count | `rfis + listProjectRfiBuilderDocuments` | `adjustments + listProjectFarBuilderDocuments` |

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 39 files, **235** tests |
| `npm run build` | **Pass** |

---

## Known limitations

1. **Legacy create modals** remain on Board, task drawer, and employee quick actions.
2. **Workflow status** stored as display strings in `answers.status`, not a DB enum.
3. **Each save** appends a new document version (immutable version design).
4. **No live sync** — refresh or navigate to see counts update after save.
5. **FAR workflow rows** (`field_adjustment_requests`) and **FAR builder docs** are separate lists; no auto-link between them yet.
6. **No schema migration** — uses existing `builder_workflow_status` and RPC.

---

## Date

2026-06-03
