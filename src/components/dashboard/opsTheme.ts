/** Shared Tailwind classes for operations dashboard panels (light + dark). */

import {
  APP_SECTION_CARD,
  PREMIUM_ACTION_ROW,
  PREMIUM_INNER_PANEL,
  PREMIUM_KPI_CARD,
  PREMIUM_PANEL,
  TEXT_ACCENT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from '../../theme/appTheme';

export const OPS_SHELL =
  `text-slate-900 dark:text-slate-100 isolation-auto rounded-xl min-h-[200px]`;

export const OPS_PANEL = `${PREMIUM_PANEL} p-6`;

/**
 * Shared outer shell for Operations Dashboard grid widgets — same elevation as
 * Schedule & Deadlines and Today's Operations (`PREMIUM_PANEL`).
 */
export const DASHBOARD_CARD_SHELL = PREMIUM_PANEL;

/** Nested panel inside a dashboard shell (e.g. schedule sub-panels). */
export const DASHBOARD_CARD_INNER = PREMIUM_INNER_PANEL;

/** Hero card — matches the shared dashboard widget shell. */
export const OPS_HERO_CARD = DASHBOARD_CARD_SHELL;

export const OPS_HERO_LABEL = TEXT_ACCENT;

export const OPS_HERO_BODY = 'text-slate-600 dark:text-slate-300';

export const OPS_HERO_STAT_LABEL = 'text-slate-600 dark:text-slate-400';

export const OPS_HERO_STAT_VALUE = 'text-slate-900 dark:text-white';

export const OPS_HERO_STAT_INNER = PREMIUM_INNER_PANEL;

export const OPS_MUTED = TEXT_MUTED;

export const OPS_SUBTLE = TEXT_SUBTLE;

export const OPS_TITLE = TEXT_FOREGROUND;

export const OPS_BODY = TEXT_BODY;

/** Standard in-page section panel — matches OpsCard panel surface. */
export const OPS_SECTION = `${PREMIUM_PANEL} p-4`;

export const OPS_SECTION_EYEBROW = OPS_SUBTLE;

export const OPS_SECTION_TITLE = `${OPS_TITLE} font-semibold`;

export const OPS_PROJECT_HERO = OPS_HERO_CARD;

export const OPS_PANEL_INNER = PREMIUM_INNER_PANEL;

export const OPS_OUTLINE_BTN =
  '!border-slate-300 !text-gray-800 hover:!bg-slate-100 dark:!border-slate-600 dark:!text-white dark:hover:!bg-slate-700';

export const OPS_LIST_ROW =
  'border border-slate-200 bg-slate-50 shadow-sm shadow-slate-200/40 dark:border-slate-700/80 dark:bg-slate-800/50 dark:shadow-black/15';

export const OPS_STRIP =
  'rounded-xl border border-cyan-500/30 bg-white/95 px-4 py-4 shadow-lg shadow-slate-200/50 dark:bg-slate-900/95 dark:shadow-black/25';

export const OPS_EMPTY_STATE =
  'rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800/90';

export const OPS_ATTENTION_CHIP =
  'rounded-md border border-slate-200 bg-slate-100 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/50';

export const OPS_HOVER_ROW =
  'text-sm text-slate-600 hover:text-gray-900 transition-colors dark:text-slate-300 dark:hover:text-white';

/** KPI strip metric chip — compact dashboard header stats. */
export const OPS_KPI_CHIP = PREMIUM_KPI_CARD;

/** Compact section card — less padding than OPS_SECTION. */
export const OPS_COMPACT_CARD = `${PREMIUM_PANEL} p-4`;

/** Next-action list row. */
export const OPS_ACTION_ITEM = `${PREMIUM_ACTION_ROW} px-3 py-2.5`;

export const OPS_CTA_PILL =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-cyan-500 group-active:bg-cyan-700';
