# Document UI Label and Inline Delete Report

## Summary

Project document UI now shows human-readable labels for stored enum values and uses consistent inline delete confirmation on builder document rows (no modal).

## 1. Human label helper

**New:** [`src/utils/formatEnumLabel.ts`](src/utils/formatEnumLabel.ts)

- `null` / empty → `—`
- Known maps: `not_completed` → Not Completed, `under_review` → Under Review, etc.
- Generic `snake_case` / `kebab-case` → title case (`6_months` → 6 Months)
- Preserves already-readable strings (e.g. `Under Review`, `6 Months`)
- **Does not** change stored values

**Tests:** [`src/utils/formatEnumLabel.test.ts`](src/utils/formatEnumLabel.test.ts)

### Applied in

| Location | Usage |
|----------|--------|
| [`plannerDocumentFormat.ts`](src/components/planner/documents/plannerDocumentFormat.ts) | `formatPlannerDisplayValue` / `answerDisplayValue` for drawer key details |
| [`builderWorkflowStatus.ts`](src/services/builderWorkflowStatus.ts) | Unknown workflow status fallback |
| [`FieldRecordStatusBadge.tsx`](src/components/field/FieldRecordStatusBadge.tsx) | Badge text when raw enum slips through |

Drawer and key details now show **Not Completed**, **Not Applicable**, **6 Months**, etc.

## 2. Inline delete confirm

**Existing:** [`ProjectRecordActions.tsx`](src/components/planner/ProjectRecordActions.tsx) — Delete → **Confirm delete** + **Cancel** in the same row (no modal).

**New:** [`useBuilderDocumentDelete.ts`](src/components/planner/useBuilderDocumentDelete.ts) — shared delete + confirm logic with optional parent-controlled confirm id.

**Pattern:**

```text
Review | Open in Builder | Export PDF | Delete
→ Review | Open in Builder | Export PDF | Confirm delete | Cancel
```

- Only one row in confirm mode per table (parent tracks `deleteConfirmDocId`)
- Success/error toast via portal after confirm delete
- [`BuilderDraftsTable`](src/components/planner/documents/documentsPanelUtils.tsx), RFI/FAR draft sections, Change Order builder drafts wire controlled confirm

**Unchanged:** Legacy change order delete still uses its existing modal (workflow Supabase CO rows).

## Files changed

- `src/utils/formatEnumLabel.ts` (new)
- `src/utils/formatEnumLabel.test.ts` (new)
- `src/components/planner/useBuilderDocumentDelete.ts` (new)
- `src/components/planner/documents/plannerDocumentFormat.ts`
- `src/components/planner/PlannerBuilderDocumentRow.tsx`
- `src/components/planner/BuilderDocumentTableActions.tsx`
- `src/components/planner/documents/documentsPanelUtils.tsx`
- `src/components/planner/documents/documentsPanelUtils.test.ts`
- `src/services/builderWorkflowStatus.ts`
- `src/components/field/FieldRecordStatusBadge.tsx`
- `src/components/planner/documents/panels/RfisDocumentsPanel.tsx`
- `src/components/planner/documents/panels/FarsDocumentsPanel.tsx`
- `src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx`

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **264 passed** (43 files) |
| `npm run build` | **Success** |

## Known limitations

- Long free-text answers are formatted lightly; strings with spaces and capitals are left as-is.
- Legacy change order delete modal remains for non-builder CO records.
- Open/Closed RFI/FAR builder rows have no Delete (drafts only).
