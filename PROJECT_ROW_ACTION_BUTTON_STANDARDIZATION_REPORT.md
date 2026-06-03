# Project Row Action Button Standardization Report

## Summary

Standardized planner list row actions across RFI, FAR, Change Order, and Documents panels using a shared `ProjectRecordActions` component. All row action groups now use the same button hierarchy (teal primary, outline secondaries, red-outline danger) with no mixed cyan text links in tables.

## Shared action component

**New:** [`src/components/planner/ProjectRecordActions.tsx`](src/components/planner/ProjectRecordActions.tsx)

| Prop | Role |
|------|------|
| `primary` | Single `variant="accent"` button (`onClick` or `as="a"` + `href`) |
| `secondaries` | `variant="outline"` buttons/links |
| `danger` | `variant="outline"` + red text, or filled `danger` when `confirmMode` |

**Helpers:**

- [`src/components/planner/builderDocumentActions.ts`](src/components/planner/builderDocumentActions.ts) — `builderDocumentHrefs()` for Builder + Export URLs
- [`src/components/planner/BuilderDocumentTableActions.tsx`](src/components/planner/BuilderDocumentTableActions.tsx) — inline table cells (RFI/FAR Open/Closed rows)

Uses existing [`Button`](src/components/ui/Button.tsx) variants; no new Button variant added.

## Final button hierarchy

```text
Primary (1×):     accent  — View / Respond | View / Review | Open / Edit
Secondary:        outline — Open in Builder | Export PDF
Danger (optional): outline + red | filled danger on confirm — Delete
```

## Pages updated

| Page / surface | Changes |
|----------------|---------|
| **RFIs** | Legacy **View / Respond** (accent); Open/Closed builder rows use `BuilderDocumentTableActions` (primary + secondaries, no delete); Drafts section via `PlannerBuilderDocumentRow` (full actions + delete) |
| **FARs** | Legacy **View / Review** (accent); builder rows include primary + secondaries + **Delete** (no separate drafts section) |
| **Change Orders** | Legacy **Open / Edit** + **Delete** via `ProjectRecordActions`; builder drafts use `primaryLabel="Open / Edit"` |
| **Documents** | `BuilderDraftsTable` → `PlannerBuilderDocumentRow`; `SimpleDocumentsTable` → **Open / Edit** accent |

## Files changed

| File | Change |
|------|--------|
| `src/components/planner/ProjectRecordActions.tsx` | **New** |
| `src/components/planner/builderDocumentActions.ts` | **New** href helper |
| `src/components/planner/BuilderDocumentTableActions.tsx` | **New** inline builder actions |
| `src/components/planner/PlannerBuilderDocumentRow.tsx` | Uses `ProjectRecordActions` |
| `src/components/planner/documents/panels/RfisDocumentsPanel.tsx` | Legacy + builder row actions |
| `src/components/planner/documents/panels/FarsDocumentsPanel.tsx` | Legacy + builder row actions |
| `src/components/planner/documents/panels/ChangeOrdersDocumentsPanel.tsx` | Legacy CO actions |
| `src/components/planner/documents/documentsPanelUtils.tsx` | `SimpleDocumentsTable` |

## Out of scope (unchanged)

- Supabase schema, save/version/PDF logic, workflow status routing
- `BuilderDocumentReviewDrawer` footer (list rows only)

## Validation results

| Command | Result |
|---------|--------|
| `npm test` | **238 passed** |
| `npm run build` | **Success** |
| `tsc` (touched files) | **No new errors** in action UI files |

## Notes

- RFI Open/Closed builder rows omit **Delete** (delete remains in **RFI Document Drafts** section only).
- FAR builder rows include **Delete** on Open/Closed tables because FAR has no separate drafts section.
- CO legacy **Delete** still opens the existing confirmation modal (row danger button triggers modal, not inline two-step confirm).
