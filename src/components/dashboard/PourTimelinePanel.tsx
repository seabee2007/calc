import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { TimelineEvent, TimelineStatus } from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

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
  primaryProjectId?: string;
}

const PourTimelinePanel: React.FC<PourTimelinePanelProps> = ({
  events,
  projectName,
  hasPlacementsToday,
  primaryProjectId,
}) => {
  const navigate = useNavigate();
  const showSchedule = hasPlacementsToday && events.length > 0;

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-cyan-400" />
        <div>
          <h3 className="font-semibold text-white">Upcoming placement</h3>
          {showSchedule && projectName && (
            <p className="text-xs text-slate-400">{projectName}</p>
          )}
        </div>
      </div>
      {!hasPlacementsToday ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-3">No placements scheduled</p>
          <Button
            size="sm"
            variant="outline"
            className="!border-slate-600 !text-white"
            onClick={() => navigate(`/projects${workflowQuery()}`)}
            icon={<Calendar className="h-4 w-4" />}
          >
            Schedule Placement
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-3">
            Complete the call sheet in Placement Planner to build truck times.
          </p>
          <Button
            variant="accent"
            size="sm"
            onClick={() =>
              navigate(
                `/pour-planner${primaryProjectId ? workflowQuery(primaryProjectId) : workflowQuery()}`,
              )
            }
          >
            Open Placement Planner
          </Button>
        </div>
      ) : (
        <>
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
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> On schedule
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> At risk
            </span>
          </div>
        </>
      )}
    </OpsCard>
  );
};

export default PourTimelinePanel;
