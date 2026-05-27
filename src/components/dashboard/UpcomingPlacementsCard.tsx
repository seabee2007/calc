import React from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { UpcomingPlacementRow } from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

interface UpcomingPlacementsCardProps {
  placements: UpcomingPlacementRow[];
}

const UpcomingPlacementsCard: React.FC<UpcomingPlacementsCardProps> = ({
  placements,
}) => {
  const navigate = useNavigate();

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-white">Upcoming placements</h3>
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
        <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {placements.slice(0, 8).map((row) => (
            <li
              key={row.projectId}
              className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
            >
              <p className="font-semibold text-white truncate">{row.projectName}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                <div>
                  <dt className="text-slate-500">Pour date</dt>
                  <dd className="text-slate-200">{row.pourDateLabel}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Volume</dt>
                  <dd className="text-cyan-300">
                    {row.volumeYd > 0 ? `${row.volumeYd.toFixed(0)} CY` : 'TBD'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Batch plant</dt>
                  <dd className="text-slate-200 truncate">{row.batchPlantName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next load</dt>
                  <dd className="font-mono text-cyan-300">{row.nextLoadLabel}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() =>
                  navigate(`/pour-planner${workflowQuery(row.projectId)}`)
                }
                className="mt-2 text-xs text-cyan-400 hover:underline"
              >
                Open planner →
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsCard>
  );
};

export default UpcomingPlacementsCard;
