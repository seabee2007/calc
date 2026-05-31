import React from 'react';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import ScheduleEventTypeBadge from '../ScheduleEventTypeBadge';
import ScheduleStatusBadge from '../ScheduleStatusBadge';
import SchedulePriorityBadge from '../SchedulePriorityBadge';
import ScheduleEmptyState from '../ScheduleEmptyState';
import Button from '../../ui/Button';
import { SCHEDULE_CARD, SCHEDULE_BODY, SCHEDULE_MUTED, SCHEDULE_TABLE_HEAD, SCHEDULE_TABLE_ROW, SCHEDULE_TABLE_WRAPPER } from '../scheduleTheme';
import { formatScheduleDate, statusAccentClass } from '../../../utils/scheduleEventUtils';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ScheduleListView({ events, selectedId, onSelect }: Props) {
  if (events.length === 0) {
    return <ScheduleEmptyState />;
  }

  return (
    <>
      <div className={`hidden md:block ${SCHEDULE_TABLE_WRAPPER}`}>
        <table className="min-w-full text-left text-sm">
          <thead className={SCHEDULE_TABLE_HEAD}>
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Crew</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className={`${SCHEDULE_TABLE_ROW} ${statusAccentClass(
                  event.status,
                )} ${selectedId === event.id ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                  {formatScheduleDate(event.startDate)}
                </td>
                <td className={`max-w-[200px] truncate px-4 py-3 font-medium ${SCHEDULE_BODY}`}>
                  {event.title}
                </td>
                <td className={`px-4 py-3 ${SCHEDULE_MUTED}`}>{event.projectName}</td>
                <td className="px-4 py-3">
                  <ScheduleEventTypeBadge type={event.eventType} compact />
                </td>
                <td className="px-4 py-3">
                  <SchedulePriorityBadge priority={event.priority} compact />
                </td>
                <td className={`max-w-[120px] truncate px-4 py-3 ${SCHEDULE_MUTED}`}>
                  {event.assignedTo.join(', ') || '—'}
                </td>
                <td className={`px-4 py-3 ${SCHEDULE_MUTED}`}>{event.trade ?? '—'}</td>
                <td className={`px-4 py-3 ${SCHEDULE_MUTED}`}>{event.crew ?? '—'}</td>
                <td className="px-4 py-3">
                  <ScheduleStatusBadge status={event.status} compact />
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => onSelect(event.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event.id)}
            className={`${SCHEDULE_CARD} w-full p-4 text-left ${statusAccentClass(event.status)} ${
              selectedId === event.id ? 'ring-2 ring-[#2563EB]/40' : ''
            }`}
          >
            <div className="flex flex-wrap gap-2">
              <ScheduleEventTypeBadge type={event.eventType} compact />
              <ScheduleStatusBadge status={event.status} compact />
              <SchedulePriorityBadge priority={event.priority} compact />
            </div>
            <p className={`mt-2 font-semibold ${SCHEDULE_BODY}`}>{event.title}</p>
            <p className={`text-xs ${SCHEDULE_MUTED}`}>
              {event.projectName} · {formatScheduleDate(event.startDate)}
            </p>
            {event.assignedTo.length > 0 && (
              <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>
                Assigned: {event.assignedTo.join(', ')}
              </p>
            )}
            {(event.trade || event.crew) && (
              <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>
                {[event.trade, event.crew].filter(Boolean).join(' · ')}
              </p>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
