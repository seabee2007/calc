import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import ScheduleCalendarEventChip from '../../ScheduleCalendarEventChip';
import ScheduleEmptyState from '../../ScheduleEmptyState';
import {
  formatScheduleEventDateRange,
  formatScheduleTime,
  groupEventsByDayForAgenda,
  isMultiDayEvent,
} from '../../../../utils/scheduleEventUtils';
import { SCHEDULE_HEADING, SCHEDULE_MUTED } from '../../scheduleTheme';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  todayIso: string;
}

export default function ScheduleCalendarAgendaView({
  events,
  selectedId,
  onSelect,
  todayIso,
}: Props) {
  const groups = useMemo(
    () => groupEventsByDayForAgenda(events, todayIso),
    [events, todayIso],
  );

  if (events.length === 0) {
    return <ScheduleEmptyState />;
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className={`mb-3 text-sm font-semibold ${SCHEDULE_HEADING}`}>{g.label}</h3>
          <div className="space-y-2">
            {g.events.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="w-20 shrink-0 pt-1 text-xs font-medium text-[#2563EB]">
                  {isMultiDayEvent(event)
                    ? formatScheduleEventDateRange(event)
                    : event.startTime
                      ? formatScheduleTime(event.startTime)
                      : 'All day'}
                </div>
                <div className="min-w-0 flex-1">
                  <ScheduleCalendarEventChip
                    event={event}
                    selected={selectedId === event.id}
                    onClick={() => onSelect(event.id)}
                  />
                  {(event.trade || event.crew) && (
                    <p className={`mt-1 pl-2 text-xs ${SCHEDULE_MUTED}`}>
                      {[event.trade, event.crew].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
