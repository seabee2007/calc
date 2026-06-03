# Documents Page Workflow Tab Cleanup Report

## Summary

Removed duplicate workflow tabs (RFIs, FARs, Change Orders) from the project **Documents** page inner tab bar. The page now shows only document/file categories. Top-level project navigation and builder-draft routing are unchanged.

---

## Files changed

| File | Change |
|------|--------|
| `src/components/planner/documents/documentsTabConfig.ts` | Reduced `DOCUMENTS_TAB_IDS` from 10 to 7; removed workflow labels; `documentsTabFromHighlightParams` maps only `contract`, `safety`, `inspection` |
| `src/pages/planner/PlannerDocumentsPage.tsx` | Removed workflow data loading, state, panels, and switch cases; simplified `tabCounts` to 7 categories |
| `src/components/planner/documents/documentsTabConfig.test.ts` | Updated tests for 7 tabs, legacy slug fallback, document-only highlights |

## Files unchanged (by design)

| File | Reason |
|------|--------|
| `src/components/planner/PlannerPlanHeader.tsx` | Top project tabs unchanged |
| `src/pages/planner/PlannerRFIsPage.tsx` | Standalone RFIs page |
| `src/pages/planner/PlannerAdjustmentsPage.tsx` | Standalone FARs page |
| `src/pages/planner/PlannerChangeOrdersPage.tsx` | Standalone Change orders page |
| `src/components/planner/documents/panels/RfisDocumentsPanel.tsx` | Still used by RFIs page |
| `src/components/planner/documents/panels/FarsDocumentsPanel.tsx` | Still used by FARs page |
| `src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx` | Still used by Change orders page |
| `src/services/projectDocumentDisplay.ts` | Builder draft filtering unchanged |
| `src/utils/plannerRoutes.ts` | Route helpers unchanged |
| Supabase schema, save logic, PDF export, `contractBuilderToolHref` | Out of scope |

---

## Tabs removed from Documents page

| Removed tab slug | Label |
|------------------|-------|
| `rfis` | RFIs |
| `fars` | FARs |
| `change-orders` | Change Orders |

## Documents page tabs (after cleanup)

| Tab slug | Label |
|----------|-------|
| `contracts` (default) | Contracts |
| `submittals` | Submittals |
| `daily-reports` | Daily Reports |
| `qc-reports` | QC Reports |
| `safety-meetings` | Safety Meetings |
| `punch-lists` | Punch Lists |
| `closeout` | Closeout |

All seven tabs remain always visible with existing empty states in each panel.

---

## Top project tabs — unchanged

[`PlannerPlanHeader.tsx`](src/components/planner/PlannerPlanHeader.tsx) still shows:

- Board
- Charts
- Schedule
- Documents
- RFIs
- FARs
- Change orders
- Team

---

## Routing confirmation

Builder drafts are filtered by [`isDocumentsTabBuilderDocument`](src/services/projectDocumentDisplay.ts) before grouping on the Documents page. Workflow types appear only on their dedicated planner pages.

| Effective `document_type` / pack | Destination |
|----------------------------------|-------------|
| `rfi` / `GENERIC_RFI` | Project **RFIs** tab (`/planner/rfis`) |
| `far`, `work_authorization` | Project **FARs** tab (`/planner/adjustments`) |
| `change_order` / `GENERIC_CHANGE_ORDER` | Project **Change orders** tab (`/planner/change-orders`) |
| `daily_report` | Documents → Daily Reports |
| `submittal` | Documents → Submittals |
| `qc_report` | Documents → QC Reports |
| `punch_list` | Documents → Punch Lists |
| `warranty_letter` / closeout packs | Documents → Closeout |

Open/edit and PDF export still use `contractBuilderToolHref` via [`PlannerBuilderDocumentRow`](src/components/planner/PlannerBuilderDocumentRow.tsx).

### Legacy URLs

- `?tab=rfis`, `?tab=fars`, `?tab=change-orders` → fall back to **Contracts** (`parseDocumentsTab`).
- `?rfi=` / `?adjustment=` on the Documents URL no longer auto-select a removed inner tab; use `plannerRfiHref` / `plannerAdjustmentHref` for workflow deep links.

### Highlight → tab (Documents page only)

| Query param | Inner tab |
|-------------|-----------|
| `contract` | Contracts |
| `safety` | Safety Meetings |
| `inspection` | QC Reports |

---

## Tab counts

Documents tab bar counts include only the seven document/file categories. RFI, FAR, and Change Order counts are no longer computed or displayed on the Documents inner tab row.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 35 files, **225** tests |
| `npm run build` | **Pass** — Vite production build completed |

---

## Date

2026-06-03
