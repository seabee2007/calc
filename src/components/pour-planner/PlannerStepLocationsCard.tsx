import React from 'react';
import { Factory, MapPin } from 'lucide-react';
import Card from '../ui/Card';
import type { PourPlannerFormState } from '../../types/pourPlanner';
import {
  batchPlantDisplayLine,
  hasVerifiedJobsiteCoords,
  jobsiteDisplayAddress,
} from '../../utils/addressForm';

export interface PlannerStepLocationsCardProps {
  form: PourPlannerFormState;
  className?: string;
  /** Optional note under jobsite (e.g. weather uses verified coordinates). */
  jobsiteNote?: React.ReactNode;
  /** Optional note under batch plant. */
  batchPlantNote?: React.ReactNode;
}

const PlannerStepLocationsCard: React.FC<PlannerStepLocationsCardProps> = ({
  form,
  className = '',
  jobsiteNote,
  batchPlantNote,
}) => {
  const jobsiteLine = jobsiteDisplayAddress(form);
  const plantLine = batchPlantDisplayLine(form);
  const plantName = form.batchPlantName.trim();
  const jobsiteVerified = hasVerifiedJobsiteCoords(form);

  return (
    <Card
      className={`p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-4 text-sm ${className}`}
    >
      <div className="flex items-start gap-2">
        <Factory className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-gray-500 dark:text-gray-400">Batch plant (Step 1)</p>
          {plantName ? (
            <p className="text-gray-900 dark:text-white font-medium mt-0.5">{plantName}</p>
          ) : null}
          <p
            className={`text-gray-900 dark:text-white ${plantName ? 'mt-0.5' : 'mt-0.5 font-medium'}`}
          >
            {plantLine || 'Set batch plant in Step 1 — Project overview'}
          </p>
          {batchPlantNote}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-gray-500 dark:text-gray-400">Jobsite (Step 1)</p>
          <p className="text-gray-900 dark:text-white font-medium mt-0.5">
            {jobsiteLine || 'Set jobsite address in Step 1 — Project overview'}
          </p>
          {jobsiteVerified && !jobsiteNote && (
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Verified location from Step 1
            </p>
          )}
          {jobsiteNote}
        </div>
      </div>
    </Card>
  );
};

export default PlannerStepLocationsCard;
