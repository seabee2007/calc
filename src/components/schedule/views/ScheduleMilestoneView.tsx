import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import ScheduleStatusBadge from '../ScheduleStatusBadge';
import ScheduleEmptyState from '../ScheduleEmptyState';
import { SCHEDULE_CARD, SCHEDULE_HEADING, SCHEDULE_MUTED } from '../scheduleTheme';
import {
  formatScheduleDate,
  resolveMilestoneForProject,
} from '../../../utils/scheduleEventUtils';
import type { ScheduleEventStatus } from '../../../types/scheduleEvent';

interface ProjectRow {
  id: string;
  name: string;
}

interface Props {
  events: ScheduleEvent[];
  projects: ProjectRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function milestoneStatusBadge(
  status: ScheduleEventStatus | 'not_scheduled',
): React.ReactNode {
  if (status === 'not_scheduled') {
    return (
      <span className="text-xs text-[#6B7280] dark:text-slate-500">Not scheduled</span>
    );
  }
  return <ScheduleStatusBadge status={status} compact />;
}

export default function ScheduleMilestoneView({
  events,
  projects,
  selectedId,
  onSelect,
}: Props) {
  const rows = useMemo(() => {
    const list = projects.length > 0 ? projects : [];
    if (list.length === 0) {
      const ids = [...new Set(events.map((e) => e.projectId))];
      return ids.map((id) => ({
        id,
        name: events.find((e) => e.projectId === id)?.projectName ?? 'Project',
      }));
    }
    return list;
  }, [projects, events]);

  if (rows.length === 0) {
    return (
      <ScheduleEmptyState
        title="No projects to show"
        message="Select a project filter or add events to see milestone progress."
      />
    );
  }

  return (
    <div className="space-y-6">
      {rows.map((project) => {
        const slots = resolveMilestoneForProject(events, project.id);
        return (
          <section key={project.id} className={SCHEDULE_CARD}>
            <h3
              className={`border-b border-[#E5E7EB] px-4 py-3 text-sm font-semibold ${SCHEDULE_HEADING} dark:border-slate-700`}
            >
              {project.name}
            </h3>
            <div className="relative px-6 py-6">
              <div
                className="absolute bottom-8 left-[27px] top-8 w-0.5 bg-[#E5E7EB] dark:bg-slate-600"
                aria-hidden
              />
              <ol className="relative space-y-6">
                {slots.map((slot) => {
                  const scheduled = slot.status !== 'not_scheduled';
                  return (
                    <li key={slot.key} className="flex gap-4">
                      <div
                        className={`relative z-10 mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                          scheduled
                            ? 'border-[#2563EB] bg-[#2563EB]'
                            : 'border-[#D1D5DB] bg-white dark:border-slate-600 dark:bg-slate-900'
                        }`}
                      />
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium ${
                              scheduled ? SCHEDULE_HEADING : SCHEDULE_MUTED
                            }`}
                          >
                            {slot.label}
                          </p>
                          <div className="shrink-0">{milestoneStatusBadge(slot.status)}</div>
                        </div>
                        {slot.event ? (
                          <button
                            type="button"
                            onClick={() => onSelect(slot.event!.id)}
                            className={`mt-1 text-left text-sm text-[#2563EB] hover:underline ${
                              selectedId === slot.event.id ? 'font-semibold' : ''
                            }`}
                          >
                            {slot.event.title} · {formatScheduleDate(slot.event.startDate)}
                          </button>
                        ) : (
                          <p className={`mt-1 text-xs ${SCHEDULE_MUTED}`}>Not scheduled</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        );
      })}
    </div>
  );
}
