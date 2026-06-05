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
    metrics.durationDays != null
      ? `${formatEstimateNumber(metrics.durationDays, { decimals: 1 })} days`
      : ESTIMATE_BLANK;

  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-4`}>
      <div>
        <h3 className={PLANNER_SECTION_TITLE}>Labor planning</h3>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Rolled up from line item metrics on the current saved version.
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
              ? formatEstimateNumber(metrics.manDays, { decimals: 2 })
              : ESTIMATE_BLANK
          }
          loading={loading}
        />
        <EstimateSummaryCard
          label="Crew-days"
          value={
            metrics.crewDays > 0
              ? formatEstimateNumber(metrics.crewDays, { decimals: 2 })
              : ESTIMATE_BLANK
          }
          loading={loading}
        />
        <EstimateSummaryCard
          label="Estimated duration"
          value={durationValue}
          loading={loading}
        />
      </div>

      {metrics.durationDays == null ? (
        <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
          Duration days appear when line items include schedule duration metrics.
        </p>
      ) : null}
    </div>
  );
}
