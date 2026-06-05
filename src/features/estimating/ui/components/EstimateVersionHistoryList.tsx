import type { EstimateVersionHistoryItem } from '../estimateVersionDisplay';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE, TEXT_BODY } from '../estimateWorkspaceTheme';
import EstimateVersionHistoryCard from './EstimateVersionHistoryCard';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';

interface Props {
  items: EstimateVersionHistoryItem[];
  loading?: boolean;
}

export default function EstimateVersionHistoryList({ items, loading = false }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((key) => (
          <div
            key={key}
            className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EstimateWorkspaceEmptyState
        title="No estimate versions yet"
        body="Saved versions will appear here after you save line items from the builder."
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

      <ul className="space-y-3" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <EstimateVersionHistoryCard item={item} />
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
