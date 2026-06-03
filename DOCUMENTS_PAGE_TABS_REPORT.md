# Documents Page Tabbed UX Report

## Summary

The project **Documents** page ([`PlannerDocumentsPage.tsx`](src/pages/planner/PlannerDocumentsPage.tsx)) now uses a horizontal tab bar instead of stacking all document sections vertically. One section renders at a time; the active tab syncs to `?tab=` in the URL. Count badges show on each tab label when items exist.

**Unchanged:** Database, document save/versioning, preview/PDF, builder routes, top planner nav links (`Documents`, `RFIs`, `FARs`, `Change orders`).

---

## Files created

| File | Purpose |
|------|---------|
| `src/components/planner/documents/documentsTabConfig.ts` | Tab ids, labels, `parseDocumentsTab`, highlight → tab mapping |
| `src/components/planner/documents/documentsTabConfig.test.ts` | Unit tests for tab parsing |
| `src/components/planner/documents/PlannerDocumentsTabBar.tsx` | Scrollable cyan underline tab bar |
| `src/components/planner/documents/documentsPanelUtils.tsx` | Shared tables, dates, panel footnote |
| `src/components/planner/documents/useDocumentsSearchParams.ts` | Preserve `tab` when RFI/FAR drawers update URL |
| `src/components/planner/documents/panels/ContractsDocumentsPanel.tsx` | Contracts list |
| `src/components/planner/documents/panels/SubmittalsDocumentsPanel.tsx` | Submittals |
| `src/components/planner/documents/panels/DailyReportsDocumentsPanel.tsx` | Daily reports |
| `src/components/planner/documents/panels/QcReportsDocumentsPanel.tsx` | QC reports + field checklists |
| `src/components/planner/documents/panels/SafetyMeetingsDocumentsPanel.tsx` | Safety meetings |
| `src/components/planner/documents/panels/PunchListsDocumentsPanel.tsx` | Punch lists |
| `src/components/planner/documents/panels/CloseoutDocumentsPanel.tsx` | Closeout/warranty + Other |
| `src/components/planner/documents/panels/RfisDocumentsPanel.tsx` | Workflow RFIs + builder drafts |
| `src/components/planner/documents/panels/FarsDocumentsPanel.tsx` | FARs |
| `src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx` | Change orders + builder drafts |

## Files changed

| File | Change |
|------|--------|
| `src/pages/planner/PlannerDocumentsPage.tsx` | Tabbed layout, unified data load, single active panel |
| `src/pages/planner/PlannerRFIsPage.tsx` | Thin wrapper around `RfisDocumentsPanel` |
| `src/pages/planner/PlannerAdjustmentsPage.tsx` | Thin wrapper around `FarsDocumentsPanel` |
| `src/pages/planner/PlannerChangeOrdersPage.tsx` | Thin wrapper around `ChangeOrdersDocumentsPanel` |
| `src/utils/plannerRoutes.ts` | `plannerDocumentsHref` supports `tab`, `rfiId`, `adjustmentId` |

---

## Tab architecture

| Query `tab` | Label | Content |
|-------------|-------|---------|
| `contracts` (default) | Contracts | Residential/signed contracts |
| `submittals` | Submittals | Builder submittal drafts |
| `daily-reports` | Daily Reports | Builder daily reports |
| `qc-reports` | QC Reports | Builder QC reports + concrete inspection checklists |
| `safety-meetings` | Safety Meetings | Safety meeting tool records |
| `punch-lists` | Punch Lists | Punch list builder drafts |
| `closeout` | Closeout | Warranty/closeout + optional Other block |
| `rfis` | RFIs | RFI workflow + builder RFI drafts |
| `fars` | FARs | Field adjustment requests |
| `change-orders` | Change Orders | Workflow COs + builder CO drafts |

All tabs are always visible (empty states inside each panel).

---

## Default tab behavior

- Missing or invalid `?tab=` → **Contracts** (`contracts`).
- Deep links with highlights auto-select tab:
  - `?contract=` → Contracts
  - `?safety=` → Safety Meetings
  - `?inspection=` → QC Reports
  - `?rfi=` → RFIs
  - `?adjustment=` → FARs

---

## Query params

**Added:** `?tab={slug}` (e.g. `?tab=punch-lists`).

**Preserved:** `contract`, `safety`, `inspection`, `file`, `rfi`, `adjustment` (drawers on RFI/FAR tabs keep `tab` when embedded on Documents page).

**Example:** `/projects/{id}/planner/documents?tab=rfis&rfi={uuid}`

`plannerDocumentsHref(projectId, { tab: 'daily-reports', safetyMeetingId: '...' })` sets both params.

---

## Mobile behavior

- Tab row: `overflow-x-auto` with `shrink-0` buttons (same pattern as [`PlannerPlanHeader`](src/components/planner/PlannerPlanHeader.tsx)).
- Active tab: cyan bottom border + semibold label.
- Tables: existing `PLANNER_TABLE_WRAPPER` horizontal scroll.
- Panel actions: top-right “New …” via `PanelActionRow`.

---

## Count badges

Enabled: tab labels show counts when &gt; 0, e.g. `Submittals (2)`. QC Reports count includes builder QC rows + inspection checklists; RFIs/FARs/CO counts include workflow + builder draft rows where applicable.

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **224 passed** (35 files) |
| `npm run build` | **Success** |

---

## Manual acceptance

1. Open project → Documents → default **Contracts** tab.
2. Switch tabs; only one section visible.
3. Refresh with `?tab=punch-lists` → stays on Punch Lists.
4. New punch list / RFI / etc. buttons still navigate to correct tools.
5. `/planner/rfis` route still works (standalone page with same panel).
