# Change Order Preview Scroll Fix Report

## Issue

The Change Order Builder right-side preview used a fixed max height and `overflow-y-auto`, which created a nested scrollbar inside the preview panel instead of scrolling with the page.

## Files Changed

- `src/pages/planner/ChangeOrderBuilderPage.tsx`

## Changes

Removed scroll-container classes from the preview wrapper:

| Before | After |
|--------|--------|
| `lg:max-h-[calc(100vh-8rem)]` on outer wrapper | Removed |
| `max-h-[calc(100vh-8rem)]`, `overflow-hidden`, flex column height lock on card | Simple `min-w-0 rounded-xl ...` card |
| `min-h-0 flex-1 overflow-y-auto` on preview content | `min-w-0 max-w-full overflow-x-hidden` (horizontal overflow only) |

**Kept:**

- `lg:sticky lg:top-24 lg:self-start` — preview stays pinned at the top of the viewport on desktop while the page scrolls
- Client / Internal view toggle
- Mobile stacked two-column grid layout

**Not changed:**

- `ChangeOrderDocument.tsx` (content unchanged)
- Pricing, PDF, save/send, public signing, Supabase

## Acceptance

- Preview panel has no internal vertical scrollbar; page scroll controls all content.
- Preview content is not clipped by a max-height container.
- Desktop sticky preview header/toggle remains at `top-24`.
- `npm run build` — passed.
