import React from 'react';
import type { ScheduleDashboardSnapshot } from '../../../utils/scheduleDashboard';
import ScheduleTodayCard from './ScheduleTodayCard';
import ScheduleDeadlinesCard from './ScheduleDeadlinesCard';
import OpsCard from '../OpsCard';
import { OPS_BODY, OPS_MUTED, OPS_TITLE } from '../opsTheme';

interface Props {
  snapshot: ScheduleDashboardSnapshot;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScheduleTodayCard events={snapshot.todayEvents} />
        <ScheduleDeadlinesCard deadlines={snapshot.upcomingDeadlines} />
        <OpsCard>
          <p className={OPS_TITLE}>Active crews today</p>
          <p className={`mt-1 text-2xl font-semibold ${OPS_BODY}`}>
            {snapshot.activeCrews.length}
          </p>
          {snapshot.activeCrews.length > 0 ? (
            <p className={`mt-2 text-sm ${OPS_MUTED}`}>{snapshot.activeCrews.join(', ')}</p>
          ) : (
            <p className={`mt-2 text-sm ${OPS_MUTED}`}>No crew work days today.</p>
          )}
        </OpsCard>
        <OpsCard>
          <p className={OPS_TITLE}>Weather & delays</p>
          <p className={`mt-1 text-2xl font-semibold ${OPS_BODY}`}>
            {snapshot.weatherDelayCount}
          </p>
          <p className={`mt-2 text-sm ${OPS_MUTED}`}>
            {snapshot.upcomingDeliveries.length} deliveries ·{' '}
            {snapshot.upcomingInspections.length} inspections ·{' '}
            {snapshot.upcomingMilestones.length} milestones
          </p>
        </OpsCard>
      </div>
    </section>
  );
}
