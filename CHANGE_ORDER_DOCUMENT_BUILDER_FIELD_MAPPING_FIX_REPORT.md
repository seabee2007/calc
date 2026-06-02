# Change Order Document Builder — Field Mapping Fix Report

## Build result

```
✓ 3199 modules transformed.
✓ built in 19.28s
Exit code: 0
```

No build errors. One pre-existing dynamic-import advisory warning (unrelated to this change).

---

## Files changed

| File | Change |
|---|---|
| `src/features/documents/packs/changeOrder/questions.ts` | Added `terms` question (group `execution`, mode `standard`) |
| `src/features/documents/ui/adapters/changeOrderPreviewAdapter.ts` | Full rewrite with composite field mappings, project/answer fallbacks, contract value overrides |
| `src/components/change-order/ChangeOrderDocument.tsx` | Pricing display fix: use `order.total` when line item arrays are all empty |

---

## Complete field mapping table

| UI Label | Answer Key | Maps To | Status | Notes |
|---|---|---|---|---|
| Change order title | `changeOrderTitle` / `title` | `order.title` | ✅ Fixed | Title fallback chain: `title` arg → `changeOrderTitle` → `title` answer key |
| CO number | `changeOrderNumber` | `order.displayNumber` | ✅ Working | Fallback to `'Draft'` |
| Status | `status` | `order.status` | ✅ Working | Validated against `CHANGE_ORDER_STATUSES` union |
| Scope of change | `scopeOfChange` (or `scope`) | `order.scopeDescription` | ✅ Fixed | Now part of composite |
| Added work | `addedWork` | `order.scopeDescription` (composite) | ✅ **NEW** | Appended as "Added: …" |
| Deleted / removed work | `deletedWork` | `order.scopeDescription` (composite) | ✅ **NEW** | Appended as "Removed: …" |
| Exclusions | `exclusions` | `order.scopeDescription` (composite) | ✅ **NEW** | Appended as "Exclusions: …" |
| Reason for change | `reasonForChange` | `order.reasonForChange` | ✅ Fixed | Now part of composite |
| Requested by | `requestedBy` | `order.reasonForChange` (composite) | ✅ **NEW** | Appended as "Requested by: Owner / Client" etc. |
| Schedule impact | `scheduleImpact` | `order.scheduleImpact` | ✅ Fixed | Now part of composite |
| Additional calendar days | `additionalCalendarDays` | `order.scheduleImpact` (composite) | ✅ **NEW** | Appended as "+N calendar day(s)" |
| Revised completion date | `revisedCompletionDate` | `order.scheduleImpact` (composite) | ✅ **NEW** | Appended as "Revised completion: …" |
| Total CO amount | `totalChangeOrderAmount` | `order.total` + client display | ✅ **FIXED** | Preview now shows `order.total` when line items empty |
| Additional terms or conditions | `terms` | `order.terms` | ✅ **NEW** | New question added + adapter mapping |
| Contractor name (sig) | `contractorName` | `order.contractorName` | ✅ **NEW** | Signature block contractor field |
| Client name (sig) | `clientName` | `order.clientName` | ✅ **NEW** | Signature block client field |
| Project name (text input) | `project` | `context.project.name` | ✅ **FIXED** | Answer fallback when no project selected |
| Project name (store) | `selectedProject.name` | `context.project.name` | ✅ Working | Takes precedence over answer key |
| Project address | `selectedProject.jobsiteAddress` | `context.project.address` | ✅ Working | Safe-formatted; empty string on missing |
| Client name (store) | `selectedProject.clientInfo.clientName` | `context.project.clientName` | ✅ Working | |
| Contractor | `companySettings.companyName` | `context.project.contractorName` | ✅ Working | |
| Original contract amount | `originalContractAmount` | `context.contractValues.original` | ✅ **NEW** | Synthetic project stub when no project selected |
| Previously approved COs | `previouslyApprovedChangeOrders` | `context.contractValues.previousApproved` | ✅ **NEW** | Part of synthetic stub |
| Revised contract amount | `revisedContractAmount` | `context.contractValues.currentContract` | ✅ **NEW** | Part of synthetic stub |

---

## Fields intentionally unmapped (by design)

| Answer Key | Reason |
|---|---|
| `approvalRequiredBeforeWorkStarts` | Risk signal only; no rendering target in `ChangeOrderDocument` |
| `costBreakdownAvailable` | Risk/compliance scoring only |
| `emergencyWork` | Risk/compliance scoring only |
| `fieldCondition` | Risk scoring only |
| `ownerRequestedChange` | Risk scoring only |
| `rfiFarReference` | No rendering section in `ChangeOrderDocument`; could be appended to terms in a future pass |

---

## Known remaining limitations (by design)

- **Line item tables** (labor / material / equipment / subcontractor breakdown) are always empty in Document Builder mode — the full line-item editor lives in Planner → Change Orders. This is expected.
- **Signatures** in Document Builder preview always show "Not signed" — signing happens only via the Planner Change Order public-token flow.

---

## Composite field logic summary

### `scopeDescription`
```
scopeOfChange (or scope)
+ "Added: {addedWork}"       (when present)
+ "Removed: {deletedWork}"   (when present)
+ "Exclusions: {exclusions}" (when present)
```
Parts joined with `\n\n`.

### `scheduleImpact`
```
scheduleImpact (free text)
+ "+N calendar day(s)"        (when additionalCalendarDays > 0)
+ "Revised completion: {date}" (when revisedCompletionDate present)
```
Parts joined with ` · `. Returns `null` when empty (hidden section).

### `reasonForChange`
```
reasonForChange (free text)
+ "Requested by: {human label}" (when requestedBy present)
```
Parts joined with ` · `.

### Contract values override
When a project is selected and has `baseContractValue` or `currentContractValue`, project data wins.
When no project is selected and `originalContractAmount` > 0, a synthetic stub is built from
`originalContractAmount`, `previouslyApprovedChangeOrders`, and `revisedContractAmount` answers.
