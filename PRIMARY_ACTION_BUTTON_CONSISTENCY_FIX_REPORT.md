# Primary Action Button Consistency Fix Report

## Summary

Secondary “new/create” buttons on QC Reports and Change Orders now use the same teal **accent** primary style as their sibling create actions on each page.

## Buttons updated

| Page | Button | Before | After |
|------|--------|--------|-------|
| Documents → QC Reports | New checklist | `variant="outline"` | `variant="accent"` |
| Change Orders | New draft CO | `variant="outline"` | `variant="accent"` (+ `Plus` icon to match New change order) |

## Unchanged (already teal)

- **New QC report** — `variant="accent"` in `QcReportsDocumentsPanel`
- **New change order** — `variant="accent"` in `ChangeOrdersDocumentsPanel`

## Files changed

- [`src/components/planner/documents/panels/QcReportsDocumentsPanel.tsx`](src/components/planner/documents/panels/QcReportsDocumentsPanel.tsx)
- [`src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx`](src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx)

## Behavior

- **New checklist** — still navigates to `concreteInspectionToolHref(projectId)`
- **New draft CO** — still navigates to Document Builder with `GENERIC_CHANGE_ORDER` / `change_order`
- Labels, routing, and permissions unchanged

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **264 passed** (43 files) |
| `npm run build` | **Success** |
