# Change Order Workflow Consolidation Report

## Summary

Project → **Change Orders** now has a single create path: **New change order** (Planner CO builder with official `CO-###` numbering). The duplicate **New draft CO** action (Document Builder) was removed from that page. Existing Document Builder CO drafts remain visible under a **legacy** section only when present, with clearer labeling. Document Builder shows an optional guidance banner when editing a change order with a project selected.

## UX decisions

| Area | Decision |
|------|----------|
| Create on Change Orders page | Only **New change order** → `openNewChangeOrder` / `ChangeOrderBuilderPage` |
| Document Builder CO entry | Removed from Change Orders page; Tools → Contract & Document Builder still supports `GENERIC_CHANGE_ORDER` |
| Legacy builder drafts | Shown only when `builderCoDrafts.length > 0`; no empty state or create CTA |
| Row subtitles | `Document Builder · Document Builder Draft` (was `Change Order Document`) |
| Document Builder | Info banner + link to Planner Change Orders when CO type + project linked; no auto-redirect |

## Files changed

- [`src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx`](src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx) — removed **New draft CO** and `contractBuilderToolHref`; conditional legacy section with title and helper text
- [`src/services/projectDocumentDisplay.ts`](src/services/projectDocumentDisplay.ts) — `change_order` `subtitleLabel` → **Document Builder Draft**
- [`src/features/documents/ui/DocumentBuilderPage.tsx`](src/features/documents/ui/DocumentBuilderPage.tsx) — cyan info banner with `plannerChangeOrdersHref` link when `isChangeOrderDocument && selectedProject`

## Unchanged (per plan)

- Supabase schema, pricing, `fetchChangeOrdersForProject`, CO numbering service
- Official CO table, void/delete modal, `ProjectDocumentDrawer` for legacy drafts
- Documents tab filtering (`isDocumentsTabBuilderDocument`)
- Tab badge counts may still include legacy builder CO drafts
- Document Builder pack dropdown still lists Generic Change Order

## Acceptance checks

| Check | Expected | Status |
|-------|----------|--------|
| Change Orders create buttons | Only **New change order** | Done |
| New change order route | `/projects/:id/planner/change-orders/new` | Unchanged |
| **New draft CO** on Change Orders | Not shown | Done |
| Official COs table | Unchanged; `CO-###` display | Unchanged |
| Legacy builder CO drafts | Listed when present; drawer/delete/Open in Builder | Unchanged |
| Documents tab | No CO drafts (existing filter) | Unchanged |

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **264 passed** (43 files) |
| `npm run build` | **Success** |
