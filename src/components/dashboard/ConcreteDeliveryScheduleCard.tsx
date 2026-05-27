import React, { useState } from 'react';
import { Truck, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import type {
  DeliveryScheduleSnapshot,
  TimelineEvent,
  TimelineStatus,
  UpcomingPlacementRow,
} from '../../utils/operationsDashboard';
import {
  calendarDaysUntil,
  formatNextPlacementLeadLabel,
  formatPourTimeLabel,
  formatProfessionalCalendarDate,
} from '../../utils/operationsDashboard';
import { workflowQuery } from '../../utils/workflow';

const statusStyles: Record<TimelineStatus, string> = {
  on_schedule: 'bg-emerald-500',
  at_risk: 'bg-amber-400',
  delayed: 'bg-red-500',
  pending: 'bg-slate-500',
};

interface ConcreteDeliveryScheduleCardProps {
  schedule: DeliveryScheduleSnapshot | null;
  timeline: TimelineEvent[];
  hasPlacementsToday: boolean;
  nextPlacement?: UpcomingPlacementRow | null;
  primaryProjectId?: string;
}

const ConcreteDeliveryScheduleCard: React.FC<ConcreteDeliveryScheduleCardProps> = ({
  schedule,
  timeline,
  hasPlacementsToday,
  nextPlacement,
  primaryProjectId,
}) => {
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const plannerPath = primaryProjectId
    ? `/pour-planner${workflowQuery(primaryProjectId)}`
    : '/pour-planner';

  const upcomingPlannerPath = nextPlacement
    ? `/pour-planner${workflowQuery(nextPlacement.projectId)}`
    : plannerPath;

  const upcomingPourDate = nextPlacement ? new Date(nextPlacement.sortTime) : null;
  const daysUntil =
    upcomingPourDate != null ? calendarDaysUntil(upcomingPourDate, new Date()) : null;

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-white">Concrete delivery schedule</h3>
      </div>

      {!hasPlacementsToday && !nextPlacement ? (
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
      ) : !hasPlacementsToday && nextPlacement && upcomingPourDate && daysUntil != null ? (
        <div className="py-1">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-2">
            {formatNextPlacementLeadLabel(daysUntil)}
          </p>
          <p className="text-2xl font-bold text-white leading-tight">
            {formatProfessionalCalendarDate(upcomingPourDate)}
          </p>
          <p className="text-sm text-cyan-300 font-mono mt-1">
            {formatPourTimeLabel(upcomingPourDate)}
          </p>

          <dl className="grid grid-cols-1 gap-2 text-sm mt-4 pt-4 border-t border-slate-700/80">
            <div>
              <dt className="text-slate-500 text-xs uppercase">Project</dt>
              <dd className="text-slate-200 font-medium truncate">{nextPlacement.projectName}</dd>
            </div>
            {nextPlacement.volumeYd > 0 && (
              <div>
                <dt className="text-slate-500 text-xs uppercase">Volume</dt>
                <dd className="text-slate-200">{nextPlacement.volumeYd.toFixed(0)} CY</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500 text-xs uppercase">Batch plant</dt>
              <dd className="text-slate-200">{nextPlacement.batchPlantName}</dd>
            </div>
          </dl>

          {nextPlacement.timeline.length > 0 ? (
            <div className="mt-4 border-t border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                className="flex items-center justify-between w-full text-sm text-slate-300 hover:text-white transition-colors"
              >
                <span>Planned truck schedule</span>
                {scheduleOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {scheduleOpen && (
                <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {nextPlacement.timeline.map((ev: TimelineEvent) => (
                    <li key={ev.id} className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusStyles[ev.status]}`}
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
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-4">
              Call sheet pending — build truck spacing in Placement Planner before placement day.
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            className="!border-slate-600 !text-white mt-4 w-full"
            onClick={() => navigate(upcomingPlannerPath)}
          >
            Open Placement Planner
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
            onClick={() => navigate(plannerPath)}
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

          {timeline.length > 0 && (
            <div className="mt-4 border-t border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                className="flex items-center justify-between w-full text-sm text-slate-300 hover:text-white transition-colors"
              >
                <span>Full truck schedule</span>
                {scheduleOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {scheduleOpen && (
                <div className="mt-3">
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {timeline.map((ev: TimelineEvent) => (
                      <li key={ev.id} className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusStyles[ev.status]}`}
                          title={ev.status.replace('_', ' ')}
                        />
                        <span className="font-mono text-sm text-cyan-300 w-20 shrink-0">
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
                </div>
              )}
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="!border-slate-600 !text-white mt-4 w-full"
            onClick={() => navigate(plannerPath)}
          >
            Adjust Schedule
          </Button>
        </>
      )}
    </OpsCard>
  );
};

export default ConcreteDeliveryScheduleCard;
