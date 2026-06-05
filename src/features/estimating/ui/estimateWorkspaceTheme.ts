/**
 * Estimate Workspace UI tokens — composes planner/app theme; no bespoke palette.
 */
export {
  PLANNER_EYEBROW,
  PLANNER_FORM_PANEL,
  PLANNER_LINK,
  PLANNER_MUTED,
  PLANNER_PAGE_BG,
  PLANNER_SECTION_TITLE,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_WRAPPER,
} from '../../../components/planner/plannerTheme';

export { BADGE_BASE, BADGE_INFO } from '../../../theme/statusColors';
export {
  BORDER_DEFAULT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../theme/appTheme';

/** Shared desktop grid — read-only rows (no actions column). */
export const ESTIMATE_LINE_ITEM_ROW_GRID =
  'hidden sm:grid sm:grid-cols-[minmax(220px,1fr)_7.5rem_7.5rem_8.75rem] sm:items-center gap-x-3 px-3';

/** Shared desktop grid — draft rows with fixed-width actions column. */
export const ESTIMATE_LINE_ITEM_ROW_GRID_WITH_ACTIONS =
  'hidden sm:grid sm:grid-cols-[minmax(220px,1fr)_7.5rem_7.5rem_8.75rem_11.25rem] sm:items-center gap-x-3 px-3';

export const ESTIMATE_LINE_ITEM_COL_TASK = 'min-w-0 truncate text-left';

export const ESTIMATE_LINE_ITEM_COL_NUM =
  'tabular-nums text-right text-xs';

export const ESTIMATE_LINE_ITEM_COL_SELL =
  'tabular-nums text-right text-xs font-medium';

export const ESTIMATE_LINE_ITEM_COL_ACTIONS =
  'flex min-w-0 items-center justify-end';

/** Outer grouped line-item tree — opaque but not near-black. */
export const ESTIMATE_LINE_ITEMS_PANEL =
  'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90';

export const ESTIMATE_DIVISION_BLOCK =
  'border-b border-slate-200 last:border-b-0 dark:border-slate-700/80';

export const ESTIMATE_DIVISION_HEADER =
  'bg-slate-100 px-3 py-2 transition-colors hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800';

export const ESTIMATE_DIVISION_BODY =
  'bg-white px-1 py-1 dark:bg-slate-900/85 sm:px-2';

export const ESTIMATE_SCOPE_BLOCK =
  'my-1 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700/80';

export const ESTIMATE_SCOPE_HEADER =
  'bg-slate-50 px-2 py-1.5 transition-colors hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800/85';

export const ESTIMATE_SCOPE_BODY =
  'border-t border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-900/85';

export const ESTIMATE_TASK_ROW =
  'border-b border-slate-200/90 bg-white py-1.5 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-900/70 dark:hover:bg-slate-800/75';

export const ESTIMATE_TASK_ROW_MOBILE =
  'rounded border border-slate-200/90 bg-slate-50 px-2.5 py-2 transition-colors hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/75 dark:hover:bg-slate-800/80';

export const ESTIMATE_LINE_ITEM_COLUMN_HEADER =
  'border-b border-slate-300/90 bg-slate-200/90 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-slate-300';

export const ESTIMATE_TASK_ROW_ACTION =
  '!h-6 !w-6 !px-0 border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700/90';
