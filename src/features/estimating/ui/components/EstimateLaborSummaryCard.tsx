import type { EstimateLaborPlanningMetrics } from '../estimateTotalsDisplay';
import {
  ESTIMATE_BLANK,
  formatEstimateHours,
  formatEstimateNumber,
} from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';
import EstimateSummaryCard from './EstimateSummaryCard';

interface Props {
  metrics: EstimateLaborPlanningMetrics;
  loading?: boolean;
}

export default function EstimateLaborSummaryCard({ metrics, loading = false }: Props) {
  const durationValue =
    metrics.durationDays != null && metrics.durationDays > 0
      ? `${formatEstimateNumber(metrics.durationDays, {
          decimals: Number.isInteger(metrics.durationDays) ? 0 : 1,
        })}d`
      : ESTIMATE_BLANK;

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-4`}>
      <div>
        <h3 className={PLANNER_SECTION_TITLE}>Labor planning</h3>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Rolled up from activity metrics on the current estimate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EstimateSummaryCard
          label="Labor hours"
          value={
            metrics.laborHours > 0 ? formatEstimateHours(metrics.laborHours) : ESTIMATE_BLANK
          }
          loading={loading}
        />
        <EstimateSummaryCard
          label="Man-days"
          value={
            metrics.manDays > 0
              ? `${formatEstimateNumber(metrics.manDays, { decimals: 1 })} MD`
              : ESTIMATE_BLANK
          }
          loading={loading}
        />
        <EstimateSummaryCard
          label="Scheduled crew-days"
          value={
            metrics.scheduledCrewDays > 0
              ? `${formatEstimateNumber(metrics.scheduledCrewDays, { decimals: 1 })} CD`
              : ESTIMATE_BLANK
          }
          loading={loading}
        />
        <EstimateSummaryCard
          label="Project duration"
          value={durationValue}
          loading={loading}
        />
      </div>

      <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
        Labor crew-days convert labor effort by crew size. Scheduled crew-days use duration × crew
        size. Project duration uses the CPM schedule span when available.
      </p>

      {metrics.durationDays == null ? (
        <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
          Project duration appears when schedule-enabled activities have CPM dates.
        </p>
      ) : null}
    </div>
  );
}
