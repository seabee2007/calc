import React from 'react';
import type { ScheduleDashboardSnapshot } from '../../../utils/scheduleDashboard';
import ScheduleTodayCard from './ScheduleTodayCard';
import ScheduleDeadlinesCard from './ScheduleDeadlinesCard';
import { OPS_HERO_CARD, OPS_MUTED } from '../opsTheme';

interface Props {
  snapshot: ScheduleDashboardSnapshot | null;
  /** Stack the two inner panels vertically (half-width or mobile cards). */
  stackPanels?: boolean;
}

/**
 * Schedule widget — title and panels share one bordered container so nothing
 * floats outside the draggable card boundary in customize mode.
 */
export default function ScheduleOperationsSection({ snapshot, stackPanels = false }: Props) {
  const todayEvents = snapshot?.todayEvents ?? [];
  const upcomingDeadlines = snapshot?.upcomingDeadlines ?? [];

  return (
    <section className={`rounded-xl px-4 py-4 sm:px-5 ${OPS_HERO_CARD}`}>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Schedule &amp; Deadlines
        </p>
        <p className={`mt-1 text-sm ${OPS_MUTED}`}>
          Today on the calendar, upcoming deadlines, inspections, deliveries, and milestones.
        </p>
      </div>
      <div
        className={`grid grid-cols-1 gap-3 ${stackPanels ? '' : 'sm:grid-cols-2'}`}
        data-testid="schedule-operations-panels"
      >
        <ScheduleTodayCard events={todayEvents} />
        <ScheduleDeadlinesCard deadlines={upcomingDeadlines} />
      </div>
    </section>
  );
}
