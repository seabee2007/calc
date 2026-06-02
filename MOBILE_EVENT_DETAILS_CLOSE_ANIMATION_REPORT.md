# Mobile Event Details Close Animation Report

## Files Changed

- `src/pages/planner/ScheduleWorkspacePage.tsx`
- `src/components/schedule/ScheduleEventDetailDrawer.tsx`
- `MOBILE_EVENT_DETAILS_CLOSE_ANIMATION_REPORT.md`

## Root Cause

The mobile event details drawer was mounted with:

`isMobile && selectedEvent && <ScheduleEventDetailDrawer />`

When close cleared the selected event, React immediately unmounted the whole drawer component. Because the `AnimatePresence` lived inside that component, Framer Motion had no chance to run the exit animation.

## Close State Pattern Used

The mobile schedule page now keeps drawer rendering separate from drawer openness:

- `mobileDrawerEvent` retains the event while the exit animation runs.
- `mobileDrawerOpen` controls the Framer Motion visible/exit state.
- Opening sets `mobileDrawerEvent`, then uses `requestAnimationFrame` to flip `mobileDrawerOpen` to `true`.
- Closing sets `mobileDrawerOpen` to `false`.
- `onExitComplete` clears `mobileDrawerEvent` and removes the selected event from the URL.

This preserves the event details content until the exit animation finishes.

## Animation Duration

The drawer continues to use the existing planner drawer animation tokens:

- Backdrop fade: `PLANNER_OVERLAY_TRANSITION` (`0.28s`)
- Drawer panel: `PLANNER_DRAWER_PANEL_TRANSITION` spring animation

The close animation now matches the same Framer Motion path used for opening.

## Desktop Behavior

Desktop behavior is unchanged. The desktop event details panel still uses the existing `selectedEvent` / `clearSelection` path and was not converted to the mobile retained-render state.

## Regression Notes

- Event tap behavior is unchanged.
- Empty day and time-slot Add Event behavior is unchanged.
- Swipe behavior is unchanged.
- Schedule data logic, event creation logic, and Supabase were not changed.

## Validation

- Targeted lint check for changed files: clean.
- `npm run build`: passed.
