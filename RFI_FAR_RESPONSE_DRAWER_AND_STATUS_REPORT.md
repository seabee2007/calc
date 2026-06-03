# RFI/FAR Response Drawer and Status Routing Report

## Summary

Fixed builder RFI/FAR list routing so workflow status changes move rows into the correct Open/Closed/Drafts sections, and upgraded the planner review drawer to match professional planner slide-out patterns. Persistence continues through the existing versioned document save path.

## Root cause of grouping bug

[`RfisDocumentsPanel.tsx`](src/components/planner/documents/panels/RfisDocumentsPanel.tsx) and [`FarsDocumentsPanel.tsx`](src/components/planner/documents/panels/FarsDocumentsPanel.tsx) rendered **all** builder documents in a static footer section (`RFI document drafts` / `FAR document drafts`). Legacy records used Open/Closed (RFI) or status buckets (FAR), but builder rows never participated in status-based grouping. After saving `Under Review` or `Closed`, `builder_workflow_status` updated on the parent row, but the UI still listed the document in the drafts section.

## Status normalization strategy

Centralized in [`builderWorkflowStatus.ts`](src/services/builderWorkflowStatus.ts):

| Priority | Source |
|----------|--------|
| 1 | `contract_documents.builder_workflow_status` |
| 2 | `answers.status` (drawer load from latest version snapshot) |
| 3 | `contract_documents.status` fallback (`draft` → Draft; not used for workflow Closed) |

`formatWorkflowStatusLabel` / `normalizeBuilderWorkflowStatus` map snake_case and mixed labels (`under_review` → `Under Review`).

### RFI builder list sections

| Section | Workflow statuses |
|---------|-------------------|
| RFI Document Drafts | Draft |
| Open RFIs | Submitted, Under Review, Answered |
| Closed RFIs | Closed, Void |

### FAR builder list sections

| Section | Workflow statuses |
|---------|-------------------|
| Open FARs | Draft, Submitted, Under Review, Approved, Rejected |
| Closed FARs | Closed, Void |

Legacy RFI rows still use `isRfiClosed()` from [`rfiService.ts`](src/services/rfiService.ts) (`Answered` remains in Closed for old workflow records). Legacy FAR rows (Pending, Approved, etc.) appear under **Open FARs**.

## Fields persisted on save

[`saveProjectDocumentWorkflowAnswers`](src/services/projectDocumentService.ts) merges partial answers and appends a new immutable version via `saveProjectDocumentDraft`. `contract_documents.status` stays `draft` / `finalized` / `archived` only.

**RFI drawer:** `answers.status`, `response`, `respondedBy`, `responseDate` → `builder_workflow_status` from `extractBuilderWorkflowStatus`.

**FAR drawer:** `answers.status`, `reviewerResponse`, `reviewedBy`, `responseDate`, `approvalDecision` → same version path.

## Drawer UI changes

[`BuilderDocumentReviewDrawer.tsx`](src/components/planner/documents/BuilderDocumentReviewDrawer.tsx):

- Full-height right panel (`max-w-xl`, flex column, scrollable body, sticky footer)
- Header: title, document number, workflow status badge, project name
- Section cards: Summary, Request/Question, Impact/References, Response (with status dropdown), Activity/Version
- `formatDisplayValue` for empty/missing fields (`—`, no raw JSON)
- Labels: **Save response** / **Save review**, **Open in Document Builder**, **Export PDF**
- Success toast on save; `onReload` updates list grouping without full page refresh

## List / row changes

- [`RfisDocumentsPanel.tsx`](src/components/planner/documents/panels/RfisDocumentsPanel.tsx): partitions builder docs into Open/Closed/Drafts; builder rows in Open/Closed use unified table with **View / Respond**
- [`FarsDocumentsPanel.tsx`](src/components/planner/documents/panels/FarsDocumentsPanel.tsx): **Open FARs** / **Closed FARs**; removed isolated drafts section
- [`PlannerBuilderDocumentRow.tsx`](src/components/planner/PlannerBuilderDocumentRow.tsx): `reviewActionLabel`, `FieldRecordStatusBadge`, builder href with `packKey` + `documentType`
- [`FieldRecordStatusBadge.tsx`](src/components/field/FieldRecordStatusBadge.tsx): Submitted, Under Review, Void styles

## Files changed

| File | Change |
|------|--------|
| `src/services/builderWorkflowStatus.ts` | Partition + normalize helpers |
| `src/services/builderWorkflowStatus.test.ts` | Unit tests (+3 cases) |
| `src/components/planner/documents/panels/RfisDocumentsPanel.tsx` | Status-driven 3-section routing |
| `src/components/planner/documents/panels/FarsDocumentsPanel.tsx` | Open/Closed FAR routing |
| `src/components/planner/PlannerBuilderDocumentRow.tsx` | Review labels, badges, hrefs |
| `src/components/planner/documents/BuilderDocumentReviewDrawer.tsx` | Professional drawer UI |
| `src/components/field/FieldRecordStatusBadge.tsx` | Workflow badge colors |

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **238 passed** (39 files) |
| `npm run build` | **Success** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing errors elsewhere; **no new errors** in RFI/FAR drawer/status files after fixes |

## Known limitations

- Legacy RFI `Answered` stays under **Closed RFIs**; only builder `Answered` routes to **Open RFIs**.
- Open/Closed builder table rows show `—` for Submitted by / impacts until list API enriches from latest version snapshot.
- FAR legacy records no longer use Pending/Approved subsection headers; all legacy FARs appear under **Open FARs** for simpler Open/Closed UX.

## Manual acceptance checklist

**RFI:** Change status Draft → Under Review → row moves to Open RFIs; Closed → Closed RFIs; save response persists on reopen and in Document Builder.

**FAR:** Approved → Open FARs; Closed → Closed FARs; save review persists.

**Regression:** New RFI/FAR → Document Builder; legacy records still display; Documents page inner tabs unchanged; Change Orders unaffected.
