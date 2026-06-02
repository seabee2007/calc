# Change Order Clause Duplication Fix Report

**Date:** June 3, 2026  
**Status:** ✅ Complete — build passes

---

## What Duplicated

In the Change Order Document Builder, Change Management toggles **and** accepted Recommended Clauses were both appending similar legal language to `order.terms`, which rendered under **Additional terms** in `ChangeOrderDocument`.

Example:
- Turning on **Approval required before work starts** auto-appended approval-before-work language.
- Accepting **Approval Before Work Clause** appended nearly identical language again.

The same pattern affected:
- `emergencyWork` ↔ `co.emergency_work_docs`
- `costBreakdownAvailable` (off) ↔ `co.cost_backup_required`

The default **Terms** section in `ChangeOrderDocument` (`CHANGE_ORDER_APPROVAL_STATEMENT`) was unaffected and remains the sole default approval statement.

---

## What Was Changed

### 1. `changeOrderPreviewAdapter.ts` — terms building

**Removed** automatic clause text from toggles in `buildTerms`:
- `approvalRequiredBeforeWorkStarts`
- `emergencyWork`
- `costBreakdownAvailable`

**Kept** only:
1. User-entered `answers.terms`
2. RFI/FAR reference line (`Related reference: …`)
3. Accepted recommended clause text from `ACCEPTED_CLAUSE_TEXT`

**Added** `uniqueTerms()` helper to dedupe parts (case-insensitive trim match) before joining.

**Updated** `ACCEPTED_CLAUSE_TEXT` copy to match the canonical recommended clause wording (e.g. approval clause now starts with “Work described in this Change Order…”).

### 2. `recommendationEngine.ts` — trigger vs clause copy

Updated CO recommendation `reason` strings to explain that toggles **trigger** recommendations and acceptance **adds language to Additional Terms** — avoiding repetition of full clause text in the recommendation UI.

### 3. `packs/changeOrder/clauses.ts` — display titles

Added optional recommended-clause entries to the CO pack catalog so CompliancePanel shows clear titles:
- Approval Before Work Clause
- Emergency Work Documentation Clause
- Concealed Condition Clause
- Owner Requested Scope Clause
- Cost Backup Clause
- Schedule Adjustment Clause

These are **not** in the document template; they exist for catalog lookup and consistent naming only.

### 4. Unchanged

- `ChangeOrderDocument.tsx` — default Terms statement unchanged
- `questions.ts` — toggles still drive `riskSignals` and recommendation triggers
- Planner Change Order Builder — uses separate builder path, not this adapter
- Pricing math, Supabase, residential contract behavior, public signing

---

## Toggles That Now Only Trigger Recommendations

| Toggle | Triggers recommendation | Adds terms text automatically? |
|--------|-------------------------|--------------------------------|
| `approvalRequiredBeforeWorkStarts` | `co.approval_before_work` | No |
| `emergencyWork` | `co.emergency_work_docs` | No |
| `fieldCondition` | `co.concealed_condition` | No (factual note still in Reason for change) |
| `ownerRequestedChange` | `co.owner_requested_scope` | No (factual note still in Reason for change) |
| `costBreakdownAvailable` (off + total > 0) | `co.cost_backup_required` | No |

Schedule fields (`additionalCalendarDays`, `revisedCompletionDate`) still trigger `co.schedule_adjustment` without auto-appending terms text.

---

## How Accepted Clauses Render

1. User turns on a toggle → recommendation appears in Compliance panel.
2. Preview **Additional terms** stays unchanged until the user clicks **Accept**.
3. On accept → clause key maps through `ACCEPTED_CLAUSE_TEXT` → appended once to `order.terms`.
4. `uniqueTerms()` prevents duplicate blocks if the same text would appear twice.
5. Default **Terms** section always shows the standard signing acknowledgment separately from **Additional terms**.

---

## Acceptance Test Matrix

| Step | Expected |
|------|----------|
| Turn on Approval required before work starts | Recommendation appears; preview has no approval clause yet |
| Accept Approval Before Work Clause | Approval language appears once in Additional terms |
| Turn on Emergency work | Recommendation appears; no emergency clause in preview yet |
| Accept Emergency Work Documentation Clause | Emergency language appears once |
| All toggles on + all clauses accepted | Each clause appears once; no repeated approval/emergency text |
| Toggle off | Recommendation disappears (rule `when` no longer matches); accepted clauses remain per existing accept/reject rules |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/documents/ui/adapters/changeOrderPreviewAdapter.ts` | Removed toggle-driven terms; added `uniqueTerms`; updated clause copy |
| `src/features/documents/engine/recommendationEngine.ts` | Clearer trigger-focused recommendation reasons |
| `src/features/documents/packs/changeOrder/clauses.ts` | Optional recommended-clause catalog entries for UI titles |

---

## Build Result

```
✓ 3199 modules transformed.
✓ built in 20.95s
```

No TypeScript errors.
