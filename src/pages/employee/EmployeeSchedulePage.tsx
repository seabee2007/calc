import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import { fetchScheduleEventsForProjectIds } from '../../services/scheduleEventService';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS } from '../../types/scheduleEvent';
import EmployeeFilterChips from '../../components/employee/EmployeeFilterChips';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

type ScheduleFilter = 'today' | 'upcoming' | 'all';

const FILTER_CHIPS: { id: ScheduleFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All' },
];

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isUpcoming(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date(new Date().toDateString());
  return d > today;
}

function formatEventDate(event: ScheduleEvent): string {
  const date = new Date(event.startDate);
  const time = event.startTime ? ` · ${event.startTime}` : '';
  return `${date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}${time}`;
}

function ScheduleEventCard({
  event,
  projectName,
}: {
  event: ScheduleEvent;
  projectName: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
            {formatEventDate(event)}
          </p>
          <p className="mt-1 font-semibold text-white">{event.title}</p>
          <p className="mt-1 text-sm text-slate-400">{projectName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
          {event.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
        <span>{SCHEDULE_EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
        {event.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function EmployeeSchedulePage() {
  useEmployeePageTitle('Schedule');
  const { user } = useAuth();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<ScheduleFilter>('today');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const assigned = await fetchAssignedProjects(user.id);
      setProjects(assigned as { id: string; name: string }[]);
      const projectIds = assigned.map((p) => p.id);
      const loaded = await fetchScheduleEventsForProjectIds(projectIds);
      setEvents(loaded);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case 'today':
        return events.filter((e) => isToday(e.startDate));
      case 'upcoming':
        return events.filter((e) => isUpcoming(e.startDate) || isToday(e.startDate));
      default:
        return events;
    }
  }, [events, filter]);

  return (
    <div className="space-y-4">
      <EmployeeFilterChips chips={FILTER_CHIPS} value={filter} onChange={setFilter} />

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading schedule…</p>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No scheduled items in this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredEvents.map((event) => (
            <li key={event.id}>
              <ScheduleEventCard
                event={event}
                projectName={projectMap.get(event.projectId) ?? 'Project'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
