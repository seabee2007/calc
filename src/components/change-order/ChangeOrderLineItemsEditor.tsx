import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import { emptyLineItem } from '../../utils/changeOrderFinancials';
import Button from '../ui/Button';

interface Props {
  label: string;
  items: ChangeOrderLineItem[];
  onChange: (items: ChangeOrderLineItem[]) => void;
}

export default function ChangeOrderLineItemsEditor({ label, items, onChange }: Props) {
  const update = (index: number, patch: Partial<ChangeOrderLineItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-200">{label}</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => onChange([...items, emptyLineItem()])}
        >
          Add line
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400">No line items yet.</p>
      )}
      {items.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_80px_100px_auto]"
        >
          <input
            type="text"
            value={row.description}
            onChange={(e) => update(index, { description: e.target.value })}
            placeholder="Description"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            min={0}
            value={row.qty ?? ''}
            onChange={(e) =>
              update(index, { qty: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Qty"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            min={0}
            step={0.01}
            value={row.amount || ''}
            onChange={(e) => update(index, { amount: Number(e.target.value) || 0 })}
            placeholder="Amount $"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="flex h-10 w-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
