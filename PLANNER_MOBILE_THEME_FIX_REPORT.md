# Planner Mobile Theme Fix Report

## Actual Component Rendering Project Cards

- `src/pages/planner/PlannerHubPage.tsx`

The horizontal/mobile Planner Hub project cards are rendered directly in this page as project links.

## Files Changed

- `src/App.tsx`
- `PLANNER_MOBILE_THEME_FIX_REPORT.md`

Debug instrumentation was temporarily added to `ThemeToggle`, `App`, and `PlannerHubPage` during investigation, then removed after verification.

## Root Cause

The global theme effect updated `document.documentElement.classList`, but `document.body.classList` could remain stale with the `dark` class after navigating into Planner Hub.

Runtime logs showed the failed state clearly:

- `rootHasDarkAfter:false`
- `bodyHasDarkAfter:true`
- project card background still `rgb(30, 41, 59)`

Because Tailwind dark mode was still matching the stale `body.dark`, the Planner Hub cards kept their dark styles even while the page background had already switched light.

## Why Refresh Fixed It Before

A full refresh rebuilt the document/body theme state from scratch, so the stale `body.dark` class was no longer left behind. After refresh, the cards correctly received light-mode styles.

## Fix

`src/App.tsx` now keeps both theme roots synchronized:

- Dark mode adds `dark` to both `document.documentElement` and `document.body`.
- Light mode removes `dark` from both `document.documentElement` and `document.body`.

## Verification

- User confirmed the issue is fixed.
- Debug instrumentation was removed.
- Session debug log was deleted.
- `ReadLints` reported no issues for touched files.
- `npm run build` passed successfully.
