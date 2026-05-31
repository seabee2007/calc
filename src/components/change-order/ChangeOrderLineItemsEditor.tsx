import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChangeOrderLineItem, ChangeOrderLineItemCategory } from '../../types/changeOrder';
import {
  computeLineItemTotal,
  emptyLineItem,
  formatChangeOrderMoney,
} from '../../utils/changeOrderFinancials';
import Button from '../ui/Button';
import { PLANNER_INPUT } from '../planner/plannerTheme';

interface Props {
  label: string;
  category: ChangeOrderLineItemCategory;
  items: ChangeOrderLineItem[];
  onChange: (items: ChangeOrderLineItem[]) => void;
}

function applyPatch(
  row: ChangeOrderLineItem,
  patch: Partial<ChangeOrderLineItem>,
  category: ChangeOrderLineItemCategory,
): ChangeOrderLineItem {
  const next = { ...row, ...patch };
  return { ...next, amount: computeLineItemTotal(next, category) };
}

export default function ChangeOrderLineItemsEditor({
  label,
  category,
  items,
  onChange,
}: Props) {
  const isEquipment = category === 'equipment';

  const update = (index: number, patch: Partial<ChangeOrderLineItem>) => {
    const next = items.map((row, i) =>
      i === index ? applyPatch(row, patch, category) : row,
    );
    onChange(next);
  };

  const gridClass = isEquipment
    ? 'sm:grid-cols-[1fr_72px_72px_96px_100px_auto]'
    : 'sm:grid-cols-[1fr_72px_96px_100px_auto]';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-200">{label}</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => onChange([...items, emptyLineItem(category)])}
        >
          Add line
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400">No line items yet.</p>
      )}
      {items.length > 0 && (
        <div
          className={`hidden gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 sm:grid ${gridClass}`}
        >
          <span>Description</span>
          <span>Qty</span>
          {isEquipment ? <span>Hrs</span> : null}
          <span>{isEquipment ? '$/hr' : 'Unit price'}</span>
          <span>Total</span>
          <span className="sr-only">Remove</span>
        </div>
      )}
      {items.map((row, index) => {
        const lineTotal = computeLineItemTotal(row, category);
        return (
          <div
            key={index}
            className={`grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 sm:grid ${gridClass}`}
          >
            <input
              type="text"
              value={row.description}
              onChange={(e) => update(index, { description: e.target.value })}
              placeholder="Description"
              className={PLANNER_INPUT}
            />
            <input
              type="number"
              min={0}
              step={1}
              value={row.qty ?? ''}
              onChange={(e) =>
                update(index, { qty: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Qty"
              className={PLANNER_INPUT}
            />
            {isEquipment && (
              <input
                type="number"
                min={0}
                step={1}
                value={row.hours ?? ''}
                onChange={(e) =>
                  update(index, { hours: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="Hrs"
                className={PLANNER_INPUT}
              />
            )}
            <input
              type="number"
              min={0}
              step={isEquipment ? 1 : 0.01}
              value={row.unitPrice ?? ''}
              onChange={(e) =>
                update(index, {
                  unitPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={isEquipment ? '$/hr' : 'Unit $'}
              title={
                isEquipment
                  ? 'Equipment rate per hour'
                  : 'Unit price (e.g. $/hr or $/SF); line total = Qty × unit price'
              }
              className={PLANNER_INPUT}
            />
            <div
              className="flex min-h-[42px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium tabular-nums text-gray-900 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
              aria-label="Line total"
            >
              {formatChangeOrderMoney(lineTotal)}
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="flex h-10 w-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              aria-label="Remove line"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {isEquipment && items.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Equipment total = Qty × Hrs × $/hr per line.
        </p>
      )}
      {!isEquipment && items.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Line total = Qty × unit price.
        </p>
      )}
    </div>
  );
}
