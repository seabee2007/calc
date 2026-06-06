import { ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { computeLinePreviewTotals } from '../estimateFormDefaults';
import {
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
} from '../estimateFormatters';
import type { EstimateDraftLine } from '../../application/estimateDraftLine';
import EstimateActivityCodeLabel from './EstimateActivityCodeLabel';
import {
  ESTIMATE_LINE_ITEM_COL_ACTIONS,
  ESTIMATE_LINE_ITEM_COL_NUM,
  ESTIMATE_LINE_ITEM_COL_SELL,
  ESTIMATE_LINE_ITEM_COL_TASK,
  ESTIMATE_LINE_ITEM_ROW_GRID_WITH_ACTIONS,
  ESTIMATE_TASK_ROW,
  ESTIMATE_TASK_ROW_ACTION,
  ESTIMATE_TASK_ROW_MOBILE,
  PLANNER_MUTED,
  PLANNER_TABLE_ROW,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../estimateWorkspaceTheme';

interface Props {
  draft: EstimateDraftLine;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** When true, hide CSI/scope columns (shown on parent group headers). */
  nested?: boolean;
}

const ICON_BUTTON_CLASS = ESTIMATE_TASK_ROW_ACTION;

function DraftLineActions({
  onEdit,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Pick<
  Props,
  | 'onEdit'
  | 'onRemove'
  | 'onDuplicate'
  | 'onMoveUp'
  | 'onMoveDown'
  | 'canMoveUp'
  | 'canMoveDown'
>) {
  return (
    <div className={`${ESTIMATE_LINE_ITEM_COL_ACTIONS} gap-0.5`}>
      {onMoveUp ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          disabled={!canMoveUp}
          aria-label="Move activity up"
          title="Move activity up"
          className={ICON_BUTTON_CLASS}
          onClick={onMoveUp}
        />
      ) : null}
      {onMoveDown ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          disabled={!canMoveDown}
          aria-label="Move activity down"
          title="Move activity down"
          className={ICON_BUTTON_CLASS}
          onClick={onMoveDown}
        />
      ) : null}
      {onDuplicate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Copy className="h-3.5 w-3.5" />}
          aria-label="Duplicate activity"
          title="Duplicate activity"
          className={ICON_BUTTON_CLASS}
          onClick={onDuplicate}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Pencil className="h-3.5 w-3.5" />}
        aria-label="Edit activity"
        title="Edit activity"
        className={ICON_BUTTON_CLASS}
        onClick={onEdit}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        aria-label="Remove activity"
        title="Remove activity"
        className={ICON_BUTTON_CLASS}
        onClick={onRemove}
      />
    </div>
  );
}

export default function EstimateDraftLineRow({
  draft,
  onEdit,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  nested = false,
}: Props) {
  const { task } = draft;
  const preview = computeLinePreviewTotals(draft);
  const title = formatEstimateBlank(task.title || task.lineItem.description);
  const quantityLabel = [
    formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 }),
    draft.unit.trim() || undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const laborLabel = formatEstimateHours(preview.laborHours);
  const sellLabel = formatEstimateCurrency(preview.sellPrice);

  if (!nested) {
    return (
      <div
        className={`flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between ${PLANNER_TABLE_ROW}`}
      >
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <div className="min-w-0">
            <p className={`text-xs ${PLANNER_MUTED}`}>Division of Work</p>
            <p className={`truncate ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(task.lineItem.csiDivision)}
            </p>
          </div>
          <div className="min-w-0">
            <p className={`text-xs ${PLANNER_MUTED}`}>Work Package / Scope</p>
            <p className={`truncate ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(task.scopeName)}
            </p>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1 lg:col-span-2">
            <p className={`text-xs ${PLANNER_MUTED}`}>Activity</p>
            <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>
              <EstimateActivityCodeLabel code={task.activityCode} />
              {title}
            </p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Qty</p>
            <p className={`tabular-nums ${TEXT_FOREGROUND}`}>{quantityLabel}</p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Labor</p>
            <p className={`tabular-nums ${TEXT_FOREGROUND}`}>{laborLabel}</p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Sell price</p>
            <p className={`tabular-nums font-medium ${TEXT_FOREGROUND}`}>{sellLabel}</p>
          </div>
        </div>
        <DraftLineActions
          onEdit={onEdit}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`${ESTIMATE_LINE_ITEM_ROW_GRID_WITH_ACTIONS} text-sm ${ESTIMATE_TASK_ROW}`}
      >
        <span className={`font-medium ${TEXT_FOREGROUND} ${ESTIMATE_LINE_ITEM_COL_TASK}`}>
          <EstimateActivityCodeLabel code={task.activityCode} />
          {title}
        </span>
        <span className={`${TEXT_BODY} ${ESTIMATE_LINE_ITEM_COL_NUM}`}>{quantityLabel}</span>
        <span className={`${TEXT_BODY} ${ESTIMATE_LINE_ITEM_COL_NUM}`}>{laborLabel}</span>
        <span className={`${TEXT_FOREGROUND} ${ESTIMATE_LINE_ITEM_COL_SELL}`}>{sellLabel}</span>
        <DraftLineActions
          onEdit={onEdit}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>

      <div
        className={`sm:hidden text-sm ${ESTIMATE_TASK_ROW_MOBILE}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
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
          <DraftLineActions
            onEdit={onEdit}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      </div>
    </>
  );
}
