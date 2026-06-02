# Planner Task Menu Visibility Fix Report

## Root Cause

The Planner task card action menu was rendered absolutely inside `TaskCardMenu`, which lives inside `PlannerTaskCard`.

The task card style includes `overflow-hidden`, and the bucket task list is a scrolling container. Together, those wrappers clipped the dropdown so only part of the white menu was visible.

## Files Changed

- `src/components/planner/TaskCardMenu.tsx`
- `PLANNER_TASK_MENU_VISIBILITY_FIX_REPORT.md`

## Portal Used

Yes. The task action menu now renders with `createPortal(..., document.body)` as a fixed-position popover.

The 3-dot button still stays in the task card, but the opened menu is no longer a child of the clipped task card or bucket column.

## Positioning Behavior

- Uses the 3-dot button's `getBoundingClientRect()` to position the menu.
- Aligns the menu to the button's right edge.
- Clamps horizontally to the viewport.
- Opens upward when there is not enough space below.
- Repositions on window resize and scroll.
- Uses `z-[9999]` so it appears above the board/card layers.

## Menu Actions Confirmed

The existing task actions were preserved:

- Open
- Mark complete, when task is not completed
- Move to another bucket
- Create RFI
- Create FAR

No task logic, board data, Supabase logic, or Planner feature behavior was changed.

## Close Behavior

The menu closes when:

- The user selects a menu action.
- The user presses Escape.
- The user clicks/taps outside the menu.
- Another task menu opens.

Only one task card menu should remain open at a time.

## Light/Dark Mode

The menu uses Concrete Calc-compatible classes:

- Light: `bg-white`, `border-slate-200`, `text-slate-900`, `hover:bg-slate-100`
- Dark: `dark:bg-slate-900`, `dark:border-slate-700`, `dark:text-slate-100`, `dark:hover:bg-slate-800`

## Validation

- `npm run build`: passed.
- IDE targeted lint diagnostics timed out twice for `TaskCardMenu.tsx`, but the production TypeScript/Vite build completed successfully.
