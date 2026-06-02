# Change Order Preview Text Color Fix Report

## Build result

```
✓ 3199 modules transformed.
✓ built in 17.49s
Exit code: 0
```

---

## Root cause

`ChangeOrderDocument.tsx` is rendered inside a dark-mode app container that sets
`dark:text-white` or `dark:text-slate-100` on ancestor elements.

The root `<div>` of `ChangeOrderDocument` had:

```
bg-white text-gray-900 dark:bg-white dark:text-gray-900
```

This correctly forces white background in dark mode, but every **inner sub-component**
(`DocumentTextBlock`, `InfoRow`, `SignatureDisplay`, `ClientTotalRow`, `LineItemsTable`,
`InternalPricingSection`) had its own `dark:text-slate-100`, `dark:text-white`,
`dark:bg-slate-800/80` etc. overrides. These overrides produce **white text on white
background** — text is invisible until highlighted.

---

## Fix

Treated `ChangeOrderDocument` as a **paper document** that is always white-on-dark-text,
regardless of the surrounding app theme. This mirrors how a real PDF/print preview works.

### Approach
- Removed **all `dark:` Tailwind variant classes** from inside the document component.
- Replaced all color tokens with explicit paper-document colors:
  - Background: `bg-white` (root wrapper)
  - Primary text: `text-slate-950` (root) / `text-slate-900` (values)
  - Section labels: `text-slate-500`
  - Muted text: `text-slate-600`
  - Borders: `border-slate-200` / `border-slate-300`
  - Table headers: `bg-slate-50 text-slate-500`
  - Internal pricing bg: `bg-slate-50 border-slate-300`
  - Empty/italic states: `text-slate-400 italic`

---

## File changed

| File | Change |
|---|---|
| `src/components/change-order/ChangeOrderDocument.tsx` | Removed all `dark:` variant classes from every sub-component and root wrapper. Replaced with paper-safe `slate-*` color tokens. |

---

## Colour classes fixed (by sub-component)

### Root wrapper
| Before | After |
|---|---|
| `bg-white text-gray-900 dark:bg-white dark:text-gray-900` | `bg-white text-slate-950` |

### `DocumentTextBlock`
| Before | After |
|---|---|
| `text-gray-500 dark:text-slate-400` (label) | `text-slate-500` |
| `text-gray-900 dark:text-slate-100` (text) | `text-slate-900` |

### `InfoRow`
| Before | After |
|---|---|
| `border-gray-100 dark:border-gray-800` | `border-slate-100` |
| `text-gray-500 dark:text-slate-400` (label) | `text-slate-500` |
| `text-gray-900 dark:text-slate-100` (value) | `text-slate-900` |

### `SignatureDisplay`
| Before | After |
|---|---|
| `border-gray-200 dark:border-gray-700` | `border-slate-200` |
| `text-gray-500 dark:text-slate-400` (role label) | `text-slate-500` |
| `text-gray-900 dark:text-slate-100` (name) | `text-slate-900` |
| `text-gray-400 dark:text-slate-500` (not signed) | `text-slate-400 italic` |
| `border-gray-300 dark:border-gray-600` (sig line) | `border-slate-300` |
| `font-serif text-lg italic text-gray-900 dark:text-white` (typed sig) | `font-serif text-lg italic text-slate-900` |
| `text-xs text-gray-400 dark:text-slate-500` (placeholder) | `text-xs text-slate-400` |
| `text-gray-500 dark:text-slate-400` (signed-at) | `text-slate-500` |

### `ClientTotalRow`
| Before | After |
|---|---|
| `border-gray-100 dark:border-gray-800` | `border-slate-100` |
| `border-gray-300 dark:border-gray-600` (grand) | `border-slate-300` |
| `text-gray-900 dark:text-white` (grand label) | `text-slate-900` |
| `font-medium text-gray-700 dark:text-slate-300` (normal label) | `font-medium text-slate-700` |
| `tabular-nums text-gray-900 dark:text-white` (value) | `tabular-nums text-slate-900` |

### `LineItemsTable`
| Before | After |
|---|---|
| `border-gray-200 dark:border-gray-700` | `border-slate-200` |
| `bg-gray-50 dark:bg-slate-800/80 dark:text-slate-400` (thead) | `bg-slate-50 text-slate-500` |
| `border-gray-100 dark:border-gray-800` (row) | `border-slate-100` |
| `text-gray-900 dark:text-slate-100` (cells) | `text-slate-900` |
| `bg-gray-50 dark:bg-slate-800/50` (subtotal row) | `bg-slate-50` |
| `text-gray-700 dark:text-slate-300` (subtotal label) | `text-slate-700` |
| `text-gray-900 dark:text-white` (subtotal value) | `text-slate-900` |

### `InternalPricingSection`
| Before | After |
|---|---|
| `text-gray-500 dark:text-slate-400` (section label) | `text-slate-500` |
| `border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50` (box) | `border-slate-300 bg-slate-50 text-slate-900` |
| `text-gray-600 dark:text-slate-400` (muted rows) | `text-slate-600` |
| `border-gray-200 dark:border-gray-700` (divider) | `border-slate-200` |

### Header / section borders
| Before | After |
|---|---|
| `border-gray-200 dark:border-gray-300` (header, CO box, sections) | `border-slate-200` / `border-slate-300` |

---

## Acceptance confirmation

### Document Builder
- Generic Change Order selected → project info text fully visible without highlighting
- Title / status / pricing / contract values all readable
- Empty fields show clean muted `text-slate-400 italic`, not invisible white
- Dark mode app: white-paper preview with dark text ✓
- Light mode app: white-paper preview with dark text ✓

### Planner Change Order Builder
- Preview renders same `ChangeOrderDocument` component → same fix applies
- Client/Internal audience toggle still works
- No text disappears in either mode ✓

### Regression
- Residential contract preview unchanged (uses separate `PreviewPanel`, not `ChangeOrderDocument`)
- Change order field mapping from previous audit pass unaffected
- PDF export (`changeOrderPdf.ts` / `generateChangeOrderPDF`) generates its own HTML
  strings with inline styles — not affected by Tailwind class changes ✓
- `npm run build` exit code 0 ✓
