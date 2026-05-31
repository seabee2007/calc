/** Shared Tailwind classes for operations dashboard panels (light + dark). */

import {
  APP_SECTION_CARD,
  TEXT_ACCENT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from '../../theme/appTheme';

export const OPS_SHELL =
  `text-slate-900 dark:text-slate-100 isolation-auto rounded-xl min-h-[200px]`;

export const OPS_PANEL = APP_SECTION_CARD;

/** Hero card — matches OpsCard `panel` surface (slate-900 dark), not APP_SECTION_CARD slate-800. */
export const OPS_HERO_CARD =
  'border border-slate-200 bg-white/90 shadow-lg backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/90';

export const OPS_HERO_LABEL = TEXT_ACCENT;

export const OPS_HERO_BODY = 'text-slate-600 dark:text-slate-300';

export const OPS_HERO_STAT_LABEL = 'text-slate-500 dark:text-slate-400';

export const OPS_HERO_STAT_VALUE = 'text-slate-900 dark:text-white';

export const OPS_HERO_STAT_INNER =
  'rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700/70 dark:bg-slate-800/50';

export const OPS_PANEL_INNER =
  'rounded-lg border border-slate-100 bg-slate-50 dark:border-transparent dark:bg-slate-800/80';

export const OPS_MUTED = TEXT_MUTED;

export const OPS_SUBTLE = TEXT_SUBTLE;

export const OPS_TITLE = TEXT_FOREGROUND;

export const OPS_BODY = TEXT_BODY;

export const OPS_OUTLINE_BTN =
  '!border-slate-300 !text-gray-800 hover:!bg-slate-100 dark:!border-slate-600 dark:!text-white dark:hover:!bg-slate-700';

export const OPS_LIST_ROW =
  'border border-slate-200 bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/50';

export const OPS_STRIP =
  'rounded-xl border border-cyan-500/30 bg-white/95 px-4 py-4 shadow-lg dark:bg-slate-900/95';

export const OPS_EMPTY_STATE =
  'rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-600 dark:bg-slate-800/90';

export const OPS_ATTENTION_CHIP =
  'rounded-md border border-slate-200 bg-slate-100 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/50';

export const OPS_HOVER_ROW =
  'text-sm text-slate-600 hover:text-gray-900 transition-colors dark:text-slate-300 dark:hover:text-white';
