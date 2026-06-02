# Document Builder — Variable Order Crash Fix Report

**Date:** June 3, 2026  
**Status:** ✅ Fixed — build passes

---

## Problem

Contract Builder crashed on load with:

```
ReferenceError: can't access lexical declaration 'isChangeOrderDocument' before initialization
```

**Stack:** `DocumentBuilderPage.tsx` line 518

This is a JavaScript temporal dead zone (TDZ) error: a `const` was referenced before its declaration in the component body.

---

## Root Cause

`isChangeOrderDocument` was used in a `useEffect` (lines 514–518) **before** it was declared (previously at lines 548–549).

```typescript
// ❌ Used here (line 514)
useEffect(() => {
  if (!isChangeOrderDocument) return;
  // ...
}, [isChangeOrderDocument, answers.changeOrderTitle]);

// ❌ Declared much later (line 548)
const isChangeOrderDocument =
  input.documentType === 'change_order' || packKey === 'GENERIC_CHANGE_ORDER';
```

---

## Fix

Moved `isChangeOrderDocument` immediately after `currentDocumentType`, before any `useEffect`, `useMemo`, or render logic that references it.

```typescript
const currentDocumentType = useMemo(() => resolveDocumentType(packKey), [packKey]);
const isChangeOrderDocument = currentDocumentType === 'change_order';
```

Removed the duplicate declaration that previously lived below the deposit `useEffect`.

### Why `currentDocumentType === 'change_order'` is equivalent

`resolveDocumentType('GENERIC_CHANGE_ORDER')` returns `'change_order'`, so checking `currentDocumentType` covers the same case as the old `packKey === 'GENERIC_CHANGE_ORDER'` guard. No document logic changed.

---

## Variable That Was Used Before Initialization

| Variable | First usage (before fix) | Declaration (before fix) |
|----------|--------------------------|--------------------------|
| `isChangeOrderDocument` | `useEffect` ~line 514 | ~line 548 |

No other derived constants (`currentDocumentType`, `selectedPack`, etc.) had the same ordering problem.

---

## File Changed

| File | Change |
|------|--------|
| `src/features/documents/ui/DocumentBuilderPage.tsx` | Moved `isChangeOrderDocument` to line 451 (right after `currentDocumentType`); removed late duplicate declaration |

---

## Acceptance

- Open Contract Builder — no crash
- Select Generic Residential Contract — no crash; Contract title visible
- Select Generic Change Order — no crash; Contract title hidden; Change order title in questionnaire
- Switch Change Order → Residential → Change Order — no crash
- `npm run build` — passes (3199 modules, 0 errors)

---

## Build Result

```
✓ 3199 modules transformed.
✓ built in 20.82s
```
