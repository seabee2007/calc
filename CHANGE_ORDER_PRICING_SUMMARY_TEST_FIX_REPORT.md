# Change Order Pricing Summary Test Fix Report

**Date:** June 3, 2026  
**Status:** ✅ Complete — change order registration tests pass

---

## Problem

`changeOrderRegistration.test.ts` expected `co.pricing_summary` in:

1. `getComplianceProfile('change_order').requiredClauseKeys`
2. `assembleDocument(makeCoInput(...))` section output

The compliance profile had been reduced to `['co.title', 'co.scope']` during an earlier UI cleanup, causing the compliance profile test to fail. Assembly already included `co.pricing_summary` via the pack template, but template tokens like `changeOrder.totalAmount` were not mapped from flat questionnaire answers.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/documents/registry/complianceRegistry.ts` | Restored `co.pricing_summary` in `requiredClauseKeys` |
| `src/features/documents/packs/changeOrder/clauses.ts` | Added `changeOrderDocumentClauseKeys` (document sections only; recommendation clauses remain in catalog) |
| `src/features/documents/packs/changeOrder/template.ts` | Template uses `changeOrderDocumentClauseKeys` instead of all pack clause keys |
| `src/features/documents/engine/inputUtils.ts` | Added `buildChangeOrderRenderOverlay()` — maps flat answers to `changeOrder.totalAmount` (defaults to `0`) |
| `src/features/documents/engine/changeOrderRegistration.test.ts` | Added test: pricing summary renders `$0.00` when amount is 0 or missing |

**Unchanged:** `changeOrderFinancials.ts`, Planner Change Order Builder, residential contract packs, pricing math.

---

## Required Behavior Restored

### 1. Compliance profile

```typescript
requiredClauseKeys: ['co.title', 'co.scope', 'co.pricing_summary']
```

### 2. Assembly sections

Minimal change order assembly includes:

- `co.title`
- `co.scope`
- `co.pricing_summary`
- `co.signatures`

(Plus other document sections in `changeOrderDocumentClauseKeys`.)

### 3. Zero-amount pricing summary

`buildChangeOrderRenderOverlay()` sets `changeOrder.totalAmount` from `totalChangeOrderAmount`, defaulting to `0`. The `co.pricing_summary` clause renders:

```
Total Change Order Price: $0.00
```

Verified by new test when amount is `0` or omitted.

### 4. Client-facing content only

- `co.pricing_summary` body shows total change order price only (no markup/margin/cost breakdown).
- Recommendation-only clauses (`co.approval_before_work`, etc.) remain in the pack catalog for the Compliance panel but are **excluded** from the assembled document template.

---

## Validation Result

| Command | Result |
|---------|--------|
| `npm test -- src/features/documents/engine/changeOrderRegistration.test.ts` | ✅ 23/23 passed |
| `npm test` (full suite) | ⚠️ 2 pre-existing unrelated failures (`proposalKpis.test.ts`, `professionalConcreteLabor.test.ts`) |
| `npm run lint` | ⚠️ Pre-existing eslint issues in other files (none in changed CO files) |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ Pass |
| `npm run build` | ✅ Pass (19.18s) |

---

## Regression

- Residential contract compliance and assembly tests unchanged
- Change Order Document Builder preview adapter unchanged
- No Supabase or pricing math changes
