import React from 'react';
import { Clock } from 'lucide-react';
import OpsCard from './OpsCard';
import type { TimelineEvent, TimelineStatus } from '../../utils/operationsDashboard';

const statusStyles: Record<TimelineStatus, string> = {
  on_schedule: 'bg-emerald-500',
  at_risk: 'bg-amber-400',
  delayed: 'bg-red-500',
  pending: 'bg-slate-500',
};

interface PourTimelinePanelProps {
  events: TimelineEvent[];
  projectName?: string;
  hasPlacementsToday: boolean;
}

const NO_PLACEMENTS_MSG =
  'No placements scheduled for today. Set today\'s pour date on a project and save an order in Placement Planner to see the schedule.';

const PourTimelinePanel: React.FC<PourTimelinePanelProps> = ({
  events,
  projectName,
  hasPlacementsToday,
}) => {
  const showSchedule = hasPlacementsToday && events.length > 0;

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-cyan-400" />
        <div>
          <h3 className="font-semibold text-white">Placement timeline</h3>
          {showSchedule && projectName && (
            <p className="text-xs text-slate-400">{projectName}</p>
          )}
        </div>
      </div>
      {!hasPlacementsToday ? (
        <p className="text-sm text-slate-400">{NO_PLACEMENTS_MSG}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-400">
          Today&apos;s placement has no saved call sheet yet — complete Step 6 in Placement
          Planner to build truck times.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full shrink-0 ${statusStyles[ev.status]}`}
                title={ev.status.replace('_', ' ')}
              />
              <span className="font-mono text-sm text-cyan-300 w-20 shrink-0">
                {ev.timeLabel}
              </span>
              <span className="text-sm text-slate-200">{ev.label}</span>
            </li>
          ))}
        </ul>
      )}
      {showSchedule && (
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> On schedule
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> At risk
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-500" /> Pending
          </span>
        </div>
      )}
    </OpsCard>
  );
};

export default PourTimelinePanel;
