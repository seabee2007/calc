import React from 'react';
import { Truck, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type { DeliveryScheduleSnapshot } from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

interface ConcreteDeliveryScheduleCardProps {
  schedule: DeliveryScheduleSnapshot | null;
  hasPlacementsToday: boolean;
  primaryProjectId?: string;
}

const ConcreteDeliveryScheduleCard: React.FC<ConcreteDeliveryScheduleCardProps> = ({
  schedule,
  hasPlacementsToday,
  primaryProjectId,
}) => {
  const navigate = useNavigate();

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-white">Concrete delivery schedule</h3>
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
      ) : !schedule ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-3">
            Save call sheet in Placement Planner to build truck spacing and ETAs.
          </p>
          <Button
            size="sm"
            className="!bg-cyan-600 hover:!bg-cyan-500 !text-white"
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
          <p className="text-xs text-slate-500 mb-1">{schedule.projectName}</p>
          <p className="text-2xl font-bold text-white mb-1">
            Truck {schedule.truckIndex} of {schedule.truckTotal}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-3">
            <div>
              <dt className="text-slate-500 text-xs uppercase">ETA</dt>
              <dd className="font-mono text-cyan-300 text-lg">{schedule.etaLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase">Spacing</dt>
              <dd className="text-slate-200">{schedule.spacingMin} min</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500 text-xs uppercase">Plant</dt>
              <dd className="text-slate-200">{schedule.plantName}</dd>
            </div>
          </dl>
          <Button
            size="sm"
            variant="outline"
            className="!border-slate-600 !text-white mt-4 w-full"
            onClick={() =>
              navigate(
                `/pour-planner${primaryProjectId ? workflowQuery(primaryProjectId) : workflowQuery()}`,
              )
            }
          >
            Adjust Schedule
          </Button>
        </>
      )}
    </OpsCard>
  );
};

export default ConcreteDeliveryScheduleCard;
