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
}

type Props = DraftProps | SavedProps;

function SavedTaskRow({ task }: { task: EstimateDomainTask }) {
  const rollup = computeTaskRollupSlice(task);
  const unit = unitFromTask(task);
  const quantityLabel = [
    formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 }),
    unit,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/40 ${PLANNER_TABLE_ROW}`}
    >
      <div className="min-w-0">
        <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>
          {formatEstimateBlank(task.title || task.lineItem.description)}
        </p>
        <p className={`mt-0.5 text-xs tabular-nums ${PLANNER_MUTED}`}>
          {quantityLabel}
          <span aria-hidden> · </span>
          {formatEstimateHours(laborHoursFromTask(task))}
          <span aria-hidden> · </span>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateCurrency(rollup.sellPrice)}
          </span>
        </p>
      </div>
    </div>
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
      <div className={`rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm dark:border-slate-700 ${PLANNER_MUTED}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.groups.map((division) => (
        <EstimateGroupTotalsRow
          key={division.key}
          level="division"
          title={`Division ${division.label}`}
          rollup={division.rollup}
        >
          <div className="space-y-2">
            {division.scopes.map((scope) => (
              <EstimateGroupTotalsRow
                key={`${division.key}-${scope.key}`}
                level="scope"
                title={scope.label}
                rollup={scope.rollup}
              >
                <div className="space-y-2">
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
                    : scope.items.map((task) => (
                        <SavedTaskRow key={task.id} task={task} />
                      ))}
                </div>
              </EstimateGroupTotalsRow>
            ))}
          </div>
        </EstimateGroupTotalsRow>
      ))}
    </div>
  );
}
