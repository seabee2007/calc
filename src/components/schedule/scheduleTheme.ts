import type {
  ScheduleEventStatus,
  ScheduleEventType,
  SchedulePriority,
} from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPES } from '../../types/scheduleEvent';
import {
  BORDER_DEFAULT,
  DRAWER_PANEL,
  FORM_INPUT,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_WRAPPER,
  SURFACE,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../theme/appTheme';

const neutralBadge =
  'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-600';

const typeStyleMap: Partial<
  Record<ScheduleEventType, { badge: string; dot: string; surface: string }>
> = {
  bid_due_date: {
    badge: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    surface: 'bg-blue-100/90 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
  },
  proposal_due: {
    badge: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
    dot: 'bg-blue-600',
    surface: 'bg-blue-100/90 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
  },
  client_meeting: {
    badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dot: 'bg-slate-500',
    surface: 'bg-slate-100 border-slate-200 dark:bg-slate-800/80 dark:border-slate-600',
  },
  contract_award: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-600',
    surface: 'bg-indigo-100/90 border-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-800',
  },
  site_visit: {
    badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    dot: 'bg-slate-500',
    surface: 'bg-slate-100 border-slate-200 dark:bg-slate-800/80 dark:border-slate-600',
  },
  preconstruction_meeting: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
    surface: 'bg-indigo-100/90 border-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-800',
  },
  mobilization: {
    badge: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    surface: 'bg-teal-100/90 border-teal-200 dark:bg-teal-950/50 dark:border-teal-800',
  },
  crew_work_day: {
    badge: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800',
    dot: 'bg-green-600',
    surface: 'bg-green-100/90 border-green-200 dark:bg-green-950/50 dark:border-green-800',
  },
  material_delivery: {
    badge: 'bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-700',
    dot: 'bg-orange-500',
    surface: 'bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-700',
  },
  equipment_delivery: {
    badge: 'bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-700',
    dot: 'bg-orange-600',
    surface: 'bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-700',
  },
  inspection: {
    badge: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
    surface: 'bg-purple-100/90 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800',
  },
  subcontractor_meeting: {
    badge: 'bg-cyan-50 text-cyan-900 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500',
    surface: 'bg-cyan-100/90 border-cyan-200 dark:bg-cyan-950/50 dark:border-cyan-800',
  },
  weather_delay: {
    badge: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    surface: 'bg-orange-100/90 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800',
  },
  change_order_deadline: {
    badge: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    surface: 'bg-red-100/90 border-red-200 dark:bg-red-950/50 dark:border-red-800',
  },
  permit_deadline: {
    badge: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
    dot: 'bg-red-400',
    surface: 'bg-red-100/90 border-red-200 dark:bg-red-950/50 dark:border-red-800',
  },
  submittal_due: {
    badge: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    surface: 'bg-rose-100/90 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800',
  },
  rfi_due: {
    badge: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800',
    dot: 'bg-rose-400',
    surface: 'bg-rose-100/90 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800',
  },
  punch_list: {
    badge: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-800',
    dot: 'bg-yellow-500',
    surface: 'bg-yellow-100/90 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800',
  },
  closeout: {
    badge: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    dot: 'bg-gray-600',
    surface: 'bg-gray-100 border-gray-200 dark:bg-slate-800/80 dark:border-slate-600',
  },
  warranty_follow_up: {
    badge: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    dot: 'bg-gray-500',
    surface: 'bg-gray-100 border-gray-200 dark:bg-slate-800/80 dark:border-slate-600',
  },
  general_task: {
    badge: neutralBadge,
    dot: 'bg-neutral-400',
    surface: 'bg-neutral-50 border-neutral-200 dark:bg-slate-800/80 dark:border-slate-600',
  },
};

const defaultTypeStyle = {
  badge: neutralBadge,
  dot: 'bg-neutral-400',
  surface: 'bg-neutral-50 border-neutral-200 dark:bg-slate-800/80 dark:border-slate-600',
};

export const SCHEDULE_EVENT_TYPE_STYLES = Object.fromEntries(
  SCHEDULE_EVENT_TYPES.map((t) => [t, { ...defaultTypeStyle, ...typeStyleMap[t] }]),
) as Record<ScheduleEventType, { badge: string; dot: string; surface: string }>;

export const SCHEDULE_PAGE_BG = 'bg-slate-50 dark:bg-slate-950';
export const SCHEDULE_CARD =
  `rounded-xl border shadow-sm ${BORDER_DEFAULT} ${SURFACE}`;
export const SCHEDULE_HEADING = TEXT_FOREGROUND;
export const SCHEDULE_BODY = TEXT_BODY;
export const SCHEDULE_MUTED = TEXT_MUTED;
export const SCHEDULE_SUB_NAV =
  `w-full lg:w-60 shrink-0 flex flex-col gap-4 border-slate-200 lg:border-r lg:pr-4 dark:border-slate-700`;
export const SCHEDULE_DETAIL_PANEL =
  `hidden lg:flex lg:w-[24%] lg:min-w-[280px] lg:max-w-[360px] shrink-0 flex-col border-l ${BORDER_DEFAULT} ${SURFACE}`;

export const SCHEDULE_CALENDAR_GRID =
  `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950`;

export const SCHEDULE_TOOLBAR =
  `flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4 ${BORDER_DEFAULT} ${SURFACE}`;

export const SCHEDULE_FILTER_INPUT =
  `rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 ${FORM_INPUT}`;

export const SCHEDULE_ACCENT = 'text-blue-600 dark:text-blue-400';
export const SCHEDULE_ACCENT_BORDER = 'border-blue-600 dark:border-blue-400';
export const SCHEDULE_ACCENT_BG = 'bg-blue-600';
export const SCHEDULE_ACCENT_RING = 'ring-blue-600 dark:ring-blue-400';

export const SCHEDULE_DRAWER_PANEL = DRAWER_PANEL;

export const SCHEDULE_TABLE_WRAPPER = PLANNER_TABLE_WRAPPER;
export const SCHEDULE_TABLE = PLANNER_TABLE;
export const SCHEDULE_TABLE_HEAD = `${PLANNER_TABLE_HEAD} font-semibold tracking-wide`;
export const SCHEDULE_TABLE_ROW = PLANNER_TABLE_ROW;

export const SCHEDULE_STATUS_STYLES: Record<ScheduleEventStatus, { badge: string }> = {
  scheduled: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  },
  in_progress: {
    badge: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200',
  },
  completed: {
    badge: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200',
  },
  delayed: {
    badge: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200',
  },
  cancelled: {
    badge: 'bg-gray-100 text-gray-500 border-gray-200 line-through dark:bg-slate-800 dark:text-slate-500',
  },
  needs_attention: {
    badge: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200',
  },
};

export const SCHEDULE_PRIORITY_STYLES: Record<SchedulePriority, { badge: string }> = {
  low: { badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400' },
  medium: { badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200' },
  high: { badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200' },
  critical: { badge: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-200' },
};

export const SCHEDULE_SUB_TAB =
  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors';
