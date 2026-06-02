# Mobile Schedule Touch Bug Fix Report

## Summary

Fixed mobile schedule touch regressions where swipes stopped navigating and saved events could not be opened. Desktop behavior is unchanged.

## Root Causes

1. **`preventDefault()` on touch handlers** — Month day cells and week/day slot layers called `preventDefault()` on `touchEnd`, which suppressed the synthetic `click` event on child event chips/buttons. Mobile browsers never fired `onClick` on event cards.

2. **Swipe thresholds too strict** — `100px` distance, `2:1` axis ratio, and `600ms` max duration rejected most real-world swipes.

3. **Week/day swipe target too small** — Swipe was limited to the sticky date header row only, so swipes on the main calendar grid never registered.

4. **Slot layer used `<button>` elements** — Full-column slot buttons covered the time grid. Touch targets were always `button`, so swipe logic treated grid touches as blocked interactive targets when using start-target checks.

## Files Changed

- `src/utils/scheduleTouchInteraction.ts`
- `src/pages/planner/ScheduleWorkspacePage.tsx`
- `src/components/schedule/views/calendar/ScheduleCalendarMonthView.tsx`
- `src/components/schedule/views/calendar/ScheduleTimeGridView.tsx`
- `src/components/schedule/ScheduleCalendarEventChip.tsx`
- `src/components/schedule/ScheduleCalendarEventBlock.tsx`
- `src/components/schedule/ScheduleCalendarMultiDayBar.tsx`
- `MOBILE_SCHEDULE_TOUCH_BUG_FIX_REPORT.md`

## Swipe Thresholds (Updated)

| Rule | Value |
|------|-------|
| Minimum horizontal distance | `70px` |
| Horizontal vs vertical | `abs(deltaX) > abs(deltaY) * 1.5` |
| Maximum duration | `900ms` |
| Cooldown after navigation | `400ms` |

Swipe is evaluated only from the **touch start** target. If the gesture starts on an event or other blocked element, navigation is skipped for that gesture.

## `preventDefault` Removed

Removed from:

- Month day cell `touchEnd` handler (handlers removed entirely)
- Week/day slot `touchEnd` handler (handlers removed entirely)

Calendar container swipe handlers never called `preventDefault`.

## Event Tap Protection

- Event chips, blocks, and multi-day bars have `data-schedule-event="true"` and `data-no-swipe="true"`.
- Selector includes `[data-schedule-event="true"]` and `[data-no-swipe="true"]`.
- Event components keep `onClick` with `e.stopPropagation()` so parent day-cell create handlers do not run.
- Event blocks use `pointer-events-auto` and `z-10` above slot layers (`z-0`).
- Month create uses `onClick` on the day cell with an interactive-target guard (no touch handlers).
- Week/day empty slots use non-button `div` layers with `onClick` only (no overlay buttons).

## Swipe Container Attachment

| View | Swipe zone |
|------|------------|
| Month | Calendar content wrapper in `ScheduleWorkspacePage` |
| Week / Work week / Day | Outer `ScheduleTimeGridView` card (`data-schedule-swipe-zone`) |

Swipe does not attach to the Planner page shell, nav, or modals.

## Tap-To-Add vs Event Tap

- **Empty day cell / slot** → `openCreateAt` / `openCreateAtSlot` via `onClick`
- **Event chip/block/bar** → `onSelect` via `onClick` + `stopPropagation`
- Swipes do not call create handlers

## Dev Debug Logs

Guarded with `import.meta.env.DEV` via `logScheduleTouchDebug()`:

- Touch start target / blocked flag
- Swipe accepted/rejected with `deltaX`, `deltaY`, `elapsed`
- Event chip/block/bar clicked
- Create day cell / slot clicked

## Desktop Behavior

Unchanged:

- Arrow period navigation
- Mouse click on events and empty cells
- No new touch-only code paths on desktop (touch handlers only run when mobile swipe flags are enabled)

## Validation

- `ReadLints`: no issues on changed files
- `npm run build`: passed

## Expected Mobile Acceptance

- **Month:** swipe changes month; tap event opens detail drawer; tap empty day opens Add Event
- **Week / Day:** swipe on calendar card changes period; vertical scroll works; tap event opens detail; tap empty slot opens Add Event with time defaults
