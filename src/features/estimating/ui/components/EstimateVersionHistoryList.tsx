import type { EstimateVersionHistoryItem } from '../estimateVersionDisplay';
import { formatEstimateVersionLabel } from '../estimateVersionDisplay';
import {
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';
import EstimateVersionHistoryRow from './EstimateVersionHistoryRow';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';

export interface EstimateCurrentVersionSummary {
  versionName: string;
  versionNumber: number;
  lineItemCount: number;
  totalSellPrice: string;
}

interface Props {
  items: EstimateVersionHistoryItem[];
  loading?: boolean;
  currentVersion?: EstimateCurrentVersionSummary | null;
}

const TABLE_COLUMNS = [
  'Version',
  'Status',
  'Type',
  'Created',
  'Sell price',
  'Labor hrs',
  'Activities',
] as const;

export default function EstimateVersionHistoryList({
  items,
  loading = false,
  currentVersion = null,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-10 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 sm:h-9"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EstimateWorkspaceEmptyState
        title="No estimate versions yet"
        body="Saved versions will appear here after you save activities from the builder."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>Version history</h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Estimate versions are append-only. Saving changes creates a new version and preserves
          older versions.
        </p>
      </div>

      {currentVersion ? (
        <p className={`text-sm ${TEXT_BODY}`}>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>Current version: </span>
          <span>
            {formatEstimateVersionLabel(
              currentVersion.versionName,
              currentVersion.versionNumber,
            )}
          </span>
          <span className={PLANNER_MUTED} aria-hidden>
            {' '}
            ·{' '}
          </span>
          <span className="font-medium tabular-nums">{currentVersion.totalSellPrice}</span>
          <span className={PLANNER_MUTED} aria-hidden>
            {' '}
            ·{' '}
          </span>
          <span>
            {currentVersion.lineItemCount} activit
            {currentVersion.lineItemCount === 1 ? 'y' : 'ies'}
          </span>
        </p>
      ) : null}

      <div className={`hidden sm:block ${PLANNER_TABLE_WRAPPER}`}>
        <table className={PLANNER_TABLE}>
          <thead className={PLANNER_TABLE_HEAD}>
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <EstimateVersionHistoryRow key={item.id} item={item} layout="table" />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 sm:hidden" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <EstimateVersionHistoryRow item={item} layout="mobile" />
          </li>
        ))}
      </ul>

      <p className={`text-xs ${TEXT_BODY} ${PLANNER_MUTED}`}>
        {items.length} version{items.length === 1 ? '' : 's'} on record. Older versions are
        read-only snapshots.
      </p>
    </div>
  );
}
