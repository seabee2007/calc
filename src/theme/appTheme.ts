/**
 * App-wide UI tokens — canonical slate neutral scale, semantic colors, surfaces.
 * Domain themes (planner, ops, schedule) should compose from these where possible.
 */

/** Canvas / page background (matches Layout theme-color). */
export const COLOR_CANVAS_LIGHT = '#f8fafc';
export const COLOR_CANVAS_DARK = '#020617';

/** Z-index scale — do not invent ad hoc layers without updating this list. */
export const Z_NAV_MOBILE = 100;
export const Z_SCHEDULE_DRAWER = 200;
export const Z_MODAL_OVERLAY = 9998;
export const Z_MODAL = 9999;
export const Z_PLANNER_DRAWER = 10050;
export const Z_MODAL_ABOVE_DRAWER = 10101;

// --- Layout ---

export const FOCUS_RING =
  'focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:outline-none';

export const PAGE_MAX_WIDTH = 'max-w-7xl mx-auto';

/** Wider centered shell for premium canvas pages (dashboard, projects, tools, etc.). */
export const PREMIUM_PAGE_MAX_WIDTH = 'max-w-[88rem] mx-auto';

export const PAGE_GUTTER = 'px-4 sm:px-6 lg:px-8';

export const SECTION_SPACING = 'space-y-6';

export const CARD_PADDING = 'p-5';

// --- Surfaces ---

export const SURFACE =
  'bg-white dark:bg-slate-900';

export const SURFACE_ELEVATED =
  'bg-white dark:bg-slate-800';

export const SURFACE_GLASS =
  'bg-white/90 dark:bg-slate-800/95 backdrop-blur-sm';

export const SURFACE_GLASS_PANEL =
  'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm';

export const SURFACE_MUTED =
  'bg-slate-50 dark:bg-slate-800/80';

export const BORDER_DEFAULT =
  'border-slate-200 dark:border-slate-700';

export const BORDER_SUBTLE =
  'border-slate-100 dark:border-slate-800';

// --- Elevation tiers ---

/** Base page canvas — no elevation. */
export const SURFACE_0 = 'bg-slate-50 dark:bg-slate-950';

/** Standard cards and panels. */
export const SURFACE_1 = SURFACE;

/** Raised panels, popovers, dropdowns. */
export const SURFACE_2 = SURFACE_ELEVATED;

// --- Typography ---

export const TEXT_FOREGROUND =
  'text-slate-900 dark:text-slate-100';

export const TEXT_BODY =
  'text-slate-700 dark:text-slate-300';

export const TEXT_MUTED =
  'text-slate-600 dark:text-slate-400';

export const TEXT_SUBTLE =
  'text-slate-500 dark:text-slate-500';

// --- Semantic status (text / icons) ---

export const TEXT_SUCCESS = 'text-emerald-600 dark:text-emerald-400';
export const TEXT_WARNING = 'text-amber-600 dark:text-amber-400';
export const TEXT_DANGER = 'text-red-600 dark:text-red-400';
export const TEXT_INFO = 'text-blue-600 dark:text-blue-400';
export const TEXT_ACCENT = 'text-cyan-700 dark:text-cyan-400';

export const BG_SUCCESS = 'bg-emerald-500';
export const BG_WARNING = 'bg-amber-400';
export const BG_DANGER = 'bg-red-500';
export const BG_INFO = 'bg-blue-500';

export const STATUS_ON_TRACK = BG_SUCCESS;
export const STATUS_AT_RISK = BG_WARNING;
export const STATUS_DELAYED = BG_DANGER;

// --- Cards & sections ---

export const APP_SECTION_CARD =
  'rounded-xl border border-slate-200/80 bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-800/95';

/** Main elevated section card on premium canvas pages. */
export const PREMIUM_PANEL =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/30';

/** KPI / metric chip on premium canvas pages. */
export const PREMIUM_KPI_CARD =
  'rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-200/50 dark:border-slate-700/70 dark:bg-slate-900/90 dark:shadow-black/25';

/** Nested stat or detail box inside a premium panel. */
export const PREMIUM_INNER_PANEL =
  'rounded-lg border border-slate-200/70 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/50';

/** Actionable list row with hover/focus states. */
export const PREMIUM_ACTION_ROW =
  'rounded-xl border border-slate-200/80 bg-white/90 transition-all hover:border-blue-300 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700/70 dark:bg-slate-800/70 dark:hover:border-cyan-700/60 dark:hover:bg-slate-800 dark:hover:shadow-black/20 dark:focus-visible:ring-offset-slate-900';

/** CTA pill inside an action row. */
export const PREMIUM_CTA_PILL =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-cyan-500 group-active:bg-cyan-700';

/** Next-actions section wrapper. */
export const PREMIUM_ACTIONS_SECTION =
  'rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/90 to-slate-50/90 shadow-inner shadow-slate-200/30 dark:border-cyan-900/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-blue-950/40 dark:shadow-black/20';

export const SHADOW_CARD = 'shadow-md dark:shadow-lg';

// --- Modal / drawer shells ---

export const MODAL_PANEL =
  'rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-300/40 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/95 dark:shadow-2xl dark:shadow-black/40';

export const MODAL_HEADER =
  'flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700/70';

export const MODAL_TITLE = `text-xl font-semibold tracking-tight ${TEXT_FOREGROUND}`;

export const MODAL_BODY =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6 text-slate-700 dark:text-slate-300 [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184)_transparent] dark:[scrollbar-color:rgb(71_85_105)_transparent]';

export const MODAL_CLOSE_BTN =
  `${FOCUS_RING} rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100`;

export const DRAWER_PANEL =
  `flex h-full w-full flex-col border-l shadow-2xl ${BORDER_DEFAULT} ${SURFACE_ELEVATED}`;

export const DRAWER_HEADER =
  `flex items-center justify-between border-b px-4 py-3 ${BORDER_DEFAULT}`;

export const DRAWER_CLOSE_BTN =
  'rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

export const MENU_PANEL =
  `absolute z-20 mt-1 rounded-lg border py-1 shadow-lg ${BORDER_DEFAULT} ${SURFACE_ELEVATED}`;

// --- Forms ---

export const FORM_LABEL =
  'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200';

export const FORM_LABEL_FOCUS = 'text-blue-600 dark:text-blue-400';

export const FORM_LABEL_ERROR = 'text-red-500 dark:text-red-400';

export const FORM_INPUT =
  'block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500';

export const FORM_INPUT_PLANNER =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-500';

export const FORM_TEXTAREA = FORM_INPUT;

export const FORM_HELPER =
  'mt-1 text-sm text-slate-500 dark:text-slate-400';

export const FORM_ERROR =
  'mt-1 text-sm text-red-500 dark:text-red-400';

export const FORM_SELECT_CHEVRON_LIGHT =
  "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")]";

export const FORM_SELECT_CHEVRON_DARK =
  "dark:bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")]";

// --- Tables ---

export const PLANNER_TABLE_WRAPPER =
  `overflow-x-auto rounded-xl border ${BORDER_DEFAULT} ${SURFACE}`;

export const PLANNER_TABLE = 'min-w-full text-left text-sm';

export const PLANNER_TABLE_HEAD =
  'border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';

export const PLANNER_TABLE_ROW =
  'border-b border-slate-100 dark:border-slate-800';

export const PLANNER_TABLE_ROW_HIGHLIGHT =
  'bg-cyan-50/80 dark:bg-cyan-950/30';

// --- Calculator sections ---

export const CALCULATOR_SECTION =
  `rounded-lg border ${BORDER_DEFAULT} ${SURFACE_GLASS} p-4 sm:p-6`;

export const CALCULATOR_SECTION_TITLE =
  `text-lg font-semibold ${TEXT_FOREGROUND}`;

export const CALCULATOR_SECTION_SUBTITLE =
  `text-sm ${TEXT_MUTED} mt-1`;
