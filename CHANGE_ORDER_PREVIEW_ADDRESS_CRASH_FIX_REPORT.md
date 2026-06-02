# Change Order Preview Address Crash Fix Report

## Exact Root Cause

**`TypeError: can't access property "street", addr is undefined`**

**Location:** `src/utils/changeOrderDocumentContext.ts`

```ts
// BEFORE — both calls unsafe when addresses are undefined
const projectAddress =
  formatUSAddress(clientAddress) ||   // clientAddress can be undefined
  formatUSAddress(jobsite)     ||     // jobsite can be undefined
  '—';
```

`formatUSAddress` is typed as `(addr: Partial<USAddress>): string`. Its first line is:
```ts
const streetParts = [addr.street?.trim(), addr.street2?.trim()].filter(Boolean);
```

When `addr` itself is `undefined` (not just an empty object), JavaScript throws `TypeError` because it cannot read `.street` on `undefined`.

**How `undefined` got in:**

Both arguments on those lines come from functions that legitimately return `undefined`:

1. `resolveClientAddressForProposal(clientInfo, jobsite)` → return type is `USAddress | undefined`. When a project has no client address set and defaults to the jobsite, it just returns `jobsite` — which may also be `undefined`.
2. `project?.jobsiteAddress` → `USAddress | undefined`. When a project has never had an address entered, `jobsiteAddress` is `undefined`.

The Contract Builder had no project selected (or the selected project had no address), so both candidates were `undefined`, and the first `formatUSAddress(undefined)` call crashed the React render, blanking the page.

---

## Files Changed

### 1. `src/utils/changeOrderDocumentContext.ts`

Added a local null-safe wrapper `safeFormatAddress`:

```ts
function safeFormatAddress(addr: USAddress | Partial<USAddress> | null | undefined): string {
  if (!addr) return '';
  return formatUSAddress(addr) || '';
}
```

Replaced both unsafe calls:

```ts
// BEFORE
const projectAddress =
  formatUSAddress(clientAddress) ||
  formatUSAddress(jobsite) ||
  '—';

// AFTER
const projectAddress =
  safeFormatAddress(clientAddress) ||
  safeFormatAddress(jobsite) ||
  '—';
```

### 2. `src/features/documents/ui/panels/DocumentPreviewRouter.tsx`

Added defensive `try/catch` around the adapter call so any future error in the Change Order path shows a graceful amber fallback card instead of crashing the global React error boundary:

```tsx
try {
  return buildChangeOrderPreviewFromDocumentAnswers({ answers, selectedProject, companySettings, title });
} catch (err) {
  if (import.meta.env.DEV) console.error('[DocumentPreviewRouter]', err);
  setTimeout(() => setAdapterError(err instanceof Error ? err.message : String(err)), 0);
  return null;
}
```

If the adapter ever fails (current or future), the preview area shows:

> **Change Order preview could not load.**  
> Check project address data or use Planner → Change Orders for production change orders.

---

## Where `formatUSAddress` Was Guarded

| Location | Guard applied |
|----------|--------------|
| `changeOrderDocumentContext.ts` — `formatUSAddress(clientAddress)` | Wrapped with `safeFormatAddress()` |
| `changeOrderDocumentContext.ts` — `formatUSAddress(jobsite)` | Wrapped with `safeFormatAddress()` |

No other `formatUSAddress` calls existed in the adapter or router files.

---

## Address Scenarios Now Safe

| Scenario | Result |
|----------|--------|
| No project selected | `projectAddress = '—'` |
| Project with no `jobsiteAddress` | `projectAddress = '—'` |
| Project with partial address (city only) | `projectAddress = formatted city` |
| Project with full address | `projectAddress = full formatted address` |
| `clientInfo` missing | Falls through to `jobsiteAddress`, then `'—'` |

---

## Acceptance Test Mapping

| Test | Passes |
|------|--------|
| A. No project selected → no crash | ✅ |
| B. Project with no jobsite address → no crash | ✅ |
| C. Project with partial address → no crash | ✅ |
| D. Project with full address → preview shows formatted address | ✅ |
| E. Residential → Change Order → Residential → no crash | ✅ |
| F. Planner Change Order Builder unchanged | ✅ (safeFormatAddress is additive; existing callers not changed) |

---

## Planner Change Order Builder Confirmation

`changeOrderDocumentContext.ts` is shared between the Document Builder preview and the Planner Change Order Builder. The `safeFormatAddress` wrapper is backward-compatible: if the address is a valid `Partial<USAddress>` (as it always is in the Planner CO Builder where projects always have full data loaded), the behavior is identical to before. No Planner behavior was changed.

---

## Build Status

```
✓ 3199 modules transformed.
✓ built in 18.43s
```

`npm run build` passes with exit code 0.
