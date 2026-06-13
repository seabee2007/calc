import { useMemo } from 'react';
import {
  applyDependencyPreviewToPlan,
  mapScheduleControlToDependencyPreviewMode,
} from '../../application/estimateScheduleDependencies';
import type { EstimateScheduleDatePlanResult } from '../../application/estimateScheduleDatePlanner';
import type { EstimateSchedulePlan } from '../../domain/estimateScheduleTypes';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import {
  extractScheduleDatePlanSummary,
  extractSchedulePreviewSummary,
  hasSchedulableSchedulePreview,
} from '../estimateScheduleDisplay';
import {
  BADGE_BASE,
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateScheduleGroupCard from './EstimateScheduleGroupCard';
import EstimateSchedulePlanControls, {
  type EstimateSchedulePlanControlValues,
} from './EstimateSchedulePlanControls';
import EstimateSchedulePlanSummary from './EstimateSchedulePlanSummary';
import EstimateDependencyPreviewPanel from './EstimateDependencyPreviewPanel';

export type EstimateSchedulePreviewSource = 'construction_activities' | 'legacy_line_items';

const NO_VERSION_MESSAGE = 'This estimate does not have saved activity details yet.';

const NO_CONSTRUCTION_ACTIVITIES_TITLE = 'No construction activities yet.';
const NO_CONSTRUCTION_ACTIVITIES_BODY =
  'Add activities to build an estimate and preview a schedule.';

const NO_SCHEDULE_ENABLED_TITLE = 'No schedule-enabled activities yet.';
const NO_SCHEDULE_ENABLED_BODY =
  'Enable scheduling on activities you want included in the schedule preview.';

const LEGACY_EMPTY_TITLE = 'No schedulable legacy estimate lines';
const LEGACY_EMPTY_BODY =
  'Enable scheduling on estimate line items or switch back to construction activities.';

const PREVIEW_NOTE =
  'This is a planning preview from saved construction activities. For CPM dates and critical path, use the Logic Network and Level III Gantt.';

interface Props {
  version: EstimateDomainVersion | null;
  plan: EstimateSchedulePlan | null;
  datePlanResult: EstimateScheduleDatePlanResult | null;
  planControls: EstimateSchedulePlanControlValues;
  onPlanControlsChange: (patch: Partial<EstimateSchedulePlanControlValues>) => void;
  loading?: boolean;
  totalConstructionActivityCount: number;
  schedulePreviewSource: EstimateSchedulePreviewSource;
  legacyScheduleAvailable: boolean;
}

const LABOR_SUMMARY_CARDS = [
  { key: 'schedulableTasksDisplay', label: 'Scheduled activities' },
  { key: 'excludedTasksDisplay', label: 'Excluded activities' },
  { key: 'totalLaborHoursDisplay', label: 'Total labor hours' },
  { key: 'totalManDaysDisplay', label: 'Total man-days' },
  {
    key: 'totalCrewDaysDisplay',
    label: 'Labor crew-days',
    helper: 'Man-days ÷ crew size per activity (calendar crew-days from labor).',
  },
  { key: 'totalDurationDaysDisplay', label: 'Activity duration (sum)' },
] as const;

function resolveSourceBadgeLabel(source: EstimateSchedulePreviewSource): string {
  return source === 'legacy_line_items'
    ? 'Source: Legacy estimate line items'
    : 'Source: Construction Activities';
}

export default function EstimateSchedulePreviewPanel({
  version,
  plan,
  datePlanResult,
  planControls,
  onPlanControlsChange,
  loading = false,
  totalConstructionActivityCount,
  schedulePreviewSource,
  legacyScheduleAvailable,
}: Props) {
  const laborSummary = useMemo(() => extractSchedulePreviewSummary(plan), [plan]);
  const datePlanSummary = useMemo(
    () => extractScheduleDatePlanSummary(datePlanResult, plan),
    [datePlanResult, plan],
  );
  const dependencyPreview = useMemo(() => {
    const previewPlan = datePlanResult?.plan ?? plan;
    if (!previewPlan) return null;
    return applyDependencyPreviewToPlan(
      previewPlan,
      mapScheduleControlToDependencyPreviewMode(planControls.dependencyMode),
    );
  }, [datePlanResult, plan, planControls.dependencyMode]);

  if (!loading && !version) {
    return (
      <EstimateWorkspaceEmptyState
        title={NO_VERSION_MESSAGE}
        body="Save the current estimate with activities to preview a draft schedule."
      />
    );
  }

  if (
    !loading &&
    schedulePreviewSource === 'construction_activities' &&
    totalConstructionActivityCount === 0
  ) {
    return (
      <EstimateWorkspaceEmptyState
        title={NO_CONSTRUCTION_ACTIVITIES_TITLE}
        body={NO_CONSTRUCTION_ACTIVITIES_BODY}
      />
    );
  }

  if (!loading && plan && !hasSchedulableSchedulePreview(plan)) {
    if (schedulePreviewSource === 'legacy_line_items') {
      return (
        <EstimateWorkspaceEmptyState title={LEGACY_EMPTY_TITLE} body={LEGACY_EMPTY_BODY} />
      );
    }

    return (
      <EstimateWorkspaceEmptyState
        title={NO_SCHEDULE_ENABLED_TITLE}
        body={NO_SCHEDULE_ENABLED_BODY}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>Draft Schedule Preview</h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Draft planned dates from saved construction activities and planning controls below.
          This is not the CPM schedule until you run CPM from the Logic Network.
        </p>
      </div>

      <div className={`${PLANNER_FORM_PANEL} space-y-2 text-sm ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>{PREVIEW_NOTE}</p>
        <p className={`flex flex-wrap items-center gap-2 ${PLANNER_MUTED}`}>
          <span
            className={`${BADGE_BASE} border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
          >
            {resolveSourceBadgeLabel(schedulePreviewSource)}
          </span>
          <span
            className={`${BADGE_BASE} border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200`}
          >
            Draft preview only
          </span>
        </p>
      </div>

      <EstimateSchedulePlanControls
        values={planControls}
        onChange={onPlanControlsChange}
        disabled={loading}
        legacyScheduleAvailable={
          legacyScheduleAvailable && totalConstructionActivityCount === 0
        }
      />

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Planned schedule summary</h3>
        <EstimateSchedulePlanSummary summary={datePlanSummary} loading={loading} />
      </div>

      <EstimateDependencyPreviewPanel
        dependencies={dependencyPreview?.dependencies ?? []}
        plan={dependencyPreview?.plan ?? datePlanResult?.plan ?? plan}
        loading={loading}
      />

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Labor rollup summary</h3>
        <p className={`text-xs ${PLANNER_MUTED}`}>
          Labor crew-days here use man-days ÷ crew size per activity. Costs &amp; Markup crew-days
          use duration × crew size (headcount-days).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LABOR_SUMMARY_CARDS.map((card) => (
            <div key={card.key} className={card.helper ? 'space-y-1' : undefined}>
              <EstimateSummaryCard
                label={card.label}
                value={laborSummary[card.key]}
                loading={loading}
              />
              {card.helper ? (
                <p className={`text-xs ${PLANNER_MUTED}`}>{card.helper}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className={PLANNER_SECTION_TITLE}>Activities by Division</h3>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
              />
            ))}
          </div>
        ) : (
          datePlanResult?.plan.divisions.map((division) => (
            <EstimateScheduleGroupCard key={division.key} division={division} />
          ))
        )}
      </div>
    </div>
  );
}
