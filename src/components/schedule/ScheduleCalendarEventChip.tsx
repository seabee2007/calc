import React from 'react';
import { Repeat } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_STYLES } from './scheduleTheme';
import ScheduleStatusBadge from './ScheduleStatusBadge';
import { logScheduleTouchDebug } from '../../utils/scheduleTouchInteraction';

interface Props {
  event: ScheduleEvent;
  selected?: boolean;
  onClick: () => void;
  compact?: boolean;
}

export default function ScheduleCalendarEventChip({
  event,
  selected,
  onClick,
  compact,
}: Props) {
  const style = SCHEDULE_EVENT_TYPE_STYLES[event.eventType];
  const typeLabel = SCHEDULE_EVENT_TYPE_LABELS[event.eventType];
  const isOrangeDelivery = event.eventType === 'material_delivery' || event.eventType === 'equipment_delivery';
  const titleColor = isOrangeDelivery
    ? 'text-orange-900 dark:text-orange-100'
    : 'text-[#1F2937] dark:text-slate-100';
  const subtitleColor = isOrangeDelivery
    ? 'text-orange-700 dark:text-orange-200'
    : 'text-[#4B5563] dark:text-slate-300';
  const metaColor = isOrangeDelivery
    ? 'text-orange-700/80 dark:text-orange-200/80'
    : 'text-[#6B7280] dark:text-slate-400';

  return (
    <button
      type="button"
      data-schedule-event="true"
      data-no-swipe="true"
      onClick={(e) => {
        e.stopPropagation();
        logScheduleTouchDebug('event chip clicked', { id: event.id });
        onClick();
      }}
      className={`flex w-full min-w-0 flex-col gap-0.5 rounded border px-1.5 py-1 text-left ${
        selected
          ? 'border-[#2563EB] bg-[#2563EB] text-white ring-1 ring-[#2563EB]'
          : `${style.surface} hover:brightness-[0.97] dark:hover:brightness-110`
      }`}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span
          className={`h-3 w-1 shrink-0 rounded-full ${selected ? 'bg-white' : style.dot}`}
          aria-hidden
        />
        <span
          className={`flex min-w-0 items-center gap-0.5 truncate text-[10px] font-semibold leading-tight ${
            selected ? 'text-white' : titleColor
          }`}
        >
          {(event.recurrenceRule || event.isRecurringInstance || event.seriesMasterId) && (
            <Repeat className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
          )}
          <span className="truncate">{event.title}</span>
        </span>
      </div>
      <span
        className={`truncate pl-2 text-[10px] leading-tight ${
          selected ? 'text-blue-100' : subtitleColor
        }`}
      >
        {event.projectName ?? 'Project'}
      </span>
      <span
        className={`truncate pl-2 text-[9px] leading-tight ${
          selected ? 'text-blue-100' : metaColor
        }`}
      >
        {typeLabel}
      </span>
      {!compact && (
        <span className="pl-2">
          <ScheduleStatusBadge status={event.status} compact />
        </span>
      )}
    </button>
  );
}
