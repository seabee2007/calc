import React, { useState } from 'react';
import { Truck, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import {
  OPS_BODY,
  OPS_HOVER_ROW,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_SUBTLE,
  OPS_TITLE,
} from './opsTheme';
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
  /** Shown when the operational queue is empty (e.g. all projects closed). */
  emptyMessage?: string;
}

const ConcreteDeliveryScheduleCard: React.FC<ConcreteDeliveryScheduleCardProps> = ({
  schedule,
  timeline,
  hasPlacementsToday,
  nextPlacement,
  primaryProjectId,
  emptyMessage,
}) => {
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const plannerPath = primaryProjectId
    ? `/pour-planner${workflowQuery(primaryProjectId)}`
    : `/pour-planner${workflowQuery()}`;

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
        <h3 className={`font-semibold ${OPS_TITLE}`}>Concrete delivery schedule</h3>
      </div>

      {!hasPlacementsToday && !nextPlacement ? (
        <div className="text-center py-4">
          <p className={`text-sm mb-3 ${OPS_MUTED}`}>
            {emptyMessage ?? 'No placements scheduled'}
          </p>
          {!emptyMessage && (
            <Button
              size="sm"
              variant="outline"
              className={OPS_OUTLINE_BTN}
              onClick={() => navigate(`/projects${workflowQuery()}`)}
              icon={<Calendar className="h-4 w-4" />}
            >
              Schedule Placement
            </Button>
          )}
        </div>
      ) : !hasPlacementsToday && nextPlacement && upcomingPourDate && daysUntil != null ? (
        <div className="py-1">
          <p className={`text-xs uppercase tracking-[0.15em] mb-2 ${OPS_SUBTLE}`}>
            {formatNextPlacementLeadLabel(daysUntil)}
          </p>
          <p className={`text-2xl font-bold leading-tight ${OPS_TITLE}`}>
            {formatProfessionalCalendarDate(upcomingPourDate)}
          </p>
          <p className="text-sm text-cyan-700 dark:text-cyan-300 font-mono mt-1">
            {formatPourTimeLabel(upcomingPourDate)}
          </p>

          <dl className="grid grid-cols-1 gap-2 text-sm mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/80">
            <div>
              <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>Project</dt>
              <dd className={`font-medium truncate ${OPS_BODY}`}>{nextPlacement.projectName}</dd>
            </div>
            {nextPlacement.volumeYd > 0 && (
              <div>
                <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>Volume</dt>
                <dd className={OPS_BODY}>{nextPlacement.volumeYd.toFixed(0)} CY</dd>
              </div>
            )}
            <div>
              <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>Batch plant</dt>
              <dd className={OPS_BODY}>{nextPlacement.batchPlantName}</dd>
            </div>
          </dl>

          {nextPlacement.timeline.length > 0 ? (
            <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                className={`flex items-center justify-between w-full ${OPS_HOVER_ROW}`}
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
                      <span className="font-mono text-sm text-cyan-700 dark:text-cyan-300 w-20 shrink-0">
                        {ev.timeLabel}
                      </span>
                      <span className={`text-sm ${OPS_BODY}`}>{ev.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className={`text-xs mt-4 ${OPS_SUBTLE}`}>
              Call sheet pending — build truck spacing in Placement Planner before placement day.
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
            onClick={() => navigate(upcomingPlannerPath)}
          >
            Open Placement Planner
          </Button>
        </div>
      ) : !schedule ? (
        <div className="text-center py-4">
          <p className={`text-sm mb-3 ${OPS_MUTED}`}>
            Save call sheet in Placement Planner to build truck spacing and ETAs.
          </p>
          <Button
            variant="accent"
            size="sm"
            onClick={() => navigate(plannerPath)}
          >
            Open Placement Planner
          </Button>
        </div>
      ) : (
        <>
          <p className={`text-xs mb-1 ${OPS_SUBTLE}`}>{schedule.projectName}</p>
          <p className={`text-2xl font-bold mb-1 ${OPS_TITLE}`}>
            Truck {schedule.truckIndex} of {schedule.truckTotal}
          </p>

          <dl className="grid grid-cols-2 gap-3 text-sm mt-3">
            <div>
              <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>ETA</dt>
              <dd className="font-mono text-cyan-700 dark:text-cyan-300 text-lg">
                {schedule.etaLabel}
              </dd>
            </div>
            <div>
              <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>Spacing</dt>
              <dd className={OPS_BODY}>{schedule.spacingMin} min</dd>
            </div>
            <div className="col-span-2">
              <dt className={`text-xs uppercase ${OPS_SUBTLE}`}>Plant</dt>
              <dd className={OPS_BODY}>{schedule.plantName}</dd>
            </div>
          </dl>

          {timeline.length > 0 && (
            <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                className={`flex items-center justify-between w-full ${OPS_HOVER_ROW}`}
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
                        <span className="font-mono text-sm text-cyan-700 dark:text-cyan-300 w-20 shrink-0">
                          {ev.timeLabel}
                        </span>
                        <span className={`text-sm ${OPS_BODY}`}>{ev.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={`flex flex-wrap gap-3 mt-3 text-xs ${OPS_SUBTLE}`}>
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
            className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
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
