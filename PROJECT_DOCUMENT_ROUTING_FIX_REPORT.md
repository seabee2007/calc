# Project Document Routing Fix Report

## Root cause

Two issues caused Daily Reports to appear under **Change Orders → Document Builder drafts** with a **“Draft Change Order Document”** subtitle:

1. **Listing used raw `document_type` only** — `listProjectDocumentsByType(projectId, 'change_order')` matched rows where `document_type` was stored as `change_order` even when the saved pack was `GENERIC_DAILY_REPORT` (pack and type could drift on first save or reopen from a generic builder link).

2. **Hardcoded subtitle on the Change Orders page** — every builder row used `typeLabelOverride="Draft Change Order Document"`, so misfiled rows still read as change orders in the UI.

**Fix:** Resolve the effective type from **`pack_key` first** (authoritative for builder packs), then filter planner sections with explicit helpers. Display labels come from `getProjectDocumentDisplayMeta()`.

## Files changed

| File | Change |
|------|--------|
| `src/services/projectDocumentDisplay.ts` | **New** — `resolveEffectiveDocumentType`, `getProjectDocumentDisplayMeta`, section filters, `filterDocumentsTabBuilderDocuments`, `DEFAULT_PACK_BY_DOCUMENT_TYPE` |
| `src/services/projectDocumentDisplay.test.ts` | **New** — routing/display unit tests |
| `src/services/projectDocumentService.ts` | `listProjectDocumentsByType` uses effective type; added `listProjectChangeOrderBuilderDocuments`, `listProjectRfiBuilderDocuments` |
| `src/utils/plannerRoutes.ts` | `contractBuilderToolHref` accepts `packKey` / `documentType` query params |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Initializes pack from `?packKey=` / `?documentType=` for new drafts |
| `src/components/planner/PlannerBuilderDocumentRow.tsx` | Subtitle from `getProjectDocumentDisplayMeta`; removed `typeLabelOverride` |
| `src/pages/planner/PlannerChangeOrdersPage.tsx` | CO-only draft list; “New draft CO” opens `GENERIC_CHANGE_ORDER` |
| `src/pages/planner/PlannerRFIsPage.tsx` | RFI-only draft list; “New draft RFI” opens `GENERIC_RFI` |
| `src/pages/planner/PlannerDocumentsPage.tsx` | Grouped sections (Contracts, Submittals, Daily Reports, QC, Closeout, Other); typed “New …” links |
| `PROJECT_DOCUMENT_ROUTING_FIX_REPORT.md` | This report |

**Not changed:** Supabase schema, save/RPC logic, PDF export, workflow CO/RFI tables, auth/RLS, pricing math.

## Filters corrected

| Planner section | Includes | Excludes |
|-----------------|----------|----------|
| Change Orders → Builder drafts | `resolveEffectiveDocumentType` → `change_order` | daily_report, submittal, rfi, contracts, etc. |
| RFIs → Builder drafts | effective `rfi` / `GENERIC_RFI` | CO, daily report, … |
| Documents / Files | `filterDocumentsTabBuilderDocuments` groups | CO, RFI, FAR workflow docs |

`pack_key` mapping:

- `GENERIC_DAILY_REPORT` → daily_report (never shown on Change Orders)
- `GENERIC_CHANGE_ORDER` → change_order
- `GENERIC_RFI` → rfi
- `GENERIC_SUBMITTAL` → submittal
- `GENERIC_RESIDENTIAL` → residential_contract

## Display labels corrected

`getProjectDocumentDisplayMeta(document)` returns label, group, and `subtitleLabel` used in row subtitles:

| Effective type | Subtitle |
|----------------|----------|
| daily_report | Daily Report |
| submittal | Submittal Cover Sheet |
| residential_contract | Residential Contract |
| change_order | Change Order Document |
| rfi | RFI Document |
| far | FAR Document |

## New draft routing (query params)

`contractBuilderToolHref(projectId, undefined, { packKey, documentType })` → `/tools/contract-builder?project=…&packKey=…&documentType=…`

| Action | packKey | documentType |
|--------|---------|--------------|
| New draft CO | `GENERIC_CHANGE_ORDER` | `change_order` |
| New draft RFI | `GENERIC_RFI` | `rfi` |
| New contract | `GENERIC_RESIDENTIAL` | `residential_contract` |
| New submittal | `GENERIC_SUBMITTAL` | `submittal` |
| New daily report | `GENERIC_DAILY_REPORT` | `daily_report` |

## Manual test checklist

Run in the app after deploy:

| Test | Steps | Expected |
|------|-------|----------|
| A. Daily Report | Documents → New daily report → save → return | Under **Documents → Daily Reports**; **not** on Change Orders |
| B. Change Order | Change Orders → New draft CO → save | Under **Change Orders** builder drafts; **not** under Daily Reports |
| C. Submittal | Save submittal draft | **Documents → Submittals** |
| D. RFI | Save RFI draft | **RFIs** builder drafts; **not** Change Orders |

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **209 passed** (30 files), including `projectDocumentDisplay.test.ts` |
| `npm run build` | **Success** (vite production build) |
| `npx tsc -p tsconfig.app.json --noEmit` | **Exit 2** — pre-existing project-wide type debt (e.g. `projectWorkflow.ts`, `proposalKpis.test.ts`); **no new errors** reported in routing/grouping files touched for this fix |
