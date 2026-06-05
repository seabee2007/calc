import { useMemo } from 'react';
import type { EstimateDomainVersion } from '../../infrastructure/estimateDbTypes';
import { buildEstimateTotalsReview } from '../estimateTotalsDisplay';
import { formatEstimateCurrency } from '../estimateFormatters';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE } from '../estimateWorkspaceTheme';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateCostBreakdownCard from './EstimateCostBreakdownCard';
import EstimateLaborSummaryCard from './EstimateLaborSummaryCard';

const EMPTY_TOTALS_MESSAGE =
  'No estimate totals yet. Add activities and save a version to build the totals summary.';

interface Props {
  version: EstimateDomainVersion | null;
  loading?: boolean;
}

export default function EstimateTotalsReviewPanel({ version, loading = false }: Props) {
  const review = useMemo(() => buildEstimateTotalsReview(version), [version]);

  if (!loading && !review.hasTotals) {
    return (
      <EstimateWorkspaceEmptyState
        title="No estimate totals yet"
        body={EMPTY_TOTALS_MESSAGE}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>Financial summary</h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Totals reflect the current saved estimate version.
          {version ? ` Version ${version.versionNumber}.` : ''}
        </p>
      </div>

      <EstimateSummaryCard
        label="Final sell price"
        value={formatEstimateCurrency(review.costGroups.finalSellPrice)}
        loading={loading}
        emphasis
      />

      <EstimateCostBreakdownCard
        costGroups={review.costGroups}
        percentBreakdown={review.percentBreakdown}
      />

      <EstimateLaborSummaryCard metrics={review.laborMetrics} loading={loading} />
    </div>
  );
}
