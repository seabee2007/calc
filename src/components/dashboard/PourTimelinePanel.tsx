import React from 'react';
import { Clock } from 'lucide-react';
import Card from '../ui/Card';
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
}

const PourTimelinePanel: React.FC<PourTimelinePanelProps> = ({
  events,
  projectName,
}) => (
  <Card className="p-5 bg-slate-900/95 border border-slate-700 text-white">
    <div className="flex items-center gap-2 mb-4">
      <Clock className="h-5 w-5 text-cyan-400" />
      <div>
        <h3 className="font-semibold">Pour timeline</h3>
        {projectName && (
          <p className="text-xs text-slate-400">{projectName}</p>
        )}
      </div>
    </div>
    {events.length === 0 ? (
      <p className="text-sm text-slate-400">
        Save a placement order with pour time to build the truck schedule.
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
  </Card>
);

export default PourTimelinePanel;
