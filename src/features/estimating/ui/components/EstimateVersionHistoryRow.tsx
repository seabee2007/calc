import { format } from 'date-fns';
import FieldRecordStatusBadge from '../../../../components/field/FieldRecordStatusBadge';
import {
  formatEstimateVersionLabel,
  type EstimateVersionHistoryItem,
} from '../estimateVersionDisplay';
import {
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  formatEstimateTypeLabel,
} from '../estimateFormatters';
import {
  BADGE_BASE,
  BADGE_INFO,
  PLANNER_MUTED,
  PLANNER_TABLE_ROW,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  item: EstimateVersionHistoryItem;
  layout: 'table' | 'mobile';
}

function metricValue(
  value: number | null,
  formatter: (value: number) => string,
): string {
  if (value == null) return '—';
  return formatter(value);
}

function VersionAccessBadge({ isCurrent }: { isCurrent: boolean }) {
  if (isCurrent) {
    return <span className={`${BADGE_BASE} ${BADGE_INFO}`}>Current version</span>;
  }
  return (
    <span
      className={`${BADGE_BASE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}
    >
      Read-only
    </span>
  );
}

function VersionTitle({ item }: { item: EstimateVersionHistoryItem }) {
  return (
    <span className={`font-medium ${TEXT_FOREGROUND}`}>
      {formatEstimateVersionLabel(item.versionName, item.versionNumber)}
    </span>
  );
}

function rowHighlightClass(isCurrent: boolean): string {
  return isCurrent
    ? 'bg-blue-50/60 dark:bg-blue-950/25'
    : '';
}

export default function EstimateVersionHistoryRow({ item, layout }: Props) {
  const sellPrice = metricValue(item.metrics.totalSellPrice, formatEstimateCurrency);
  const laborHours = metricValue(item.metrics.laborHours, formatEstimateHours);
  const lineItems = metricValue(item.metrics.lineItemCount, (n) =>
    formatEstimateNumber(n, { decimals: 0 }),
  );
  const createdAt = format(new Date(item.createdAt), 'MMM d, yyyy');
  const estimateType = formatEstimateTypeLabel(item.estimateType);

  if (layout === 'table') {
    return (
      <tr
        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${PLANNER_TABLE_ROW} ${rowHighlightClass(item.isCurrent)}`}
        aria-current={item.isCurrent ? 'true' : undefined}
      >
        <td className="px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <VersionTitle item={item} />
            <VersionAccessBadge isCurrent={item.isCurrent} />
          </div>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <FieldRecordStatusBadge status={item.status} />
        </td>
        <td className={`px-3 py-2 text-sm ${TEXT_BODY} whitespace-nowrap`}>{estimateType}</td>
        <td className={`px-3 py-2 text-sm tabular-nums ${TEXT_BODY} whitespace-nowrap`}>
          {createdAt}
        </td>
        <td className={`px-3 py-2 text-sm font-medium tabular-nums ${TEXT_BODY} whitespace-nowrap`}>
          {sellPrice}
        </td>
        <td className={`px-3 py-2 text-sm tabular-nums ${TEXT_BODY} whitespace-nowrap`}>
          {laborHours}
        </td>
        <td className={`px-3 py-2 text-sm tabular-nums ${TEXT_BODY} whitespace-nowrap`}>
          {lineItems}
        </td>
      </tr>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        item.isCurrent
          ? 'border-blue-500/50 bg-blue-50/50 dark:border-blue-400/40 dark:bg-blue-950/30'
          : 'border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800/60'
      }`}
      aria-current={item.isCurrent ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <VersionTitle item={item} />
          <VersionAccessBadge isCurrent={item.isCurrent} />
        </div>
        <FieldRecordStatusBadge status={item.status} />
      </div>
      <p className={`mt-1.5 text-xs ${PLANNER_MUTED}`}>
        <span className={TEXT_BODY}>{estimateType}</span>
        <span aria-hidden> · </span>
        <span>{createdAt}</span>
      </p>
      <p className={`mt-1 text-xs tabular-nums ${TEXT_BODY}`}>
        <span className="font-medium">{sellPrice}</span>
        <span className={PLANNER_MUTED} aria-hidden>
          {' '}
          ·{' '}
        </span>
        <span>{laborHours}</span>
        <span className={PLANNER_MUTED} aria-hidden>
          {' '}
          ·{' '}
        </span>
        <span>
          {item.metrics.lineItemCount != null
            ? `${lineItems} activit${item.metrics.lineItemCount === 1 ? 'y' : 'ies'}`
            : '—'}
        </span>
      </p>
    </div>
  );
}
