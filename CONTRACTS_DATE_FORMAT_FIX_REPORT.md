# Contracts Date Format Fix Report

## Bug

On **Project → Documents → Contracts**, the Date column showed raw ISO timestamps such as `2026-06-03T21:29:10.413433+00:00` instead of friendly dates like `Jun 3, 2026`.

## Root cause

[`ContractsDocumentsPanel`](src/components/planner/documents/panels/ContractsDocumentsPanel.tsx) already called `formatDocDate(c.updated_at)` from [`documentsPanelUtils.tsx`](src/components/planner/documents/documentsPanelUtils.tsx).

The shared helper appended `T12:00:00` to every value, which works for **date-only** strings (`2026-06-04`) but breaks **full ISO** timestamps from `contract_documents.updated_at`. Parsing failed and the `catch` block returned the original raw string.

Builder document rows used a local `new Date(iso)` parser and did not hit this bug.

## Fix

Updated **`formatDocDate`** in `documentsPanelUtils.tsx` to:

1. Parse with `new Date(trimmed)` (handles ISO timestamps with timezone).
2. Fall back to `yyyy-MM-dd` + `T12:00:00` only when needed for date-only fields.
3. Return `—` on missing/invalid input (never echo raw ISO).

**`PlannerBuilderDocumentRow`** now imports the shared helper instead of a duplicate implementation.

## Files changed

| File | Change |
|------|--------|
| `src/components/planner/documents/documentsPanelUtils.tsx` | Robust `formatDocDate` |
| `src/components/planner/PlannerBuilderDocumentRow.tsx` | Use shared `formatDocDate` |
| `src/components/planner/documents/documentsPanelUtils.test.ts` | Unit tests |

## Validation

| Command | Result |
|---------|--------|
| `npm test` | Pass (includes new `formatDocDate` tests) |
| `npm run build` | Pass |

## Acceptance

- Contracts Date column shows `MMM d, yyyy` (e.g. Jun 3, 2026).
- Submittals, Daily Reports, QC, Closeout, Punch List, and builder rows use the same helper unchanged in behavior for date-only values.
- No raw ISO strings in Documents tables from this formatter.
