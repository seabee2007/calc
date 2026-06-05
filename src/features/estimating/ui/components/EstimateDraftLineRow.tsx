import { Pencil, Trash2 } from 'lucide-react';
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
}

export default function EstimateDraftLineRow({ draft, onEdit, onRemove }: Props) {
  const { task } = draft;
  const preview = computeLinePreviewTotals(draft);

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between ${PLANNER_TABLE_ROW}`}
    >
      <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 lg:grid-cols-6">
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>CSI</p>
          <p className={TEXT_FOREGROUND}>{formatEstimateBlank(task.lineItem.csiDivision)}</p>
        </div>
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>Scope</p>
          <p className={TEXT_FOREGROUND}>{formatEstimateBlank(task.scopeName)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
          <p className={`text-xs ${PLANNER_MUTED}`}>Task</p>
          <p className={`font-medium ${TEXT_FOREGROUND}`}>
            {formatEstimateBlank(task.title || task.lineItem.description)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${PLANNER_MUTED}`}>Qty</p>
          <p className={`tabular-nums ${TEXT_FOREGROUND}`}>
            {formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 })}
            {draft.unit.trim() ? ` ${draft.unit.trim()}` : ''}
          </p>
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

      <div className="flex shrink-0 gap-2">
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
