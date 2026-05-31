import React from 'react';
import { Repeat } from 'lucide-react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_STYLES } from './scheduleTheme';
import ScheduleStatusBadge from './ScheduleStatusBadge';

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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
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
            selected ? 'text-white' : 'text-[#1F2937] dark:text-slate-100'
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
          selected ? 'text-blue-100' : 'text-[#4B5563] dark:text-slate-300'
        }`}
      >
        {event.projectName ?? 'Project'}
      </span>
      <span
        className={`truncate pl-2 text-[9px] leading-tight ${
          selected ? 'text-blue-100' : 'text-[#6B7280] dark:text-slate-400'
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
