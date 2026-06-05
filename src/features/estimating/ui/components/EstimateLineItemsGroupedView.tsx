import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import {
  getDraftLineMoveState,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';
import { computeTaskRollupSlice } from '../../application/estimateGroupRollups';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import EstimateGroupTotalsRow from './EstimateGroupTotalsRow';
import EstimateDraftLineRow from './EstimateDraftLineRow';
import {
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  laborHoursFromTask,
  unitFromTask,
} from '../estimateFormatters';
import {
  PLANNER_MUTED,
  PLANNER_TABLE_ROW,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface DraftProps {
  mode: 'draft';
  groups: EstimateGroupedDivision<EstimateDraftLine>[];
  allDraftLines?: EstimateDraftLine[];
  emptyMessage?: string;
  /** When true, division and scope groups start collapsed. Draft defaults to expanded. */
  defaultCollapsed?: boolean;
  onEditDraft: (clientId: string) => void;
  onRemoveDraft: (clientId: string) => void;
  onDuplicateDraft?: (clientId: string) => void;
  onMoveDraftUp?: (clientId: string) => void;
  onMoveDraftDown?: (clientId: string) => void;
}

interface SavedProps {
  mode: 'saved';
  groups: EstimateGroupedDivision<EstimateDomainTask>[];
  emptyMessage?: string;
  /** When true, division and scope groups start collapsed. Saved defaults to collapsed. */
  defaultCollapsed?: boolean;
}

type Props = DraftProps | SavedProps;

const DESKTOP_ROW_GRID =
  'hidden sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_5rem_6.5rem] sm:items-center sm:gap-x-3';

function LineItemColumnHeader({ showActions }: { showActions: boolean }) {
  const gridClass = showActions
    ? 'hidden sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_5rem_6.5rem_auto] sm:items-center sm:gap-x-3'
    : DESKTOP_ROW_GRID;

  return (
    <div
      className={`${gridClass} border-b border-slate-200/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide dark:border-slate-700/80 ${PLANNER_MUTED}`}
    >
      <span>Task</span>
      <span>Qty</span>
      <span>Labor</span>
      <span>Sell</span>
      {showActions ? <span className="text-right">Actions</span> : null}
    </div>
  );
}

function SavedTaskRow({ task }: { task: EstimateDomainTask }) {
  const rollup = computeTaskRollupSlice(task);
  const unit = unitFromTask(task);
  const title = formatEstimateBlank(task.title || task.lineItem.description);
  const quantityLabel = [
    formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 }),
    unit,
  ]
    .filter(Boolean)
    .join(' ');
  const laborLabel = formatEstimateHours(laborHoursFromTask(task));
  const sellLabel = formatEstimateCurrency(rollup.sellPrice);

  return (
    <>
      <div
        className={`${DESKTOP_ROW_GRID} border-b border-slate-100 px-2 py-1.5 text-sm last:border-b-0 dark:border-slate-800/80 ${PLANNER_TABLE_ROW}`}
      >
        <span className={`truncate font-medium ${TEXT_FOREGROUND}`}>{title}</span>
        <span className={`tabular-nums text-xs ${TEXT_FOREGROUND}`}>{quantityLabel}</span>
        <span className={`tabular-nums text-xs ${TEXT_FOREGROUND}`}>{laborLabel}</span>
        <span className={`tabular-nums text-xs font-medium ${TEXT_FOREGROUND}`}>{sellLabel}</span>
      </div>

      <div
        className={`sm:hidden rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/40 ${PLANNER_TABLE_ROW}`}
      >
        <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>{title}</p>
        <p className={`mt-0.5 text-xs tabular-nums ${PLANNER_MUTED}`}>
          {quantityLabel}
          <span aria-hidden> · </span>
          {laborLabel}
          <span aria-hidden> · </span>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>{sellLabel}</span>
        </p>
      </div>
    </>
  );
}

export default function EstimateLineItemsGroupedView(props: Props) {
  const emptyMessage =
    props.emptyMessage ??
    (props.mode === 'draft'
      ? 'No draft line items match the current filters.'
      : 'No saved line items match the current filters.');

  if (props.groups.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm dark:border-slate-700 ${PLANNER_MUTED}`}
      >
        {emptyMessage}
      </div>
    );
  }

  const showActions = props.mode === 'draft';
  const defaultCollapsed = props.defaultCollapsed ?? props.mode === 'saved';
  const defaultOpen = !defaultCollapsed;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white dark:border-slate-700/80 dark:bg-slate-900/20">
      {props.groups.map((division) => (
        <EstimateGroupTotalsRow
          key={division.key}
          level="division"
          title={`Division ${division.label}`}
          rollup={division.rollup}
          defaultOpen={defaultOpen}
        >
          <div className="space-y-0.5 px-1 sm:px-2">
            {division.scopes.map((scope) => (
              <EstimateGroupTotalsRow
                key={`${division.key}-${scope.key}`}
                level="scope"
                title={scope.label}
                rollup={scope.rollup}
                defaultOpen={defaultOpen}
              >
                {scope.items.length > 0 ? (
                  <LineItemColumnHeader showActions={showActions} />
                ) : null}
                <div className="space-y-1.5 sm:space-y-0">
                  {props.mode === 'draft'
                    ? scope.items.map((draft) => {
                        const moveState = props.allDraftLines
                          ? getDraftLineMoveState(props.allDraftLines, draft.clientId)
                          : { canMoveUp: false, canMoveDown: false };

                        return (
                          <EstimateDraftLineRow
                            key={draft.clientId}
                            draft={draft}
                            nested
                            canMoveUp={moveState.canMoveUp}
                            canMoveDown={moveState.canMoveDown}
                            onEdit={() => props.onEditDraft(draft.clientId)}
                            onRemove={() => props.onRemoveDraft(draft.clientId)}
                            onDuplicate={
                              props.onDuplicateDraft
                                ? () => props.onDuplicateDraft?.(draft.clientId)
                                : undefined
                            }
                            onMoveUp={
                              props.onMoveDraftUp
                                ? () => props.onMoveDraftUp?.(draft.clientId)
                                : undefined
                            }
                            onMoveDown={
                              props.onMoveDraftDown
                                ? () => props.onMoveDraftDown?.(draft.clientId)
                                : undefined
                            }
                          />
                        );
                      })
                    : scope.items.map((task) => <SavedTaskRow key={task.id} task={task} />)}
                </div>
              </EstimateGroupTotalsRow>
            ))}
          </div>
        </EstimateGroupTotalsRow>
      ))}
    </div>
  );
}
