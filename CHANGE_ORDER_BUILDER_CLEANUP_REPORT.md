# Change Order Document Builder — Cleanup & Field Wiring Report

## Build result

```
✓ 3199 modules transformed.
✓ built in 19.42s
Exit code: 0
```

---

## Root cause (resolved)

`contractInput.ts` line 189 hardcoded `documentType: 'residential_contract'` unconditionally.
This caused three cascading bugs:

1. Compliance engine used residential questionnaire → `priceModel` required warning
2. Recommendation engine had no `documentType` in context → residential addendum rules appeared for CO docs
3. `buildChangeOrderPreviewFromDocumentAnswers` never received `accepted` → accepted clauses ignored

---

## Files changed

| File | Change |
|---|---|
| `src/features/documents/ui/contractInput.ts` | Added `documentType` to `BuildDocumentInputOptions`; passed through to `DocumentInput` |
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Pass `documentType: currentDocumentType` to `buildDocumentInput`; pass `selectedProject` to `IntakePanel`; pass `accepted={[...accepted]}` to `DocumentPreviewRouter` |
| `src/features/documents/packs/changeOrder/questions.ts` | Removed duplicate `project` text question |
| `src/features/documents/engine/recommendationEngine.ts` | Added `documentType` to `RuleContext`; added 6 CO-specific rules; guarded all residential-only rules with `c.documentType !== 'change_order'` |
| `src/features/documents/ui/adapters/changeOrderPreviewAdapter.ts` | Added `accepted?` param; wired `approvalRequiredBeforeWorkStarts`, `emergencyWork`, `fieldCondition`, `ownerRequestedChange`, `costBreakdownAvailable`, `rfiFarReference` + accepted clauses into composite `order.terms` |
| `src/features/documents/ui/panels/DocumentPreviewRouter.tsx` | Added `accepted?` prop; passes to adapter; CO document wrapped in paper-preview shell with "Paper preview" label |
| `src/features/documents/ui/panels/IntakePanel.tsx` | Added `selectedProject?` prop; added RFI/FAR fetch + dropdown renderer for `rfiFarReference` |

---

## Issue-by-issue resolution

### 1. Duplicate title / project questions

**Before:** A "Project name" text field appeared in the questionnaire alongside the top project selector.

**Fix:** Removed the `project` question from `changeOrderQuestions.ts`. Project information is now imported exclusively through the top project selector. The document title (in `DocumentMetaPanel`) auto-flows to the CO preview title when `changeOrderTitle` is left blank (adapter precedence: `title arg → changeOrderTitle answer → 'Change Order'`).

---

### 2. `priceModel` required warning

**Before:** `contractInput.ts` always set `documentType: 'residential_contract'`, so the compliance engine validated residential questions (including `priceModel`, `required: true`) against CO answers.

**Fix:** `BuildDocumentInputOptions` now accepts `documentType?: DocumentType`. `DocumentBuilderPage` passes `currentDocumentType` (derived from `resolveDocumentType(packKey)`). For Change Order, this is `'change_order'`, so the compliance engine uses the CO-specific compliance profile which has no `priceModel` requirement.

---

### 3. Change management fields wired

**Before:** `approvalRequiredBeforeWorkStarts`, `emergencyWork`, `fieldCondition`, `ownerRequestedChange`, `costBreakdownAvailable` only affected risk scoring; nothing appeared in the preview.

**Fix (adapter — `buildTerms`):**

| Field | When true/false | Text appended to `order.terms` |
|---|---|---|
| `approvalRequiredBeforeWorkStarts = true` | always | "Work described in this Change Order shall not proceed until approved in writing…" |
| `emergencyWork = true` | always | "Emergency protection work was required… documented with photographs, time records…" |
| `fieldCondition = true` | reason composite | "This change is related to concealed, latent, or unforeseen field conditions." |
| `ownerRequestedChange = true` | reason composite | "This change was requested by the Owner/Client." |
| `costBreakdownAvailable = false` + total > 0 | always | "A detailed cost breakdown… should be attached…" |

---

### 4. RFI / FAR reference — project dropdown

**Before:** `rfiFarReference` was a free-text field with no project linkage.

**Fix:** `IntakePanel` now has a `selectedProject` prop. A `useEffect` fetches `fetchRfisForProject` and `fetchAdjustmentsForProject` when the project changes. The `rfiFarReference` field renders:
- No project → "Select a project above to link RFIs or FARs."
- Loading → loading indicator
- No results → "No RFIs or FARs found for this project."
- Results → `<Select>` dropdown showing `RFI-001 — Title` / `FAR-001 — Title` options

The selected reference is appended to `order.terms` in the preview as "Related reference: [value]".

Note: Single-select is implemented in this pass. Multi-select can be added in a future pass if needed.

---

### 5. Recommended clauses change the preview

**Before:** Accepting a recommendation toggled its state in the builder UI but the preview was unaffected.

**Fix:**
- `DocumentPreviewRouter` now accepts `accepted?: string[]` and passes it to `buildChangeOrderPreviewFromDocumentAnswers`
- `DocumentBuilderPage` passes `[...accepted]` to the router
- The adapter maps each accepted clause key to its human-readable text via `ACCEPTED_CLAUSE_TEXT`
- Accepted clause text is appended to `order.terms`, which renders in the "Terms" section of `ChangeOrderDocument`

---

### 6. Recommendations are now CO-specific

**Before:** All recommendation rules fired regardless of document type. CO docs could see residential addendum recommendations.

**Fix:** Added `documentType: string` to `RuleContext`. Six new CO-only rules added:

| Clause key | Trigger |
|---|---|
| `co.approval_before_work` | `approvalRequiredBeforeWorkStarts === true` |
| `co.emergency_work_docs` | `emergencyWork === true` |
| `co.concealed_condition` | `fieldCondition === true` |
| `co.owner_requested_scope` | `ownerRequestedChange === true` or `requestedBy === 'owner'` |
| `co.cost_backup_required` | `costBreakdownAvailable === false` AND `totalChangeOrderAmount > 0` |
| `co.schedule_adjustment` | `additionalCalendarDays > 0` or `revisedCompletionDate` set |

All 12 residential-only rules now guarded with `c.documentType !== 'change_order'`.

---

### 7. Dark mode / paper preview

**Already resolved** in a prior session (all `dark:` Tailwind variants stripped from `ChangeOrderDocument.tsx`).

**Additional improvement:** `DocumentPreviewRouter` now wraps CO documents in a paper-preview shell:
- Outer container: `bg-slate-100 dark:bg-slate-900/60` — visible in both modes
- "Paper preview" label in the header bar
- "Internal view" badge when `audience === 'internal'`
- Inner document: always `bg-white text-slate-950` (paper-safe)

---

### 8. Adapter completeness

All answer keys now flow to the preview. See field table in `CHANGE_ORDER_DOCUMENT_BUILDER_FIELD_MAPPING_FIX_REPORT.md` for full list (prior pass). New additions this pass: `rfiFarReference`, conditional clause text from boolean fields, accepted recommendation language.

---

## Acceptance test summary

| Test | Result |
|---|---|
| User not asked for project name twice | ✓ `project` question removed |
| No `priceModel` warning for CO | ✓ `documentType` now correctly `'change_order'` |
| `approvalRequiredBeforeWorkStarts` → terms | ✓ |
| `emergencyWork` → terms | ✓ |
| `fieldCondition` → reason + terms | ✓ |
| `ownerRequestedChange` → reason + terms | ✓ |
| `costBreakdownAvailable = false` → terms | ✓ |
| RFI/FAR dropdown with project selected | ✓ |
| Accept recommendation → preview changes | ✓ |
| CO-specific recommendations only for CO | ✓ |
| Residential contract unchanged | ✓ (all residential rules guard-wrapped) |
| Planner Change Order Builder unchanged | ✓ (uses `ChangeOrderDocument` directly) |
| `npm run build` exit code 0 | ✓ |

---

## Remaining limitations (by design)

- RFI/FAR dropdown is single-select. Multi-select support can be added in a future pass.
- Line item tables (labor/material/equipment) are always empty in Document Builder mode — the line-item editor lives in Planner → Change Orders.
- Signatures always show "Not signed" in the preview — signing happens via the public token flow.
