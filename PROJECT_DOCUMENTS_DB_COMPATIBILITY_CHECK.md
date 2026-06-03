# Project Documents DB Compatibility Check

**Date:** 2026-06-03  
**Scope:** Can the database save all Document Builder types (including Phase 5E QC, 5F Warranty/Closeout, 5G Punch List) without another migration?

**Sources reviewed:** `supabase/migrations/20260614000000_contract_documents.sql`, `20260615000000_contract_public_signing.sql`, `20260616000000_contract_token_hardening.sql`, `20260619000000_builder_document_snapshots.sql`, `src/services/projectDocumentService.ts`, `src/features/documents/services/contractDocumentService.ts`.

---

## Executive summary

| Question | Result |
|----------|--------|
| Does `public.project_documents` exist? | **No** — persistence uses `public.contract_documents` (+ `contract_document_versions`). |
| Can all listed builder `document_type` values be saved today? | **Yes** — `document_type` and `pack_key` are unconstrained `text`. |
| Is another migration **required** for new types? | **No** |
| Optional migration? | Only for naming parity, stricter enums, or a dedicated `answers` parent column (not used by the app today). |

The app facade `projectDocumentService` is a thin wrapper over `contractDocumentService` / `save_contract_version` RPC. Planner “project documents” are rows in `contract_documents`, not a separate table.

---

## 1. Does `public.project_documents` exist?

**No.**

Migrations explicitly state that Phase DB-1 extends `contract_documents` and does **not** create `project_documents`:

```4:4:calc/supabase/migrations/20260619000000_builder_document_snapshots.sql
  Extends the existing contract_documents table (no parallel project_documents).
```

**Actual storage model:**

| Logical concept | Physical location |
|-----------------|-------------------|
| Document metadata | `contract_documents` |
| Questionnaire answers | `contract_document_versions.input_snapshot` → JSON `answers` (+ `facts`, `packKey`) |
| Rendered assembly | `contract_document_versions.manifest`, `sections`, `risk` |

---

## 2. Column checklist (requested vs actual)

Requested fields were checked against **`contract_documents`** (the table the save path uses).

| Requested column | Present? | Actual column / notes |
|------------------|----------|------------------------|
| `document_type` text | Yes | `contract_documents.document_type` — free `text`, default `'residential_contract'` |
| `pack_key` text | Yes | `contract_documents.pack_key` — free `text` |
| `template_key` text | Yes | Added in `20260619000000_builder_document_snapshots.sql` |
| `title` text | Yes | `contract_documents.title` |
| `document_number` text | Yes | Same migration (builder # at last save) |
| `status` text | Yes | `contract_documents.status` — see CHECK below |
| `answers` jsonb | **Not on parent row** | Stored per version: `contract_document_versions.input_snapshot` (jsonb) contains `{ "answers": { ... }, "facts": { ... }, "packKey": "..." }` |
| `project_snapshot` jsonb | Yes | `contract_documents.project_snapshot` (default `{}`) |
| `company_snapshot` jsonb | Yes | `contract_documents.company_snapshot` (default `{}`) |
| `rendered_snapshot` jsonb | Yes | `contract_documents.rendered_snapshot` (default `{}`) |
| `project_id` | Yes | `contract_documents.project_id` (nullable FK → `projects`) |
| `user_id` | Yes | `contract_documents.user_id` (FK → `auth.users`) |

**Additional parent columns (signing / versioning, not in checklist):**  
`current_version_id`, `latest_version_number`, `public_token`, `signing_status`, `sent_version_id`, signature timestamps/names, `builder_workflow_status`, `created_at`, `updated_at`.

**Save path (`projectDocumentService.saveProjectDocumentDraft`):**  
Writes metadata + snapshots to `contract_documents` via RPC; puts answers inside `p_input_snapshot` on each new `contract_document_versions` row.

---

## 3. CHECK constraints on `document_type`, `pack_key`, `status`

| Column | CHECK constraint? | Allowed values |
|--------|-------------------|----------------|
| `document_type` | **None** | Any non-null text accepted by RPC/INSERT |
| `pack_key` | **None** | Any non-null text |
| `status` | **Yes** | `'draft'`, `'finalized'`, `'archived'` only |

```22:23:calc/supabase/migrations/20260614000000_contract_documents.sql
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'archived')),
```

**Related (not builder workflow):** `signing_status` has its own CHECK (`draft`, `sent`, `viewed`, `signed`, `declined`, `void`) on `contract_documents` from Phase 6.2.

**Search:** No migration defines `CHECK` on `document_type` or `pack_key`.

---

## 4. Builder document types vs constraints

Because **`document_type` has no enum/CHECK**, all builder types below can be persisted as-is (with any `pack_key` the app sends, e.g. `GENERIC_PUNCH_LIST`).

| `document_type` | Required in CHECK? | Can save today? |
|-----------------|--------------------|-----------------|
| `residential_contract` | N/A (no CHECK) | Yes |
| `change_order` | N/A | Yes |
| `rfi` | N/A | Yes |
| `submittal` | N/A | Yes |
| `daily_report` | N/A | Yes |
| `qc_report` | N/A | Yes |
| `warranty_letter` | N/A | Yes |
| `punch_list` | N/A | Yes |

**Missing document types:** None — there is no allow-list to update.

`projectDocumentService` `BuilderDocumentType` union matches this list (lines 37–45 in `projectDocumentService.ts`).

---

## 5. RLS — SELECT / INSERT / UPDATE / DELETE

RLS is enabled on `contract_documents` and `contract_document_versions`.

### `contract_documents`

| Operation | Owner (`user_id = auth.uid()`) | Project member (non-owner) |
|-----------|--------------------------------|----------------------------|
| SELECT | Yes — policy “Owners manage contract documents” (`FOR ALL`) + own row | Yes — “Project members view contract documents” when `project_id` set and `can_access_project(project_id)` |
| INSERT | Yes — `FOR ALL` + `WITH CHECK (user_id = auth.uid())` | No dedicated INSERT policy |
| UPDATE | Yes — same owner `FOR ALL` policy | No |
| DELETE | Yes — same owner `FOR ALL` policy (cascade deletes versions) | No |

```69:74:calc/supabase/migrations/20260614000000_contract_documents.sql
CREATE POLICY "Owners manage contract documents"
  ON contract_documents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

App delete: `deleteContractDocument` → `supabase.from('contract_documents').delete()` (owner-only via RLS).

### `contract_document_versions`

| Operation | Owner | Notes |
|-----------|-------|-------|
| SELECT | Owner or project member (via parent link) | Append-only history |
| INSERT | Owner only | Via `save_contract_version` RPC (`SECURITY DEFINER`) or direct insert matching policy |
| UPDATE | **Denied** | Trigger raises immutable exception |
| DELETE | **Denied** | No DELETE policy; parent DELETE cascades |

**Writes** from the builder use `save_contract_version`, which enforces `auth.uid()` and ownership inside the function.

**Conclusion:** Owner CRUD on documents is supported. There are no separate per-operation policies; one `FOR ALL` owner policy covers INSERT/UPDATE/DELETE/SELECT for the owning user.

---

## 6. Indexes

### On `contract_documents`

| Requested index target | Present? | Index name |
|------------------------|----------|------------|
| `user_id` | Yes | `contract_documents_user_idx` on `(user_id, updated_at DESC)` |
| `project_id` | Yes | `contract_documents_project_idx` on `(project_id)` WHERE `project_id IS NOT NULL` |
| `document_type` | **Partial** | No standalone `document_type` index; composite `contract_documents_type_project_idx` on `(project_id, document_type, updated_at DESC)` WHERE `project_id IS NOT NULL` |
| `updated_at` | Yes | Included in `contract_documents_user_idx` and `contract_documents_type_project_idx` |

**Other indexes (not in checklist):** `contract_documents_public_token_idx`, `contract_documents_project_signing_idx`, `contract_documents_public_token_validity_idx`.

### On `contract_document_versions`

- `contract_document_versions_document_idx` — `(document_id, version_number DESC)`
- `contract_document_versions_user_idx` — `(user_id)`

---

## Is a migration needed?

### Required for new Document Builder types: **No**

- No `project_documents` table to create for current code.
- No `document_type` / `pack_key` allow-list blocking `qc_report`, `warranty_letter`, or `punch_list`.
- Snapshot columns and extended RPC already exist (`20260619000000_builder_document_snapshots.sql`).
- Answers persist in `input_snapshot` on each version without schema change.

### Prerequisites in deployed environments

Ensure these migrations are applied (in order):

1. `20260614000000_contract_documents.sql`
2. `20260615000000_contract_public_signing.sql` (optional for builder-only saves but part of same table)
3. `20260616000000_contract_token_hardening.sql`
4. `20260619000000_builder_document_snapshots.sql` — **required** for `template_key`, snapshots, extended RPC

If `20260619000000` is missing, saves may fail when the RPC passes snapshot parameters the old function does not accept.

---

## Optional migration SQL (do not apply unless product chooses)

Use only if you want a physical `project_documents` view/table alias, stricter enums, or a parent-level `answers` column. **Not required** for compatibility.

### A. Optional — document_type allow-list (hardening only)

```sql
-- Optional hardening: only if you want DB-level enforcement.
-- Today the app already sends valid types; omit if you prefer free text.

ALTER TABLE public.contract_documents
  DROP CONSTRAINT IF EXISTS contract_documents_document_type_check;

ALTER TABLE public.contract_documents
  ADD CONSTRAINT contract_documents_document_type_check
  CHECK (document_type IN (
    'residential_contract',
    'change_order',
    'rfi',
    'submittal',
    'daily_report',
    'qc_report',
    'warranty_letter',
    'punch_list'
  ));
```

### B. Optional — standalone `document_type` index (planner-wide queries)

```sql
CREATE INDEX IF NOT EXISTS contract_documents_document_type_idx
  ON public.contract_documents (document_type, updated_at DESC);
```

### C. Optional — `project_documents` view (naming only, no app change unless wired)

```sql
CREATE OR REPLACE VIEW public.project_documents AS
SELECT
  id,
  user_id,
  project_id,
  title,
  document_type,
  pack_key,
  template_key,
  document_number,
  status,
  project_snapshot,
  company_snapshot,
  rendered_snapshot,
  current_version_id,
  latest_version_number,
  created_at,
  updated_at
FROM public.contract_documents;
```

Answers would still live in `contract_document_versions.input_snapshot`, not in this view, unless you add a denormalized column and triggers.

### D. Optional — parent `answers` jsonb (denormalized; app does not use today)

```sql
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Would also require updating save_contract_version to copy
-- p_input_snapshot->'answers' into contract_documents.answers on each save.
```

---

## Mapping: checklist name → codebase

| Checklist term | Code / DB |
|----------------|-----------|
| `project_documents` | Facade only — table is `contract_documents` |
| `answers` | `contract_document_versions.input_snapshot.answers` |
| `status` (draft lifecycle) | `contract_documents.status` (`draft` / `finalized` / `archived`) |
| Workflow status from questionnaire | `contract_documents.builder_workflow_status` |
| Save RPC | `public.save_contract_version(...)` |

---

## Regression / ops notes

- Mis-typed `document_type` on insert is allowed at DB level; routing uses `pack_key` first in `resolveEffectiveDocumentType` (app layer).
- Builder saves always append a new version; parent row updates metadata and snapshots.
- `status` must remain `draft`, `finalized`, or `archived` — do not store questionnaire “Open/Closed” in `status`; use `builder_workflow_status` or answers.
- No migration needed to ship QC Report, Warranty/Closeout, or Punch List document types.
