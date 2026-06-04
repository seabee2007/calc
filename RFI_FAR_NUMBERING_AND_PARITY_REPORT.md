# RFI/FAR Numbering and FAR Page Parity Report

## Summary

Per-project **RFI-###** and **FAR-###** numbering is assigned on builder save when no formatted number exists, without overwriting existing formatted or user-entered values. Display numbers use a single priority chain across lists, rows, and the review drawer. The FAR planner page mirrors the RFI page (filters, Open/Closed/Drafts sections, row actions, title **FARs**).

## Numbering service

**Module:** `src/services/projectRecordNumbering.ts`

| Capability | Description |
|------------|-------------|
| `parseRecordSequence` / `formatRecordNumber` / `isFormattedRecordNumber` | Parse and format `RFI-001` / `FAR-001` (3-digit pad) |
| `getNextRfiNumber` / `getNextFarNumber` | Max sequence from legacy rows + builder `contract_documents` for the project |
| `resolveRfiNumberForSave` / `resolveFarNumberForSave` | Keep formatted parent or answer; else assign next; else preserve custom text |
| `resolveRfiDisplayNumber` / `resolveFarDisplayNumber` | `document_number` → answer key → title regex → `—` |
| `applyRfiNumberToAnswers` / `applyFarNumberToAnswers` | Mirror assigned number into snapshot answers |

**Tests:** `src/services/projectRecordNumbering.test.ts`

## Save path

**`saveProjectDocumentDraft`** (`projectDocumentService.ts`): `patchAssemblyRecordNumbers()` runs before `extractDocumentNumber` for `rfi` / `far`, updating `answers.rfiNumber` / `farNumber` and `document_number`.

**Document Builder:** New RFI/FAR with `projectId` and empty number prefetches the next label as a default (re-validated on save). Question packs label **RFI Number** / **FAR Number** with `helperText` explaining auto-assignment.

## Display UI

- `RfisDocumentsPanel` / `FarsDocumentsPanel` builder rows
- `PlannerBuilderDocumentRow`
- `BuilderDocumentReviewDrawer` header after load

## FAR workflow grouping

**`builderWorkflowStatus.ts`:** `Draft` FARs are **drafts** only (not Open). Sections: `drafts` | `open` | `closed`, aligned with RFI. Tests updated in `builderWorkflowStatus.test.ts`.

## FAR page parity

| Item | Change |
|------|--------|
| `PlannerAdjustmentsPage` | Title **FARs** |
| `FarsDocumentsPanel` | Search, priority + status filters; Open / Closed / **FAR document drafts**; builder rows match RFI pattern; `ProjectRecordActions` / `BuilderDocumentTableActions` |
| `BuilderDocumentReviewDrawer` | FAR sections: Request/Field Adjustment, Impact/References (labor/material/equipment), Review/Response, Version/Activity |

## Counts

No change required: `useProjectTabCounts` / `projectTabCounts` already count legacy + builder RFI/FAR and exclude them from Documents nav total (existing tests).

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **249 passed** (40 files) |
| `npm run build` | **Success** (Vite production build) |
| `npx tsc -p tsconfig.app.json --noEmit` | **Pre-existing project-wide errors** (unrelated modules); fixed duplicate `DocumentAssemblyResult` import introduced in `projectDocumentService.ts` during this work |

## Known limitations

- Legacy FAR rows have no Closed status in `FAR_STATUSES`; **Closed FARs** is builder-only until schema evolves.
- Non-standard user numbers (e.g. `5463456`) are shown as entered, not normalized to `RFI-###`.
- Drawer save updates review/response fields only; request body fields are edited in Document Builder.

## Out of scope

Supabase schema changes, `contract_documents.status` enum, auth/RLS, unrelated document types, PDF layout beyond number display in existing adapters.
