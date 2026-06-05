import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import { groupEstimateTasks } from '../../application/estimateLineItemGrouping';
import EstimateLineItemsGroupedView from './EstimateLineItemsGroupedView';
import { PLANNER_MUTED } from '../estimateWorkspaceTheme';

interface Props {
  lineItems: EstimateDomainTask[];
  /** Pre-filtered groups; when omitted, groups all line items. */
  groups?: EstimateGroupedDivision<EstimateDomainTask>[];
  emptyMessage?: string;
  caption?: string;
}

export default function EstimateReadOnlyLineItemsTable({
  lineItems,
  groups,
  emptyMessage = 'No line items in this version.',
  caption,
}: Props) {
  const displayGroups = groups ?? groupEstimateTasks(lineItems);

  return (
    <div className="space-y-2">
      {caption ? (
        <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{caption}</p>
      ) : null}
      {lineItems.length === 0 ? (
        <div className={`rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm dark:border-slate-700 ${PLANNER_MUTED}`}>
          {emptyMessage}
        </div>
      ) : (
        <EstimateLineItemsGroupedView
          mode="saved"
          groups={displayGroups}
          emptyMessage="No saved line items match the current filters."
        />
      )}
    </div>
  );
}
