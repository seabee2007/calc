import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import {
  getDraftLineMoveState,
  type EstimateDraftLine,
} from '../../application/estimateDraftLine';
import { computeTaskRollupSlice } from '../../application/estimateGroupRollups';
import type { EstimateGroupedDivision } from '../../domain/estimateLineItemTree';
import EstimateGroupTotalsRow from './EstimateGroupTotalsRow';
import EstimateActivityCodeLabel from './EstimateActivityCodeLabel';
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
  ESTIMATE_LINE_ITEMS_PANEL,
  ESTIMATE_LINE_ITEM_COLUMN_HEADER,
  ESTIMATE_LINE_ITEM_COL_NUM,
  ESTIMATE_LINE_ITEM_COL_SELL,
  ESTIMATE_LINE_ITEM_COL_TASK,
  ESTIMATE_LINE_ITEM_ROW_GRID,
  ESTIMATE_LINE_ITEM_ROW_GRID_WITH_ACTIONS,
  ESTIMATE_TASK_ROW,
  ESTIMATE_TASK_ROW_MOBILE,
  PLANNER_MUTED,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../estimateWorkspaceTheme';

interface DraftProps {
  mode: 'draft';
  groups: EstimateGroupedDivision<EstimateDraftLine>[];
  allDraftLines?: EstimateDraftLine[];
  emptyMessage?: string;
  /** When true, division and scope groups start collapsed. Draft defaults to expanded. */
  defaultCollapsed?: boolean;
  /** Render scope/activity rows only (omit outer division wrappers). */
  scopesOnly?: boolean;
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
  scopesOnly?: boolean;
}

type Props = DraftProps | SavedProps;

function LineItemColumnHeader({ showActions }: { showActions: boolean }) {
  const gridClass = showActions
    ? ESTIMATE_LINE_ITEM_ROW_GRID_WITH_ACTIONS
    : ESTIMATE_LINE_ITEM_ROW_GRID;

  return (
    <div className={`${gridClass} ${ESTIMATE_LINE_ITEM_COLUMN_HEADER}`}>
      <span className={ESTIMATE_LINE_ITEM_COL_TASK}>Activity</span>
      <span className={`${ESTIMATE_LINE_ITEM_COL_NUM} font-semibold`}>Qty</span>
      <span className={`${ESTIMATE_LINE_ITEM_COL_NUM} font-semibold`}>Labor</span>
      <span className={`${ESTIMATE_LINE_ITEM_COL_NUM} font-semibold`}>Sell</span>
      {showActions ? (
        <span className={`${ESTIMATE_LINE_ITEM_COL_NUM} font-semibold`}>Actions</span>
      ) : null}
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
      <div className={`${ESTIMATE_LINE_ITEM_ROW_GRID} text-sm ${ESTIMATE_TASK_ROW}`}>
        <span className={`font-medium ${TEXT_FOREGROUND} ${ESTIMATE_LINE_ITEM_COL_TASK}`}>
          <EstimateActivityCodeLabel code={task.activityCode} />
          {title}
        </span>
        <span className={`${TEXT_BODY} ${ESTIMATE_LINE_ITEM_COL_NUM}`}>{quantityLabel}</span>
        <span className={`${TEXT_BODY} ${ESTIMATE_LINE_ITEM_COL_NUM}`}>{laborLabel}</span>
        <span className={`${TEXT_FOREGROUND} ${ESTIMATE_LINE_ITEM_COL_SELL}`}>{sellLabel}</span>
      </div>

      <div className={`sm:hidden text-sm ${ESTIMATE_TASK_ROW_MOBILE}`}>
        <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>
          <EstimateActivityCodeLabel code={task.activityCode} />
          {title}
        </p>
        <p className={`mt-0.5 text-xs tabular-nums ${TEXT_MUTED}`}>
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

function renderScopeGroups(props: Props, defaultOpen: boolean) {
  const showActions = props.mode === 'draft';
  const scopes = props.groups.flatMap((division) =>
    division.scopes.map((scope) => ({
      key: `${division.key}-${scope.key}`,
      scope,
    })),
  );

  return (
    <div className="space-y-0.5">
      {scopes.map(({ key, scope }) => (
        <EstimateGroupTotalsRow
          key={key}
          level="scope"
          title={scope.label}
          rollup={scope.rollup}
          defaultOpen={defaultOpen}
        >
          {scope.items.length > 0 ? <LineItemColumnHeader showActions={showActions} /> : null}
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
  );
}

export default function EstimateLineItemsGroupedView(props: Props) {
  const emptyMessage =
    props.emptyMessage ??
    (props.mode === 'draft'
      ? 'No draft activities match the current filters.'
      : 'No saved activities match the current filters.');

  if (props.groups.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm dark:border-slate-700 ${PLANNER_MUTED}`}
      >
        {emptyMessage}
      </div>
    );
  }

  const defaultCollapsed = props.defaultCollapsed ?? props.mode === 'saved';
  const defaultOpen = !defaultCollapsed;
  const scopesOnly = props.scopesOnly ?? false;

  if (scopesOnly) {
    return renderScopeGroups(props, defaultOpen);
  }

  return (
    <div className={ESTIMATE_LINE_ITEMS_PANEL}>
      {props.groups.map((division) => (
        <EstimateGroupTotalsRow
          key={division.key}
          level="division"
          title={`Division of Work · ${division.label}`}
          rollup={division.rollup}
          defaultOpen={defaultOpen}
        >
          {renderScopeGroups(
            {
              ...props,
              groups: [division],
            },
            defaultOpen,
          )}
        </EstimateGroupTotalsRow>
      ))}
    </div>
  );
}
