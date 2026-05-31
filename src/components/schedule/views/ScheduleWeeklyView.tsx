import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import ScheduleEventCard from '../ScheduleEventCard';
import ScheduleEmptyState from '../ScheduleEmptyState';
import Button from '../../ui/Button';
import { SCHEDULE_CARD, SCHEDULE_HEADING, SCHEDULE_MUTED } from '../scheduleTheme';
import {
  addDays,
  dayLabel,
  getWeekDays,
  getWeekStart,
  toIsoDate,
} from '../../../utils/scheduleEventUtils';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ScheduleWeeklyView({ events, selectedId, onSelect }: Props) {
  const [weekStart, setWeekStart] = useState(() => toIsoDate(getWeekStart(new Date())));
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const d of days) map.set(d, []);
    for (const e of events) {
      if (map.has(e.startDate)) {
        map.get(e.startDate)!.push(e);
      }
    }
    return map;
  }, [events, days]);

  const shiftWeek = (delta: number) => {
    setWeekStart(addDays(weekStart, delta * 7));
  };

  if (events.length === 0) {
    return <ScheduleEmptyState />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button size="sm" variant="outline" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => shiftWeek(-1)}>
          Previous
        </Button>
        <span className={`text-sm font-medium ${SCHEDULE_HEADING}`}>
          Week of {dayLabel(weekStart)}
        </span>
        <Button size="sm" variant="outline" icon={<ChevronRight className="h-4 w-4" />} onClick={() => shiftWeek(1)}>
          Next
        </Button>
      </div>

      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {days.map((day) => (
          <div key={day} className={`${SCHEDULE_CARD} min-h-[120px] p-2`}>
            <p className={`mb-2 text-xs font-semibold ${SCHEDULE_HEADING}`}>{dayLabel(day)}</p>
            <div className="space-y-2">
              {(eventsByDay.get(day) ?? []).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelect(event.id)}
                  className={`w-full rounded-lg border border-[#E5E7EB] p-2 text-left text-xs hover:shadow-sm dark:border-slate-600 ${
                    selectedId === event.id ? 'ring-2 ring-[#2563EB]/40' : ''
                  }`}
                >
                  <p className="font-medium text-[#1F2937] dark:text-slate-100 line-clamp-2">
                    {event.title}
                  </p>
                  <p className={`mt-0.5 ${SCHEDULE_MUTED} line-clamp-1`}>{event.projectName}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 md:hidden">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(day) ?? [];
          if (dayEvents.length === 0) return null;
          return (
            <div key={day}>
              <p className={`mb-2 text-sm font-semibold ${SCHEDULE_HEADING}`}>{dayLabel(day)}</p>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <ScheduleEventCard
                    key={event.id}
                    event={event}
                    selected={selectedId === event.id}
                    onClick={() => onSelect(event.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
