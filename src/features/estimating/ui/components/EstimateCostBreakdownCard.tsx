import type { EstimateCostGroupReview, EstimatePercentBreakdown } from '../estimateTotalsDisplay';
import {
  formatEstimateCurrency,
  formatEstimatePercent,
} from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  costGroups: EstimateCostGroupReview;
  percentBreakdown: EstimatePercentBreakdown;
}

const COST_ROWS: { key: keyof EstimateCostGroupReview; label: string }[] = [
  { key: 'labor', label: 'Labor' },
  { key: 'materials', label: 'Materials' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'subcontractors', label: 'Subcontractors' },
  { key: 'indirectCosts', label: 'Indirect costs' },
  { key: 'directCost', label: 'Direct cost' },
  { key: 'overhead', label: 'Overhead' },
  { key: 'profit', label: 'Profit' },
  { key: 'contingency', label: 'Contingency' },
  { key: 'tax', label: 'Tax' },
];

const PERCENT_ROWS: {
  key: keyof EstimatePercentBreakdown;
  label: string;
}[] = [
  { key: 'laborPercent', label: 'Labor % of final price' },
  { key: 'materialsPercent', label: 'Materials % of final price' },
  { key: 'equipmentPercent', label: 'Equipment % of final price' },
  { key: 'subcontractorPercent', label: 'Subcontractor % of final price' },
  { key: 'profitPercent', label: 'Profit % of final price' },
];

export default function EstimateCostBreakdownCard({ costGroups, percentBreakdown }: Props) {
  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-5`}>
      <div>
        <h3 className={PLANNER_SECTION_TITLE}>Cost breakdown</h3>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Direct costs roll up from activities; markup fields come from the current estimate totals.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {COST_ROWS.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700"
          >
            <dt className={PLANNER_MUTED}>{label}</dt>
            <dd className={`font-medium tabular-nums ${TEXT_BODY}`}>
              {formatEstimateCurrency(costGroups[key])}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-blue-500/50 bg-blue-50/40 px-3 py-2 dark:border-blue-400/50 dark:bg-blue-950/20 sm:col-span-2">
          <dt className={`font-semibold ${TEXT_FOREGROUND}`}>Final sell price</dt>
          <dd className={`text-base font-semibold tabular-nums ${TEXT_FOREGROUND}`}>
            {formatEstimateCurrency(costGroups.finalSellPrice)}
          </dd>
        </div>
      </dl>

      <div>
        <h4 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Share of final price</h4>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {PERCENT_ROWS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <dt className={PLANNER_MUTED}>{label}</dt>
              <dd className={`font-medium tabular-nums ${TEXT_BODY}`}>
                {formatEstimatePercent(percentBreakdown[key])}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
