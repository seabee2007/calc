import React from 'react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventTypeBadge from './ScheduleEventTypeBadge';
import ScheduleStatusBadge from './ScheduleStatusBadge';
import { SCHEDULE_EVENT_TYPE_STYLES } from './scheduleTheme';
import { formatScheduleEventDateRange, statusAccentClass } from '../../utils/scheduleEventUtils';

interface Props {
  event: ScheduleEvent;
  selected?: boolean;
  onClick: () => void;
  /** CSS grid-column value, e.g. "2 / span 3" */
  gridColumn?: string;
  /** 1-based grid row */
  gridRow?: number;
  showTypeBadge?: boolean;
  /** Fill parent container (month view absolute lane wrapper). */
  fillCell?: boolean;
}

export default function ScheduleCalendarMultiDayBar({
  event,
  selected,
  onClick,
  gridColumn,
  gridRow,
  showTypeBadge = true,
  fillCell = false,
}: Props) {
  const style = SCHEDULE_EVENT_TYPE_STYLES[event.eventType];
  const tooltip = `${event.title}\n${event.projectName ?? 'Project'}\n${formatScheduleEventDateRange(event)}`;
  const isOrangeDelivery = event.eventType === 'material_delivery' || event.eventType === 'equipment_delivery';
  const titleColor = isOrangeDelivery
    ? 'text-orange-900 dark:text-orange-100'
    : 'text-[#1F2937] dark:text-slate-100';
  const subtitleColor = isOrangeDelivery
    ? 'text-orange-700 dark:text-orange-200'
    : 'text-[#6B7280] dark:text-slate-400';

  return (
    <button
      type="button"
      data-schedule-event="true"
      data-no-swipe="true"
      title={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex min-h-[26px] min-w-0 items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm ${statusAccentClass(
        event.status,
      )} ${
        selected
          ? 'border-[#2563EB] ring-2 ring-[#2563EB]'
          : `${style.surface} hover:brightness-[0.97] dark:hover:brightness-110`
      } ${fillCell ? 'h-full w-full' : ''}`}
      style={gridColumn && gridRow != null ? { gridColumn, gridRow } : undefined}
    >
      <span className={`h-full w-1 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11px] font-semibold ${titleColor}`}>
          {event.title}
        </p>
        <p className={`truncate text-[10px] ${subtitleColor}`}>
          {event.projectName ?? 'Project'}
        </p>
      </div>
      {showTypeBadge && (
        <span className="hidden shrink-0 lg:inline">
          <ScheduleEventTypeBadge type={event.eventType} compact />
        </span>
      )}
      <span className="shrink-0">
        <ScheduleStatusBadge status={event.status} compact />
      </span>
    </button>
  );
}

export function multiDayLaneCount(bars: { lane: number }[]): number {
  if (bars.length === 0) return 0;
  return Math.max(...bars.map((b) => b.lane)) + 1;
}
