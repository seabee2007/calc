import { useMemo } from 'react';
import {
  applyDependencyPreviewToPlan,
  mapScheduleControlToDependencyPreviewMode,
} from '../../application/estimateScheduleDependencies';
import type { EstimateScheduleDatePlanResult } from '../../application/estimateScheduleDatePlanner';
import type { EstimateSchedulePlan } from '../../domain/estimateScheduleTypes';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import type { EffectiveScheduleSummary } from '../../scheduling/effectiveSchedule';
import {
  extractScheduleDatePlanSummary,
  extractSchedulePreviewSummary,
  formatSchedulePlannedDate,
  hasSchedulableSchedulePreview,
  type EstimateScheduleDatePlanSummary,
} from '../estimateScheduleDisplay';
import { formatEstimateNumber } from '../estimateFormatters';
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
  'CPM/Gantt uses activity durations and dependencies. Labor metrics here are planning rollups only. For CPM dates and critical path, use the Logic Network and Level III Gantt.';

interface Props {
  version: EstimateDomainVersion | null;
  plan: EstimateSchedulePlan | null;
  datePlanResult: EstimateScheduleDatePlanResult | null;
  /**
   * Canonical CPM/resource-leveled schedule. Present only after CPM has run;
   * when present, the planned summary reflects it instead of the draft planner.
   */
  effectiveSchedule?: EffectiveScheduleSummary | null;
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
    key: 'totalLaborCrewDaysDisplay',
    label: 'Labor crew-days',
    helper: 'Man-days ÷ crew size per activity (effort-based).',
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
  effectiveSchedule = null,
  planControls,
  onPlanControlsChange,
  loading = false,
  totalConstructionActivityCount,
  schedulePreviewSource,
  legacyScheduleAvailable,
}: Props) {
  const laborSummary = useMemo(() => extractSchedulePreviewSummary(plan), [plan]);
  const draftDatePlanSummary = useMemo(
    () => extractScheduleDatePlanSummary(datePlanResult, plan),
    [datePlanResult, plan],
  );
  // Once CPM has run, the canonical (CPM + resource-leveled) schedule is the
  // source of truth for project start/finish/duration so every surface agrees.
  const datePlanSummary = useMemo<EstimateScheduleDatePlanSummary>(() => {
    if (!effectiveSchedule) return draftDatePlanSummary;
    const duration = effectiveSchedule.effectiveDurationDays;
    return {
      ...draftDatePlanSummary,
      plannedProjectStart: effectiveSchedule.plannedProjectStart,
      plannedProjectFinish: effectiveSchedule.plannedProjectFinish,
      totalPlannedDurationDays: duration,
      plannedProjectStartDisplay: formatSchedulePlannedDate(
        effectiveSchedule.plannedProjectStart,
      ),
      plannedProjectFinishDisplay: formatSchedulePlannedDate(
        effectiveSchedule.plannedProjectFinish,
      ),
      totalPlannedDurationDaysDisplay:
        duration > 0 ? `${formatEstimateNumber(duration, { decimals: 0 })} days` : '—',
    };
  }, [draftDatePlanSummary, effectiveSchedule]);
  const dependencyPreview = useMemo(() => {
    const previewPlan = datePlanResult?.plan ?? plan;
    if (!previewPlan) return null;
    return applyDependencyPreviewToPlan(
      previewPlan,
      mapScheduleControlToDependencyPreviewMode(planControls.dependencyMode),
    );
  }, [datePlanResult, plan, planControls.dependencyMode]);
  // Override per-activity planned dates from the canonical schedule so the
  // division cards agree with the headline summary once CPM has run.
  const effectivePlan = useMemo(() => {
    const base = datePlanResult?.plan ?? null;
    if (!base || !effectiveSchedule) return base;
    return {
      ...base,
      divisions: base.divisions.map((division) => ({
        ...division,
        scopes: division.scopes.map((scope) => ({
          ...scope,
          tasks: scope.tasks.map((task) => {
            const resolved = task.activityCode
              ? effectiveSchedule.byActivityCode.get(task.activityCode)
              : undefined;
            if (!resolved) return task;
            return {
              ...task,
              plannedStartDate: resolved.plannedStart,
              plannedEndDate: resolved.plannedFinish,
            };
          }),
        })),
      })),
    };
  }, [datePlanResult, effectiveSchedule]);

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

  const onEffectiveSchedule = Boolean(effectiveSchedule);
  const levelingApplied = effectiveSchedule?.levelingApplied ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>
          {onEffectiveSchedule
            ? levelingApplied
              ? 'Resource-Leveled Schedule'
              : 'CPM Baseline Schedule'
            : 'Draft Schedule Preview'}
        </h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          {onEffectiveSchedule
            ? 'Preview reflects the calculated CPM schedule and any applied resource leveling. CPM logic dependencies are unchanged; resource leveling adjusts planned dates in the schedule layer.'
            : 'Draft planned dates from saved construction activities and planning controls below. This is not the CPM schedule until you run CPM from the Logic Network.'}
        </p>
      </div>

      {onEffectiveSchedule && effectiveSchedule ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
          {levelingApplied ? (
            <p>
              <strong>Resource leveling applied.</strong> CPM baseline:{' '}
              {effectiveSchedule.cpmBaselineDurationDays} days · Leveled schedule:{' '}
              {effectiveSchedule.leveledDurationDays} days.
            </p>
          ) : (
            <p>
              <strong>CPM baseline schedule.</strong> Calculated project duration:{' '}
              {effectiveSchedule.cpmBaselineDurationDays} days.
            </p>
          )}
        </div>
      ) : null}

      <div className={`${PLANNER_FORM_PANEL} space-y-2 text-sm ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>{PREVIEW_NOTE}</p>
        <p className={`flex flex-wrap items-center gap-2 ${PLANNER_MUTED}`}>
          <span
            className={`${BADGE_BASE} border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
          >
            {resolveSourceBadgeLabel(schedulePreviewSource)}
          </span>
          <span
            className={`${BADGE_BASE} ${
              onEffectiveSchedule
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
            }`}
          >
            {onEffectiveSchedule
              ? levelingApplied
                ? 'Resource-leveled schedule'
                : 'CPM baseline'
              : 'Draft preview only'}
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
          Labor crew-days convert labor effort by crew size. Scheduled crew-days (Costs &amp;
          Markup) use duration × crew size.
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
          (effectivePlan ?? datePlanResult?.plan)?.divisions.map((division) => (
            <EstimateScheduleGroupCard key={division.key} division={division} />
          ))
        )}
      </div>
    </div>
  );
}
