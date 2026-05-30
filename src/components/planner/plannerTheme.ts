/**
 * Field Planner theme tokens — light/dark compatible (glass cards + cyan accents).
 * Aligns with Proposals / Projects pages and ops dashboard accents.
 */

export const PLANNER_HEADING =
  'text-2xl font-bold tracking-tight text-gray-900 dark:text-white';

export const PLANNER_SUBTITLE = 'text-sm text-gray-600 dark:text-slate-400';

export const PLANNER_EYEBROW =
  'text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400';

export const PLANNER_LINK =
  'inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300';

export const PLANNER_ICON_ACCENT = 'text-cyan-600 dark:text-cyan-400';

/** Wraps the board horizontal scroll area */
export const PLANNER_BOARD_SURFACE =
  'rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-inner backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/40';

export const PLANNER_BUCKET =
  'flex w-[280px] shrink-0 flex-col rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/75 dark:shadow-lg';

export const PLANNER_BUCKET_HEADER =
  'border-b border-slate-200/90 px-3 py-3 dark:border-slate-700/80';

export const PLANNER_BUCKET_TITLE = 'font-semibold text-gray-900 dark:text-slate-100';

export const PLANNER_BUCKET_META = 'text-xs text-gray-500 dark:text-slate-500';

export const PLANNER_BUCKET_FOOTER =
  'border-t border-slate-200/90 p-2 dark:border-slate-700/80';

export const PLANNER_TASK_CARD =
  'w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-500/60 hover:shadow-md dark:border-slate-600/80 dark:bg-slate-800/90 dark:shadow-sm dark:hover:border-cyan-500/40 dark:hover:shadow-md';

export const PLANNER_TASK_TITLE =
  'font-medium text-gray-900 line-clamp-2 dark:text-slate-100';

export const PLANNER_TASK_META = 'text-xs text-gray-600 dark:text-slate-400';

export const PLANNER_TASK_META_MUTED = 'text-xs text-gray-400 dark:text-slate-500';

export const PLANNER_TASK_ACCENT = 'text-cyan-700 dark:text-cyan-400/90';

export const PLANNER_DRAWER_BACKDROP = 'fixed inset-0 z-[9990] flex justify-end bg-black/40 dark:bg-black/50';

export const PLANNER_DRAWER_PANEL =
  'flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white/98 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/98 md:max-w-xl';

export const PLANNER_DRAWER_FULL_PAGE =
  'fixed inset-0 z-[9990] flex flex-col bg-white dark:bg-slate-950';

export const PLANNER_DRAWER_HEADER =
  'flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700';

export const PLANNER_DRAWER_FOOTER =
  'border-t border-slate-200 p-4 space-y-2 safe-area-pb dark:border-slate-700';

export const PLANNER_DRAWER_TITLE = 'text-lg font-semibold text-gray-900 dark:text-white';

export const PLANNER_DRAWER_BODY = 'text-sm text-gray-600 whitespace-pre-wrap dark:text-slate-300';

export const PLANNER_SECTION_TITLE =
  'text-sm font-semibold text-gray-900 dark:text-slate-200';

export const PLANNER_MUTED = 'text-sm text-gray-500 dark:text-slate-500';

export const PLANNER_INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500';

export const PLANNER_COMMENT_BOX =
  'rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60';

export const PLANNER_COMMENT_TEXT = 'text-sm text-gray-800 dark:text-slate-200';

export const PLANNER_ATTACHMENT_TILE =
  'group rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-sm transition hover:border-cyan-500/50 dark:border-slate-700 dark:bg-slate-800/80';

export const PLANNER_ATTACHMENT_ICON = 'text-gray-400 dark:text-slate-400';

export const PLANNER_ATTACHMENT_NAME =
  'mt-1 truncate text-xs text-gray-500 group-hover:text-gray-800 dark:text-slate-400 dark:group-hover:text-slate-200';

export const PLANNER_UPLOAD_ZONE =
  'flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-500/50 bg-cyan-50/90 text-cyan-800 transition hover:bg-cyan-100/90 dark:border-cyan-500/40 dark:bg-cyan-950/20 dark:text-cyan-300 dark:hover:bg-cyan-950/40';

export const PLANNER_BTN_PRIMARY =
  '!bg-cyan-600 !text-white hover:!bg-cyan-500 dark:!bg-cyan-600 dark:hover:!bg-cyan-500';

export const PLANNER_BTN_GHOST =
  'w-full !text-gray-700 hover:!bg-slate-100 dark:!text-slate-300 dark:hover:!bg-slate-800';

export const PLANNER_BTN_OUTLINE_DASHED =
  '!border-dashed !border-slate-300 !text-gray-700 hover:!bg-slate-50 dark:!border-slate-600 dark:!text-slate-300 dark:hover:!bg-slate-800/80';

export const PLANNER_CLOSE_BTN =
  'rounded-lg p-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

export const PLANNER_CHECKLIST_DONE = 'text-gray-400 line-through dark:text-slate-500';

export const PLANNER_CHECKLIST_ACTIVE = 'text-gray-800 dark:text-slate-200';

export const PLANNER_CHECKLIST_ICON = 'text-cyan-600 dark:text-cyan-400';

export const PLANNER_ACTIVITY_STRIP =
  'rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-600/80 dark:bg-slate-800/50 dark:shadow-md';

export const PLANNER_ACTIVITY_TITLE =
  'text-sm font-semibold text-gray-900 dark:text-slate-200';

export const PLANNER_ACTIVITY_SUMMARY =
  'text-gray-700 dark:text-slate-200';

export const PLANNER_ACTIVITY_TIME = 'text-xs text-gray-500 dark:text-slate-400';
