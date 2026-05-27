import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { TimelineEvent, TimelineStatus, UpcomingPlacementRow } from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

interface UpcomingPlacementsCardProps {
  placements: UpcomingPlacementRow[];
}

const statusStyles: Record<TimelineStatus, string> = {
  on_schedule: 'bg-emerald-500',
  at_risk: 'bg-amber-400',
  delayed: 'bg-red-500',
  pending: 'bg-slate-500',
};

const UpcomingPlacementsCard: React.FC<UpcomingPlacementsCardProps> = ({
  placements,
}) => {
  const navigate = useNavigate();
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const visible = placements.slice(0, 8);
  const selected = useMemo(() => {
    if (openProjectId) return visible.find((p) => p.projectId === openProjectId) ?? visible[0];
    return visible[0];
  }, [openProjectId, visible]);

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-white">Upcoming placement</h3>
      </div>

      {placements.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-3">No placements scheduled</p>
          <Button
            size="sm"
            variant="outline"
            className="!border-slate-600 !text-white"
            onClick={() => navigate(`/projects${workflowQuery()}`)}
          >
            Schedule Placement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() =>
              setOpenProjectId((prev) => (prev ? null : visible[0]?.projectId ?? null))
            }
            className="w-full text-left rounded-lg border border-slate-700 bg-slate-800/60 p-3 hover:border-cyan-600/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{selected?.projectName}</p>
                <p className="text-xs text-slate-400 mt-1">{selected?.pourDateLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
          </button>

          {openProjectId === null && visible.length > 1 && (
            <div className="space-y-2">
              {visible.slice(1).map((row) => (
                <button
                  key={row.projectId}
                  type="button"
                  onClick={() => setOpenProjectId(row.projectId)}
                  className="w-full text-left rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 hover:border-cyan-600/50 transition-colors"
                >
                  <p className="text-sm text-slate-200 truncate">{row.projectName}</p>
                  <p className="text-xs text-slate-500">{row.pourDateLabel}</p>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-cyan-400" />
                <p className="text-sm font-semibold text-white">Schedule</p>
              </div>

              {selected.timeline.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Save the call sheet in Placement Planner to generate truck spacing and times.
                </p>
              ) : (
                <>
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {selected.timeline.map((ev: TimelineEvent) => (
                      <li key={ev.id} className="flex items-center gap-3">
                        <span
                          className={`h-3 w-3 rounded-full shrink-0 ${statusStyles[ev.status]}`}
                          title={ev.status.replace('_', ' ')}
                        />
                        <span className="font-mono text-sm text-cyan-300 w-24 shrink-0">
                          {ev.timeLabel}
                        </span>
                        <span className="text-sm text-slate-200">{ev.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> On schedule
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> At risk
                    </span>
                  </div>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                className="!border-slate-600 !text-white mt-4 w-full sm:w-auto"
                onClick={() => navigate(`/pour-planner${workflowQuery(selected.projectId)}`)}
              >
                Open Placement Planner
              </Button>
            </div>
          )}
        </div>
      )}
    </OpsCard>
  );
};

export default UpcomingPlacementsCard;
