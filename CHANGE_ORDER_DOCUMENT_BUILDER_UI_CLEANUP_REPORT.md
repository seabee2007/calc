# Change Order Document Builder — UI Cleanup Report

**Date:** June 3, 2026  
**Status:** ✅ Complete — build passes

---

## 1. Duplicate Title Fix

### Problem
The top **"Contract title"** card and the questionnaire's **"Change order title"** field both fed the same preview title, causing confusion.

### Fix
- `DocumentMetaPanel.tsx` — Added `isChangeOrder?: boolean` prop. When `true`, the "Contract title" `<Input>` is **hidden** and the heading changes to "New document" / "Saved document".
- `DocumentBuilderPage.tsx` — Passes `isChangeOrder={isChangeOrderDocument}` to `DocumentMetaPanel`.
- `DocumentBuilderPage.tsx` — Added a `useEffect` that syncs the internal `title` state from `answers.changeOrderTitle` whenever the document type is `change_order`. This ensures **Save Draft** uses the CO title correctly and the saved-docs list displays the CO title.
- Saved-documents list remains fully functional for Change Orders.

**Residential contracts**: No change — "Contract title" input still visible and required.

---

## 2. Revised Contract Amount — Auto-Calculated, Not User Input

### Problem
`revisedContractAmount` was a manual text field in the questionnaire, but it should only ever be a calculated value.

### Fix
- `changeOrder/questions.ts` — Removed the `revisedContractAmount` question entirely.
- The preview adapter (`changeOrderPreviewAdapter.ts`) already auto-calculates the revised total from:
  ```
  originalContractAmount + previouslyApprovedChangeOrders + totalChangeOrderAmount
  ```
  When `revisedContractAmount` is absent from answers, `num()` returns 0 and the auto-calc path runs automatically.
- The `ChangeOrderDocument` preview still shows "Revised contract value" as a calculated read-only row.
- If `originalContractAmount` is not provided, the preview shows "Original contract amount not provided."

---

## 3. Cost Backup Toggle — Clear Label and Helper Text

### Problem
"Cost breakdown available" was an opaque boolean with no explanation.

### Fix (`changeOrder/questions.ts`):
- **Renamed label**: "Cost backup attached or available?"
- **Added `helperText`**: "Turn on if labor, material, equipment, subcontractor, or vendor backup is attached or available for client review. Leaving this off when a total is entered will trigger a cost-backup recommendation."
- **Moved from** `pricing` group (advanced) **to** `change_management` group (standard).
- Behavior unchanged: when `OFF` and `totalChangeOrderAmount > 0`, the adapter appends a cost-backup advisory to the change order terms, and the recommendation engine triggers a `co.cost_backup_required` recommendation.

---

## 4. Field Order Changes

The Change Order questionnaire was reorganized into the following logical groups:

### Quick mode
| # | Field | Group |
|---|-------|-------|
| 1 | Change order title *(required)* | Scope |
| 2 | Scope of change *(required)* | Scope |
| 3 | Reason for change *(required)* | Scope |
| 4 | Total change order amount *(required)* | Pricing |
| 5 | Schedule impact | Schedule |

### Standard mode
| # | Field | Group |
|---|-------|-------|
| 6 | Requested by | Scope |
| 7 | RFI or FAR reference *(moved from advanced change_management)* | Scope |
| 8 | Description of added work | Scope |
| 9 | Description of deleted work | Scope |
| 10 | Exclusions | Scope |
| 11 | Original contract amount *(moved from advanced)* | Pricing |
| 12 | Previously approved change orders *(moved from advanced)* | Pricing |
| 13 | Additional calendar days | Schedule |
| 14 | Revised completion date | Schedule |
| 15 | Approval required before work starts | Change Management |
| 16 | Cost backup attached or available? *(moved from advanced pricing)* | Change Management |
| 17 | Additional terms or conditions | Execution |

### Advanced mode
| # | Field | Group |
|---|-------|-------|
| 18 | Emergency work *(moved from risk)* | Change Management |
| 19 | Hidden or unforeseen field condition *(moved from risk)* | Change Management |
| 20 | Owner-requested scope change *(moved from risk)* | Change Management |

**Removed:** `revisedContractAmount`, `parties` group (was only used by `requestedBy`, now moved to Scope)

---

## 5. Compliance Changes

### `complianceRegistry.ts`
- Removed `co.pricing_summary` from `requiredClauseKeys` — this clause is optional and its absence was triggering false blocker warnings when pricing was incomplete.
- Kept `requiredClauseKeys: ['co.title', 'co.scope']` — these are always present in an assembled CO.
- `questionnaireModeForValidation` remains `'standard'` so the compliance engine validates all quick+standard mode required fields (`changeOrderTitle`, `scopeOfChange`, `reasonForChange`, `totalChangeOrderAmount`) without touching residential-contract-only fields.

---

## 6. `helperText` Support Added

- `types.ts` — Added optional `helperText?: string` to `DocumentQuestion` interface.
- `IntakePanel.tsx` — Boolean toggle renderer now displays `q.helperText` as a small muted line below the toggle.
- `IntakePanel.tsx` — Text/number/date inputs pass `q.helperText` as the fallback helper (after prefill-source labels and deposit-warning overrides).

---

## 7. Build Result

```
✓ 3199 modules transformed.
✓ built in 21.35s
```

No TypeScript errors. No new warnings.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/documents/ui/panels/DocumentMetaPanel.tsx` | Added `isChangeOrder` prop; hide Contract title input for CO |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Pass `isChangeOrder`; sync title from `changeOrderTitle` answer |
| `src/features/documents/packs/changeOrder/questions.ts` | Full reorganization; removed `revisedContractAmount`; renamed/moved `costBreakdownAvailable`; added `helperText` to multiple fields |
| `src/features/documents/types.ts` | Added `helperText?: string` to `DocumentQuestion` |
| `src/features/documents/ui/panels/IntakePanel.tsx` | Render `helperText` for boolean toggles and text inputs |
| `src/features/documents/registry/complianceRegistry.ts` | Removed `co.pricing_summary` from required clause keys |

---

## Remaining Limitations

- **Multi-select RFI/FAR**: The current RFI/FAR dropdown supports one selection at a time. Multi-select can be added in a future pass.
- **Auto-populate originalContractAmount from project**: Currently the user must type it manually in Standard mode. A future enhancement could pull `project.baseContractValue` as a prefill default.
