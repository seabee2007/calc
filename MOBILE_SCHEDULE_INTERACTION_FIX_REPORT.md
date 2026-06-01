# Mobile Schedule Interaction Fix Report

## Summary

Refined mobile schedule swipe navigation to reduce accidental period changes, and added tap/click-to-create event behavior for month day cells and week/day/work-week time slots using the existing Add Event modal.

## Files Changed

- `src/pages/planner/ScheduleWorkspacePage.tsx`
- `src/components/schedule/ScheduleEventFormModal.tsx`
- `src/components/schedule/views/calendar/ScheduleCalendarMonthView.tsx`
- `src/components/schedule/views/calendar/ScheduleTimeGridView.tsx`
- `src/components/schedule/views/calendar/ScheduleCalendarWeekView.tsx`
- `src/components/schedule/views/calendar/ScheduleCalendarDayView.tsx`
- `src/components/schedule/ScheduleCalendarEventBlock.tsx`
- `src/utils/scheduleTouchInteraction.ts` (new)
- `src/utils/scheduleEventUtils.ts`
- `MOBILE_SCHEDULE_INTERACTION_FIX_REPORT.md`

## Swipe Thresholds And Guards

Shared constants in `scheduleTouchInteraction.ts`:

| Rule | Value |
|------|-------|
| Minimum horizontal distance | `100px` |
| Maximum gesture duration | `600ms` |
| Horizontal vs vertical axis ratio | `abs(deltaX) > abs(deltaY) * 2` |
| Cooldown after successful swipe | `500ms` |
| Tap movement threshold | `10px` on both axes |

Interactive targets are ignored for swipe start/end using:

`button, a, input, select, textarea, [role="button"], [data-schedule-interactive="true"]`

## Swipe Zones By View

### Month

- Swipe remains on the calendar content wrapper in `ScheduleWorkspacePage`.
- Left/right swipes navigate previous/next month via existing `shiftCalendarAnchor` path.
- `touchAction: pan-y` preserves vertical scroll inside the month grid.

### Week / Work Week / Day

- Global wrapper swipe is disabled for these sub-views to avoid accidental navigation while scrolling the time grid.
- Swipe is moved to the sticky date header row in `ScheduleTimeGridView` (`data-schedule-swipe-zone="true"`).
- Vertical scrolling in the time grid no longer triggers period navigation.

## Tap-To-Add Behavior

### Month view

- Added optional `onCreateAtDate` prop to `ScheduleCalendarMonthView`.
- Tapping/clicking a day cell opens Add Event with that date prefilled.
- Event chips, multi-day bars, and `+N more` buttons stop propagation so existing event selection is unchanged.
- Mobile taps require movement ≤ `10px`; swipes do not open the modal.
- Light hover/active affordance on day cells when create is enabled.

### Week / Work Week / Day views

- Added optional `onCreateAtSlot` prop to `ScheduleTimeGridView`.
- Empty time slots are clickable/tappable with subtle hover/active highlighting.
- Slot index maps to start/end times using existing grid constants (`30`-minute slots, default `+1 hour` duration).
- Event blocks stop propagation so selecting existing events is unchanged.
- Mobile taps require movement ≤ `10px`; scroll/swipe gestures do not open the modal.

## Modal Prefill

- `ScheduleEventFormModal` accepts optional `defaultValues` (`startDate`, `startTime`, `endTime`) for new-event mode only.
- `ScheduleWorkspacePage` adds `openCreateAt({ date, startTime?, endTime? })` and passes `defaultValues` into the modal.
- Edit/reschedule flows are unchanged.

## Desktop Behavior

- Arrow navigation unchanged.
- Clicking month day cells and empty time slots also opens Add Event with prefilled date/time.
- Existing event clicks continue to select/open events.

## Event Click Preservation

- `ScheduleCalendarEventChip` and `ScheduleCalendarMultiDayBar` already stop click propagation.
- `ScheduleCalendarEventBlock` now stops propagation to prevent slot-create from firing when an event is clicked.

## Validation

- `ReadLints`: no issues on changed files.
- `npm run build`: passed successfully.

## Expected Acceptance

- Mobile month: strong horizontal swipes change months; tapping empty day area opens Add Event with that date.
- Mobile week/work week/day: scrolling the time grid does not change period; swiping the date header changes period; tapping an empty slot opens Add Event with date/time defaults.
- Desktop: arrows, cell clicks, and slot clicks open Add Event; event selection unchanged.
- No Supabase schema, schedule data model, or planner core behavior changes.
