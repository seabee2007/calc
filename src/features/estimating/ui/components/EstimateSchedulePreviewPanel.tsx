import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import type { EstimateSchedulePlan } from '../../domain/estimateScheduleTypes';
import type { EstimateScheduleDatePlanResult } from '../../application/estimateScheduleDatePlanner';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import {
  extractScheduleDatePlanSummary,
  extractSchedulePreviewSummary,
  hasSchedulableSchedulePreview,
} from '../estimateScheduleDisplay';
import {
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

const NO_VERSION_MESSAGE = 'This estimate does not have a saved version yet.';

const NO_SCHEDULABLE_MESSAGE =
  'No schedulable estimate line items yet. Enable scheduling on line items to build a schedule preview.';

const PREVIEW_NOTE =
  'This is a schedule preview only. It has not been published to the Planner schedule.';

interface Props {
  version: EstimateDomainVersion | null;
  plan: EstimateSchedulePlan | null;
  datePlanResult: EstimateScheduleDatePlanResult | null;
  planControls: EstimateSchedulePlanControlValues;
  onPlanControlsChange: (patch: Partial<EstimateSchedulePlanControlValues>) => void;
  loading?: boolean;
}

const LABOR_SUMMARY_CARDS = [
  { key: 'schedulableTasksDisplay', label: 'Schedulable tasks' },
  { key: 'excludedTasksDisplay', label: 'Excluded tasks' },
  { key: 'totalLaborHoursDisplay', label: 'Total labor hours' },
  { key: 'totalManDaysDisplay', label: 'Total man-days' },
  { key: 'totalCrewDaysDisplay', label: 'Total crew-days' },
  { key: 'totalDurationDaysDisplay', label: 'Estimated duration total' },
] as const;

export default function EstimateSchedulePreviewPanel({
  version,
  plan,
  datePlanResult,
  planControls,
  onPlanControlsChange,
  loading = false,
}: Props) {
  const laborSummary = useMemo(() => extractSchedulePreviewSummary(plan), [plan]);
  const datePlanSummary = useMemo(
    () => extractScheduleDatePlanSummary(datePlanResult, plan),
    [datePlanResult, plan],
  );

  if (!loading && !version) {
    return (
      <EstimateWorkspaceEmptyState
        title={NO_VERSION_MESSAGE}
        body="Save an estimate version with line items to preview a draft schedule."
      />
    );
  }

  if (!loading && plan && !hasSchedulableSchedulePreview(plan)) {
    return (
      <EstimateWorkspaceEmptyState
        title="No schedulable tasks"
        body={NO_SCHEDULABLE_MESSAGE}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={PLANNER_SECTION_TITLE}>Schedule preview</h2>
          <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
            Draft schedule candidates from the current saved version
            {version ? ` (v${version.versionNumber})` : ''}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<Calendar className="h-4 w-4" />}
          disabled
          title="Coming in a future phase"
        >
          Publish to Planner coming soon
        </Button>
      </div>

      <div className={`${PLANNER_FORM_PANEL} text-sm ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>{PREVIEW_NOTE}</p>
      </div>

      <EstimateSchedulePlanControls
        values={planControls}
        onChange={onPlanControlsChange}
        disabled={loading}
      />

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Planned schedule summary</h3>
        <EstimateSchedulePlanSummary summary={datePlanSummary} loading={loading} />
      </div>

      <div className="space-y-2">
        <h3 className={PLANNER_SECTION_TITLE}>Labor rollup summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LABOR_SUMMARY_CARDS.map((card) => (
            <EstimateSummaryCard
              key={card.key}
              label={card.label}
              value={laborSummary[card.key]}
              loading={loading}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className={PLANNER_SECTION_TITLE}>Grouped schedule candidates</h3>
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
