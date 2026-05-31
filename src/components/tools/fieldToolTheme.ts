/** Shared styling for field safety tool pages (dark + teal accents). */

import {
  APP_SECTION_CARD,
  FORM_LABEL,
  SURFACE_GLASS_PANEL,
  TEXT_ACCENT,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';

export const FIELD_TOOL_SECTION = `${APP_SECTION_CARD} sm:p-5`;

export const FIELD_TOOL_EYEBROW = `text-xs font-semibold uppercase tracking-[0.15em] ${TEXT_ACCENT}`;

export const FIELD_TOOL_SECTION_TITLE = `text-base font-semibold ${TEXT_FOREGROUND}`;

export const FIELD_TOOL_MUTED = TEXT_MUTED;

export const FIELD_TOOL_ICON = `h-6 w-6 ${TEXT_ACCENT}`;

export const FIELD_TOOL_ICON_WRAP =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-600/15 dark:bg-cyan-500/20';

export const FIELD_TOOL_STICKY_BAR =
  `print:hidden sticky bottom-0 z-20 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur-sm dark:border-slate-700 sm:-mx-0 sm:rounded-xl sm:border sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${SURFACE_GLASS_PANEL}`;

export const FIELD_TOOL_PRINT_ROOT = 'field-tool-print-root';

export const FIELD_TOOL_FORM_LABEL = FORM_LABEL;

export const FIELD_TOOL_BODY = TEXT_BODY;
