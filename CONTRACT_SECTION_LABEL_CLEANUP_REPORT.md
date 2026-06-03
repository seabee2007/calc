# Contract Preview Section Label Cleanup

**Date:** 2026-06-03

## Issue

Residential contract preview and PDF export showed a repeated **Section** / **SECTION** eyebrow above every clause title:

```text
SECTION
Scope of Work
```

This looked repetitive and less professional than a single clear heading.

## Goal

Show only the section title (e.g. **Scope of Work**) without a generic **SECTION** label. Do not change contract logic, clauses, engine, Change Order, or RFI renderers.

## Fix

### `src/features/documents/ui/renderers/ResidentialContractDocument.tsx`

- Removed the uppercase **Section** eyebrow `<p>` above each contract clause.
- Kept `<h3>` with `section.title` and locked-notice icon styling.

**Before:** Section eyebrow + title  
**After:** Title only (e.g. `Scope of Work`)

### `src/features/documents/ui/contractPdf.ts`

- Removed `doc.text('SECTION', …)` from `addParagraphBlock`.
- PDF sections now print the clause title only (bold 11pt), then body text.

### Not changed

- **`PaperDocumentSection`** — Still uses the provided `title` as a small uppercase label (RFI, Change Order shell). It never injected the word "SECTION"; RFI/CO formatting unchanged.
- Document engine, clause packs, Supabase schema.

## Acceptance

| Check | Status |
|-------|--------|
| Residential contract preview — no repeated "SECTION" | Fixed |
| Section titles still visible | Yes |
| PDF export — no "SECTION" line | Fixed |
| RFI / Change Order preview | Unchanged |

## Validation

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 27 files, 196 tests |
| `npm run build` | **PASS** |

## Files changed

- `src/features/documents/ui/renderers/ResidentialContractDocument.tsx`
- `src/features/documents/ui/contractPdf.ts`
