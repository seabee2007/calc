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

const ICON_BUTTON_CLASS = '!h-7 !w-7 !px-0';

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
    <div className="flex shrink-0 items-center gap-0.5">
      {onMoveUp ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          disabled={!canMoveUp}
          aria-label="Move line up"
          title="Move line up"
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
          aria-label="Move line down"
          title="Move line down"
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
          aria-label="Duplicate line item"
          title="Duplicate line item"
          className={ICON_BUTTON_CLASS}
          onClick={onDuplicate}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Pencil className="h-3.5 w-3.5" />}
        aria-label="Edit line item"
        title="Edit line item"
        className={ICON_BUTTON_CLASS}
        onClick={onEdit}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        aria-label="Remove line item"
        title="Remove line item"
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
            <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>{title}</p>
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
        className={`hidden sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_5rem_6.5rem_auto] sm:items-center sm:gap-x-3 border-b border-slate-100 px-2 py-1.5 text-sm last:border-b-0 dark:border-slate-800/80 ${PLANNER_TABLE_ROW}`}
      >
        <span className={`truncate font-medium ${TEXT_FOREGROUND}`}>{title}</span>
        <span className={`tabular-nums text-xs ${TEXT_FOREGROUND}`}>{quantityLabel}</span>
        <span className={`tabular-nums text-xs ${TEXT_FOREGROUND}`}>{laborLabel}</span>
        <span className={`tabular-nums text-xs font-medium ${TEXT_FOREGROUND}`}>{sellLabel}</span>
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
        className={`sm:hidden rounded-md border border-slate-200/80 bg-white px-2.5 py-2 text-sm dark:border-slate-700/80 dark:bg-slate-800/60 ${PLANNER_TABLE_ROW}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`truncate font-medium ${TEXT_FOREGROUND}`}>{title}</p>
            <p className={`mt-0.5 text-xs tabular-nums ${PLANNER_MUTED}`}>
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
