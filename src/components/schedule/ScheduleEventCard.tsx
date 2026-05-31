import React from 'react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import ScheduleEventTypeBadge from './ScheduleEventTypeBadge';
import ScheduleStatusBadge from './ScheduleStatusBadge';
import { SCHEDULE_CARD, SCHEDULE_BODY, SCHEDULE_MUTED } from './scheduleTheme';
import { formatScheduleDateTime, statusAccentClass } from '../../utils/scheduleEventUtils';

interface Props {
  event: ScheduleEvent;
  onClick: () => void;
  selected?: boolean;
}

export default function ScheduleEventCard({ event, onClick, selected }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${SCHEDULE_CARD} w-full p-3 text-left transition-shadow hover:shadow-md ${statusAccentClass(
        event.status,
      )} ${selected ? 'ring-2 ring-[#2563EB]/40' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ScheduleEventTypeBadge type={event.eventType} compact />
        <ScheduleStatusBadge status={event.status} compact />
      </div>
      <p className={`mt-2 text-sm font-semibold ${SCHEDULE_BODY}`}>{event.title}</p>
      {event.projectName && (
        <p className={`mt-0.5 text-xs ${SCHEDULE_MUTED}`}>{event.projectName}</p>
      )}
      <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>{formatScheduleDateTime(event)}</p>
    </button>
  );
}
