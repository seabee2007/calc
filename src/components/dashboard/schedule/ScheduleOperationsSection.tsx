import React from 'react';
import type { ScheduleDashboardSnapshot } from '../../../utils/scheduleDashboard';
import ScheduleTodayCard from './ScheduleTodayCard';
import ScheduleDeadlinesCard from './ScheduleDeadlinesCard';
import { OPS_MUTED } from '../opsTheme';

interface Props {
  snapshot: ScheduleDashboardSnapshot | null;
}

export default function ScheduleOperationsSection({ snapshot }: Props) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Operations schedule
        </p>
        <p className={`mt-1 text-sm ${OPS_MUTED}`}>
          Cross-project calendar: crews, deliveries, inspections, and milestones.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {snapshot && (
          <>
            <ScheduleTodayCard events={snapshot.todayEvents} />
            <ScheduleDeadlinesCard deadlines={snapshot.upcomingDeadlines} />
          </>
        )}
      </div>
    </section>
  );
}
