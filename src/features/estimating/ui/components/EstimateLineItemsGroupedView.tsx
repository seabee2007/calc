import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import {
  getDraftLineMoveState,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import EstimateGroupTotalsRow from './EstimateGroupTotalsRow';
import EstimateDraftLineRow from './EstimateDraftLineRow';
import {
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  laborHoursFromTask,
  lineDirectCostFromTask,
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
  return (
    <div
      className={`rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900/40 ${PLANNER_TABLE_ROW}`}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className={`text-xs ${PLANNER_MUTED}`}>Task</p>
          <p className={`font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateBlank(task.title || task.lineItem.description)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>Qty</p>
          <p className={`tabular-nums ${TEXT_FOREGROUND}`}>
            {formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 })}
            {unitFromTask(task) ? ` ${unitFromTask(task)}` : ''}
          </p>
        </div>
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>Labor</p>
          <p className={`tabular-nums ${TEXT_FOREGROUND}`}>
            {formatEstimateHours(laborHoursFromTask(task))}
          </p>
        </div>
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>Direct</p>
          <p className={`tabular-nums font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateCurrency(lineDirectCostFromTask(task))}
          </p>
        </div>
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
                subtitle={`${scope.rollup.itemCount} task${scope.rollup.itemCount === 1 ? '' : 's'}`}
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
