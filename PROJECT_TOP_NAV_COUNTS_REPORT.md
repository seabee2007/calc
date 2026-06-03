# Project Top Nav Count Badges Report

## Summary

First-level project planner tabs in [`PlannerPlanHeader.tsx`](src/components/planner/PlannerPlanHeader.tsx) now show record counts in parentheses when count &gt; 0 (e.g. `Documents (7)`). Counts load in the background and do not block navigation.

---

## Files changed

| File | Change |
|------|--------|
| `src/utils/formatTabLabel.ts` | Shared `formatTabLabel(label, count?)` helper |
| `src/utils/formatTabLabel.test.ts` | Unit tests for label formatting |
| `src/services/projectTabCounts.ts` | `countProjectDocumentsNavTotal` — Documents tab total |
| `src/services/projectTabCounts.test.ts` | Tests for documents total and CO/RFI/FAR exclusion |
| `src/hooks/useProjectTabCounts.ts` | Parallel fetches for tab counts; safe per-source errors |
| `src/components/planner/PlannerPlanHeader.tsx` | `countKey` on tabs; hook + `formatTabLabel` in nav |
| `src/components/planner/documents/documentsTabConfig.ts` | `documentsTabLabel` delegates to `formatTabLabel` |

## Files unchanged

- `PlannerPlanHeader` top tab list (Board, Charts, Schedule, Documents, RFIs, FARs, Change orders, Team)
- Supabase schema, save logic, `plannerRoutes`, PDF, builder workflows
- Documents inner tab bar (`PlannerDocumentsTabBar`)
- `PlannerTabNav.tsx`, `PlannerProjectHeader.tsx` (not mounted in routes)

---

## Count sources

| Tab | Count key | Source |
|-----|-----------|--------|
| Board | `board` | `bundle.tasks.length` from `PlannerProjectContext` (only if &gt; 0) |
| Charts | — | No count |
| Schedule | `schedule` | `fetchScheduleEventsForProject(projectId).length` |
| Documents | `documents` | `countProjectDocumentsNavTotal` (see below) |
| RFIs | `rfis` | `fetchRfisForProject` + `listProjectRfiBuilderDocuments` |
| FARs | `fars` | `fetchAdjustmentsForProject` only |
| Change orders | `changeOrders` | `fetchChangeOrdersForProject` + `listProjectChangeOrderBuilderDocuments` |
| Team | `team` | `fetchAssignmentsForProject` (project assignments) |

Hook refreshes when `projectId`, `userId`, `bundle`, or `location.pathname` changes.

---

## Count filtering rules

### Label display

- `formatTabLabel`: append ` (n)` only when `count > 0`
- Zero, undefined, or failed fetch → plain label (no `(0)`)

### Documents count exclusion

`countProjectDocumentsNavTotal` uses [`filterDocumentsTabBuilderDocuments`](src/services/projectDocumentDisplay.ts), which skips:

- `rfi` / `GENERIC_RFI`
- `far`, `work_authorization`
- `change_order` / `GENERIC_CHANGE_ORDER`

Included in Documents total:

- All other builder document groups (contracts, submittals, daily reports, QC reports, punch lists, closeout, other)
- Safety meetings (`listSafetyMeetingsForProject`)
- Concrete inspection checklists (`listConcreteInspectionsForProject`)

This matches the sum of inner Documents page category counts.

### Workflow tabs

- **RFIs** and **Change orders** include workflow records plus builder drafts (same as their dedicated pages).
- **FARs** include workflow adjustments only (no FAR builder-draft list on the FAR page today).

---

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **Pass** — 37 files, **229** tests |
| `npm run build` | **Pass** — Vite production build completed |
| `npx tsc -p tsconfig.app.json --noEmit` | **Fails** — pre-existing errors elsewhere; **no new errors** in count helper/nav files after removing unused `React` import in `PlannerPlanHeader` |

---

## Known limitations

1. **No live sync** — Counts refresh on planner route change and initial load, not on every in-page save (navigate away and back, or full reload, to refresh).
2. **List queries, not COUNT(\*)** — Uses existing list endpoints; acceptable for typical project sizes.
3. **FAR builder drafts** — `far` / `work_authorization` builder rows are excluded from Documents but not added to the FAR tab count (FAR page does not list them).
4. **Team vs header avatars** — Team count uses `employee_project_assignments`; owner header avatars may show employer-wide team profiles from context, which can differ from assignment count.
5. **Per-source failures** — If one fetch fails, that tab shows no count; other tabs still update.

---

## Date

2026-06-03
