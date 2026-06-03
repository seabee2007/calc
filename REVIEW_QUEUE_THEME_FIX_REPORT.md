# Review Queue Light/Dark Mode Theme Fix Report

**Date:** June 3, 2026  
**Status:** ✅ Complete

---

## Summary

The Review Queue page (`/owner/review`) was styled with hardcoded dark-mode classes (`text-white`, `bg-slate-800/60`, `border-slate-700`) inside `OpsCard` panels. In light mode, headings were nearly invisible and list rows looked washed out or inconsistent with Planner/Dashboard cards.

Styling-only update — no changes to queue logic, Supabase queries, navigation, or button handlers.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/owner/OwnerReviewQueue.tsx` | Replaced hardcoded dark classes with `appTheme` tokens; swapped `OpsCard` for `APP_SECTION_CARD`; themed list rows and FAR/CO sections |
| `src/pages/owner/OwnerReviewPage.tsx` | Page wrapper uses theme-aware text + `max-w-5xl px-4 py-8` layout |

---

## Hardcoded Classes Replaced

| Before | After |
|--------|-------|
| `OpsCard` (dark-console comment, inconsistent inner styles) | `APP_SECTION_CARD` (`bg-white/90 … dark:bg-slate-800/95`) |
| `text-white` section headings | `TEXT_FOREGROUND` (`text-slate-900 dark:text-slate-100`) |
| `text-slate-400` empty/meta text | `TEXT_MUTED` (`text-slate-600 dark:text-slate-400`) |
| `text-slate-100` row titles | `TEXT_FOREGROUND` |
| `text-cyan-400` reference numbers | `TEXT_ACCENT` (`text-cyan-700 dark:text-cyan-400`) |
| `border-slate-700 bg-slate-800/60` list rows | `QUEUE_LIST_ROW` — `bg-slate-50/80 dark:bg-slate-950/40` with themed borders/hover |
| `bg-slate-700 … text-slate-200` CO status pill | `FieldRecordStatusBadge` (shared badge tokens) |
| `border-amber-900/50 bg-amber-950/20` FAR rows | Light/dark amber row (`border-amber-200/70 bg-amber-50/80` + dark variants) |
| `text-amber-400/90` FAR label | `TEXT_WARNING` |
| Spinner `border-cyan-500` | `border-cyan-600 dark:border-cyan-400` |

---

## Section Layout

Each queue section now uses the same app card pattern:

- **Submitted tasks**
- **Open RFIs**
- **Pending adjustments**
- **Change orders**

Cards: `rounded-xl`, subtle border, backdrop blur, consistent padding, readable headings and empty states in both modes.

Change order rows use list-item styling with hover states and shared status badges. Edit/Review/Open buttons remain the existing `Button` component.

---

## Light Mode Result

- Section headings readable on glass cards over concrete background
- Empty states use muted slate text (not invisible gray)
- List rows have light slate fill with clear borders (not flat white boxes)
- Change order metadata and Edit buttons visible
- FAR “Create CO” rows use amber tint readable on light background

---

## Dark Mode Result

- Cards match Planner/Dashboard dark glass panels
- No stray white headings or low-contrast gray-on-dark body text
- List rows use dark slate fill with hover feedback
- Status badges use shared `statusColors` tokens
- Concrete texture background still visible through page layout

---

## Validation Result

```
npm run lint          ✅ exit 0
npx tsc -p tsconfig.app.json --noEmit  ✅ exit 0
npm run build         ✅ exit 0
```

---

## Regression

- Back to Planner Hub link unchanged
- Review / Approve / Open / Edit / Create CO handlers unchanged
- Data fetching and filtering unchanged
