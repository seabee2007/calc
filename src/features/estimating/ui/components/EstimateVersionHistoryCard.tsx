import { format } from 'date-fns';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import type { EstimateVersionHistoryItem } from '../estimateVersionDisplay';
import {
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  formatEstimateTypeLabel,
} from '../estimateFormatters';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  item: EstimateVersionHistoryItem;
}

function metricValue(
  value: number | null,
  formatter: (value: number) => string,
): string {
  if (value == null) return '—';
  return formatter(value);
}

export default function EstimateVersionHistoryCard({ item }: Props) {
  const panelClass = item.isCurrent
    ? `${PLANNER_FORM_PANEL} border-2 border-blue-500/70 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20 dark:border-blue-400/60 dark:bg-blue-950/30 dark:ring-blue-400/20`
    : `${PLANNER_FORM_PANEL} border border-slate-200/80 opacity-95 dark:border-slate-700`;

  return (
    <article className={`${panelClass} space-y-3`} aria-current={item.isCurrent ? 'true' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-semibold ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(item.versionName)}
            </h3>
            <span className={`text-sm font-medium tabular-nums ${PLANNER_MUTED}`}>
              v{item.versionNumber}
            </span>
            {item.isCurrent ? (
              <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Current version</span>
            ) : (
              <span className={`${BADGE_BASE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
                Read-only
              </span>
            )}
          </div>
        </div>
        <FieldRecordStatusBadge status={item.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <dt className={PLANNER_MUTED}>Estimate type</dt>
          <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>
            {formatEstimateTypeLabel(item.estimateType)}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Created</dt>
          <dd className={`mt-0.5 font-medium ${TEXT_BODY}`}>
            {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Total sell price</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {metricValue(item.metrics.totalSellPrice, formatEstimateCurrency)}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Labor hours</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {metricValue(item.metrics.laborHours, formatEstimateHours)}
          </dd>
        </div>
        <div>
          <dt className={PLANNER_MUTED}>Line items</dt>
          <dd className={`mt-0.5 font-medium tabular-nums ${TEXT_BODY}`}>
            {metricValue(item.metrics.lineItemCount, (n) => formatEstimateNumber(n, { decimals: 0 }))}
          </dd>
        </div>
      </dl>
    </article>
  );
}
