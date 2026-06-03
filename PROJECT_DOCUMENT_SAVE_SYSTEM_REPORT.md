# Project Document Save + Reopen System (Phase DB-1) Report

## Summary

Project-linked document drafts now save, reopen, and appear in the correct Planner sections. Implementation **extends the existing `contract_documents` table** (Phase 6.1) rather than adding a separate `project_documents` table, avoiding duplicate RLS and signing-workflow confusion.

---

## Decision: extend `contract_documents` (not new table)

| Existing capability | Location |
|---------------------|----------|
| `contract_documents` + `contract_document_versions` | `20260614000000_contract_documents.sql` |
| `save_contract_version` RPC | Same migration |
| Builder save/load UI (partial) | `DocumentBuilderPage`, `?project=&id=` |
| Planner Documents (contracts only) | `PlannerDocumentsPage` |

Phase DB-1 adds snapshot columns, extended RPC parameters, a builder facade service, hardened save rules, and Planner union lists for RFI/CO/submittal/daily_report.

---

## Migration created

**File:** `supabase/migrations/20260619000000_builder_document_snapshots.sql`

**New columns on `contract_documents`:**

| Column | Purpose |
|--------|---------|
| `document_number` | RFI #, submittal #, CO #, report # |
| `template_key` | e.g. `GENERIC_RFI_TEMPLATE` |
| `builder_workflow_status` | Draft / Submitted / Reviewed / etc. from answers |
| `project_snapshot` | Point-in-time project/client JSON |
| `company_snapshot` | Point-in-time company JSON |
| `rendered_snapshot` | Optional rendered view JSON (reserved) |

**Index:** `contract_documents_type_project_idx` on `(project_id, document_type, updated_at DESC)`.

**RPC:** `save_contract_version` extended with optional parameters for the new columns (old overload dropped and recreated).

**RLS:** Unchanged — owner `user_id = auth.uid()` for ALL; project members SELECT via existing policy.

---

## Services created / updated

### Created

| File | Purpose |
|------|---------|
| `src/services/projectDocumentSnapshots.ts` | `buildProjectSnapshot`, `buildCompanySnapshot`, `extractDocumentNumber`, `extractBuilderWorkflowStatus` |
| `src/services/projectDocumentService.ts` | Builder facade: list, save, delete |
| `src/services/projectDocumentSnapshots.test.ts` | Unit tests for extractors |
| `src/components/planner/PlannerBuilderDocumentRow.tsx` | Shared planner row: Open/Edit, Export PDF, Delete |

### Updated

| File | Change |
|------|--------|
| `contractDocumentTypes.ts` | New optional row fields |
| `contractVersionState.ts` | `SaveContractVersionPayload` snapshot fields |
| `contractDocumentService.ts` | RPC args + `deleteContractDocument` |

### API surface (`projectDocumentService`)

- `listProjectDocuments(projectId?)`
- `listProjectDocumentsByType(projectId, documentType)`
- `getProjectDocument(id)`
- `saveProjectDocumentDraft(payload)` — calls `save_contract_version` with snapshots
- `updateProjectDocumentDraft(id, updates)`
- `deleteProjectDocument(id)`

---

## Save / load workflow

### Save Draft (`DocumentBuilderPage`)

1. User fills questionnaire; optional project selected.
2. **Project required** for: change order, RFI, submittal, daily report.
3. **Email validation** only for `residential_contract`.
4. `saveProjectDocumentDraft` captures:
   - `answers` in immutable `input_snapshot` (via assembly manifest)
   - `project_snapshot` / `company_snapshot` on parent row
   - `document_number`, `template_key`, `builder_workflow_status`
5. Toast: **Document draft saved** / **Could not save document draft**
6. UI: **Last saved:** timestamp + version number

### Reopen

- URL: `/tools/contract-builder?project={uuid}&id={documentId}`
- Loads document + current version; restores `packKey`, `mode`, `answers`, `accepted`
- Does **not** overwrite answers from current project/company (snapshots are historical only)
- Export from planner: append `&export=1` triggers PDF export after load

### Versioning

Each save **appends** a new `contract_document_versions` row (immutable audit). Parent row metadata and snapshots update. This differs from in-place JSON overwrite but supports “save again” and version history.

---

## Planner integration

### Documents (`PlannerDocumentsPage`)

- **Contracts** — `residential_contract` (signing meta unchanged)
- **Submittals** — `submittal` builder drafts
- **Daily reports** — `daily_report` builder drafts
- **Other** — future types when present
- Safety meetings + QC checklists unchanged

### RFIs (`PlannerRFIsPage`)

- **RFI requests** — existing `rfi_requests` workflow (drawer, create modal) unchanged
- **Document Builder drafts** — `contract_documents` where `document_type = 'rfi'`, labeled “Draft RFI Document”

### Change Orders (`PlannerChangeOrdersPage`)

- **Workflow change orders** — existing send/sign/delete unchanged
- **Document Builder drafts** — `document_type = 'change_order'`, labeled “Draft Change Order Document”

### Row actions (builder drafts only)

- Open / Edit → contract builder
- Export PDF → builder with `export=1`
- Delete → `deleteProjectDocument` (confirm twice)

---

## Security

| Check | Result |
|-------|--------|
| Own documents only | RLS on `contract_documents` |
| Cross-user URL access | `getContractDocument` fails under RLS |
| Workflow isolation | Builder saves never write to `rfi_requests` / `change_orders` |

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 29 files, 205 tests |
| `npm run build` | **Pass** |
| `npx tsc -p tsconfig.app.json --noEmit` | Pre-existing repo errors; **no new errors** in `projectDocumentService`, `projectDocumentSnapshots`, `PlannerBuilderDocumentRow` |

---

## Known limitations

1. **Append-only versions** — Every save creates a new version; not a single mutable JSON row.
2. **No autosave** — Manual Save Draft only.
3. **No duplicate document** action.
4. **Rendered snapshot** — Column exists; not populated with full adapter view models yet (optional follow-up).
5. **Refresh from project/company** — Not implemented; reopen uses stored answers only.
6. **FAR documents** — No `far` document type in builder yet; Planner FARs unchanged.
7. **Migration apply** — Run `supabase db push` or deploy migration before new columns work in production.

---

## Regression confirmation

- Planner RFI create/respond workflow unchanged
- Planner Change Order send/sign workflow unchanged
- PDF renderers unchanged
- Residential contract signing flow unchanged
- Pricing / document engine assembly logic unchanged

---

## Files checklist

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260619000000_builder_document_snapshots.sql` |
| Create | `src/services/projectDocumentService.ts` |
| Create | `src/services/projectDocumentSnapshots.ts` |
| Create | `src/services/projectDocumentSnapshots.test.ts` |
| Create | `src/components/planner/PlannerBuilderDocumentRow.tsx` |
| Update | `contractDocumentService.ts`, `contractDocumentTypes.ts`, `contractVersionState.ts` |
| Update | `DocumentBuilderPage.tsx` |
| Update | `PlannerDocumentsPage.tsx`, `PlannerRFIsPage.tsx`, `PlannerChangeOrdersPage.tsx` |
