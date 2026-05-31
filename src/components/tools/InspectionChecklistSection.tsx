import React from 'react';
import { Camera } from 'lucide-react';
import type { InspectionItem } from '../../types/fieldTools';
import Input from '../ui/Input';
import InspectionStatusControl from './InspectionStatusControl';
import { FIELD_TOOL_MUTED } from './fieldToolTheme';

interface InspectionChecklistSectionProps {
  items: InspectionItem[];
  onChange: (items: InspectionItem[]) => void;
}

export default function InspectionChecklistSection({
  items,
  onChange,
}: InspectionChecklistSectionProps) {
  const updateItem = (id: string, patch: Partial<InspectionItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <ul className="divide-y divide-gray-200 dark:divide-slate-700">
      {items.map((item, index) => (
        <li key={item.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                <span className="text-gray-400 dark:text-slate-500 mr-2">{index + 1}.</span>
                {item.label}
              </p>
            </div>
            <InspectionStatusControl
              value={item.status}
              onChange={(status) => updateItem(item.id, { status })}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              label="Notes"
              value={item.notes}
              onChange={(e) => updateItem(item.id, { notes: e.target.value })}
              fullWidth
            />
            <div className="flex items-end">
              <button
                type="button"
                disabled
                title="Photo upload coming soon"
                className="inline-flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 dark:border-slate-600 dark:text-slate-500"
              >
                <Camera className="h-4 w-4" />
                Attach photo — coming soon
              </button>
            </div>
          </div>
        </li>
      ))}
      {items.length === 0 && <p className={FIELD_TOOL_MUTED}>No checklist items.</p>}
    </ul>
  );
}
