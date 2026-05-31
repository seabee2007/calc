import React, { useMemo, useState } from 'react';
import { Diamond } from 'lucide-react';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import type { TimelineScale } from '../../../types/scheduleEvent';
import { TIMELINE_SCALES } from '../../../types/scheduleEvent';
import ScheduleEmptyState from '../ScheduleEmptyState';
import { SCHEDULE_CARD, SCHEDULE_HEADING, SCHEDULE_MUTED } from '../scheduleTheme';
import {
  eventTimelineColumnKey,
  getTimelineColumns,
  groupEventsByProjectThenDate,
  statusAccentClass,
  toIsoDate,
} from '../../../utils/scheduleEventUtils';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  dateFrom: string;
  dateTo: string;
}

export default function ScheduleTimelineView({
  events,
  selectedId,
  onSelect,
  dateFrom,
  dateTo,
}: Props) {
  const [scale, setScale] = useState<TimelineScale>('week');
  const columns = useMemo(
    () => getTimelineColumns(scale, dateFrom, dateTo),
    [scale, dateFrom, dateTo],
  );
  const byProject = useMemo(() => groupEventsByProjectThenDate(events), [events]);

  if (events.length === 0) {
    return <ScheduleEmptyState />;
  }

  const rangeFrom = dateFrom || toIsoDate(new Date());
  const rangeTo = dateTo || rangeFrom;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {TIMELINE_SCALES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScale(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
              scale === s
                ? 'bg-[#2563EB] text-white'
                : 'border border-[#E5E7EB] text-[#4B5563] hover:bg-slate-50 dark:border-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white dark:border-slate-700 dark:bg-slate-900">
        <div
          className="grid min-w-[640px] border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-semibold uppercase text-[#6B7280] dark:border-slate-700 dark:bg-slate-800"
          style={{ gridTemplateColumns: `180px repeat(${Math.max(columns.length, 1)}, minmax(72px, 1fr))` }}
        >
          <div className="px-3 py-2">Project</div>
          {columns.map((col) => (
            <div key={col.key} className="border-l border-[#E5E7EB] px-2 py-2 dark:border-slate-700">
              {col.label}
            </div>
          ))}
        </div>
        {[...byProject.values()].map((group) => (
          <div
            key={group.projectId}
            className="grid border-b border-[#E5E7EB] last:border-0 dark:border-slate-800"
            style={{ gridTemplateColumns: `180px repeat(${Math.max(columns.length, 1)}, minmax(72px, 1fr))` }}
          >
            <div className={`px-3 py-3 text-sm font-medium ${SCHEDULE_HEADING}`}>
              {group.projectName}
            </div>
            {columns.map((col) => {
              const cellEvents = group.events.filter(
                (e) => eventTimelineColumnKey(e, scale) === col.key,
              );
              return (
                <div
                  key={col.key}
                  className="min-h-[52px] border-l border-[#E5E7EB] p-1 dark:border-slate-800"
                >
                  <div className="flex flex-col gap-1">
                    {cellEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelect(event.id)}
                        title={event.title}
                        className={`${SCHEDULE_CARD} flex items-center gap-1 px-2 py-1 text-left text-xs ${statusAccentClass(
                          event.status,
                        )} ${selectedId === event.id ? 'ring-2 ring-[#2563EB]/40' : ''}`}
                      >
                        {event.milestoneKey && (
                          <Diamond className="h-3 w-3 shrink-0 text-amber-500" />
                        )}
                        <span className="truncate font-medium">{event.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className={`text-xs ${SCHEDULE_MUTED}`}>
        Showing {rangeFrom} – {rangeTo}. Milestones marked with ◆. Delayed events use amber accent.
      </p>
    </div>
  );
}
