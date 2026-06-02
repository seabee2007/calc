# Contract Builder — Change Order Crash Fix Report

## Summary

Selecting "Generic Change Order" from the Contract Builder dropdown caused the builder to malfunction (broken questionnaire, TypeScript type violation, and incorrect document-type wiring). This report documents the root causes found and the fixes applied.

---

## Root Causes Found

### 1. Hardcoded questionnaire — PRIMARY BUG

**File:** `src/features/documents/ui/DocumentBuilderPage.tsx` — line 438  
**Before:**
```ts
const questionnaire = useMemo(() => buildQuestionnaire('residential_contract', mode), [mode]);
```
**Problem:** The questionnaire was always built for `residential_contract` regardless of which pack or document type the user selected. When a user switched to "Generic Change Order", the builder would continue showing residential contract questions (Contractor/Owner parties, Property address, Pricing with `contractPrice`, Schedule with `startDate`/`completionDate`, etc.) instead of the change-order-specific questions (Scope of Change, Reason for Change, Total Amount, etc.).

From a user's perspective, the builder appeared broken: no relevant questions appeared, the form couldn't be filled in, and the preview showed a blank Change Order with no usable data.

### 2. `selectedProject` typed as `undefined` instead of `null`

**File:** `src/features/documents/ui/DocumentBuilderPage.tsx`  
**Problem:** `projects.find(...)` returns `Project | undefined`. This value was passed directly to `DocumentPreviewRouter` and `buildChangeOrderPreviewFromDocumentAnswers`, both of which declare `selectedProject: Project | null`. While JavaScript optional chaining handles `undefined` at runtime, TypeScript strict checks would flag this, and it was a latent type mismatch.

### 3. Invalid `IntakeGroup` value in change order questions

**File:** `src/features/documents/packs/changeOrder/questions.ts`  
**Problem:** The `rfiFarReference` question used `group: 'documentation'`, which is not a member of the `IntakeGroup` union type. Because Vite uses `esbuild` (transpile-only) rather than full TypeScript type-checking, the build passed, but the value was incorrect. At runtime, questions with an unrecognized group are silently dropped from `groupedQuestions` since the group is not in `GROUP_ORDER`.

### 4. Misleading dropdown label

**File:** `src/features/documents/ui/panels/IntakePanel.tsx`  
**Problem:** The pack selector was labeled "Contract Template" even after Change Order was added to the pack registry. This confused users into thinking they were only picking a contract style.

---

## Console Error

No hard JavaScript exception was thrown. The "site breaks" was a functional crash: the builder showed residential questions for a change order document, making the form non-functional for change order use. After the questionnaire fix, the correct change-order questions now load.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Added `DocumentType` import; added `resolveDocumentType(packKey)` helper; added `currentDocumentType` memo; changed `buildQuestionnaire` to use `currentDocumentType`; normalized `selectedProject` to return `null` instead of `undefined` |
| `src/features/documents/packs/changeOrder/questions.ts` | Fixed `group: 'documentation'` → `group: 'change_management'` for `rfiFarReference` question |
| `src/features/documents/ui/panels/IntakePanel.tsx` | Renamed label from `"Contract Template"` to `"Document Type / Template"`; updated helper text to `"Choose the document type or template to build."` |

---

## What Change Order Now Renders

When "Generic Change Order" is selected:

- **Questions panel** — shows Change Order questions grouped by:
  - **Project** — Project name
  - **Scope** — Change Order title, Scope of change, Reason for change, Added/deleted work, Exclusions
  - **Pricing** — Total Change Order amount, (advanced: original/revised contract amounts, cost breakdown)
  - **Schedule** — Schedule impact, Additional calendar days, Revised completion date
  - **Parties** — Requested by
  - **Change management** — Approval required before work starts, RFI/FAR reference
  - **Risk** — Emergency work, Field condition, Owner-requested change
- **Preview panel** — renders the professional `ChangeOrderDocument` component (same renderer used in Planner Change Order Builder)
- **PDF export** — routes through `generateChangeOrderPDF` for a client-safe, professional Change Order PDF
- **Compliance panel** — evaluates against the `change_order` compliance profile with appropriate advisory notes

## What Is Still Not Fully Wired

- **Saving a Change Order via Document Builder** — save/send/signature flow uses the existing `contractDocumentService`. This works structurally but the public signing page is designed for residential contracts. Use Planner → Change Orders for production change order workflows with full signature and approval tracking.
- **Prefill** — the project prefill (`buildContractPrefillFromProject`) populates residential-specific answer keys. For Change Orders, users fill in the change-order questions manually; the project selection still associates the document with a project.
- **Mode labels** — the Quick/Standard/Advanced mode selector still shows "Basic residential jobs" as a hint for Quick mode. This is display-only and does not affect functionality.

---

## Residential Contract Confirmation

- Selecting "Generic Residential Contract" continues to work exactly as before.
- Residential questionnaire is loaded when `packKey` resolves to `residential_contract`.
- Switching Residential → Change Order → Residential does not crash.
- All existing residential contract questions, compliance, risk, PDF export, and save/signature flows remain unchanged.

---

## Build Status

```
✓ 3199 modules transformed.
✓ built in 20.14s
```

`npm run build` passes with exit code 0. No new errors or warnings.
