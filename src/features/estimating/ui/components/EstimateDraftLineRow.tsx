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
import {
  PLANNER_MUTED,
  PLANNER_TABLE_ROW,
  TEXT_FOREGROUND,
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
  const quantityLabel = [
    formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 }),
    draft.unit.trim() || undefined,
  ]
    .filter(Boolean)
    .join(' ');

  if (!nested) {
    return (
      <div
        className={`flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between ${PLANNER_TABLE_ROW}`}
      >
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <div className="min-w-0">
            <p className={`text-xs ${PLANNER_MUTED}`}>CSI</p>
            <p className={`truncate ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(task.lineItem.csiDivision)}
            </p>
          </div>
          <div className="min-w-0">
            <p className={`text-xs ${PLANNER_MUTED}`}>Scope</p>
            <p className={`truncate ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(task.scopeName)}
            </p>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1 lg:col-span-2">
            <p className={`text-xs ${PLANNER_MUTED}`}>Task</p>
            <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>
              {formatEstimateBlank(task.title || task.lineItem.description)}
            </p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Qty</p>
            <p className={`tabular-nums ${TEXT_FOREGROUND}`}>{quantityLabel}</p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Labor</p>
            <p className={`tabular-nums ${TEXT_FOREGROUND}`}>
              {formatEstimateHours(preview.laborHours)}
            </p>
          </div>
          <div>
            <p className={`text-xs ${PLANNER_MUTED}`}>Sell price</p>
            <p className={`tabular-nums font-medium ${TEXT_FOREGROUND}`}>
              {formatEstimateCurrency(preview.sellPrice)}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2">
          {onMoveUp ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<ArrowUp className="h-4 w-4" />}
              disabled={!canMoveUp}
              title="Move line up"
              onClick={onMoveUp}
            >
              Up
            </Button>
          ) : null}
          {onMoveDown ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<ArrowDown className="h-4 w-4" />}
              disabled={!canMoveDown}
              title="Move line down"
              onClick={onMoveDown}
            >
              Down
            </Button>
          ) : null}
          {onDuplicate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Copy className="h-4 w-4" />}
              title="Duplicate line item"
              onClick={onDuplicate}
            >
              Duplicate
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Pencil className="h-4 w-4" />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/80 ${PLANNER_TABLE_ROW}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>
          {formatEstimateBlank(task.title || task.lineItem.description)}
        </p>
        <p className={`mt-0.5 text-xs tabular-nums ${PLANNER_MUTED}`}>
          {quantityLabel}
          <span aria-hidden> · </span>
          {formatEstimateHours(preview.laborHours)}
          <span aria-hidden> · </span>
          <span className={`font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateCurrency(preview.sellPrice)}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onMoveUp ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<ArrowUp className="h-4 w-4" />}
            disabled={!canMoveUp}
            aria-label="Move line up"
            title="Move line up"
            className="!px-2"
            onClick={onMoveUp}
          />
        ) : null}
        {onMoveDown ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<ArrowDown className="h-4 w-4" />}
            disabled={!canMoveDown}
            aria-label="Move line down"
            title="Move line down"
            className="!px-2"
            onClick={onMoveDown}
          />
        ) : null}
        {onDuplicate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Copy className="h-4 w-4" />}
            aria-label="Duplicate line item"
            title="Duplicate line item"
            className="!px-2"
            onClick={onDuplicate}
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Pencil className="h-4 w-4" />}
          aria-label="Edit line item"
          title="Edit line item"
          className="!px-2"
          onClick={onEdit}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Trash2 className="h-4 w-4" />}
          aria-label="Remove line item"
          title="Remove line item"
          className="!px-2"
          onClick={onRemove}
        />
      </div>
    </div>
  );
}
