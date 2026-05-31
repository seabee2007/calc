import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SafetyJhaRow } from '../../types/fieldTools';
import { newRowId } from '../../types/fieldTools';
import { createDefaultJhaExamples } from '../../data/defaultJhaExamples';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface JhaRowsEditorProps {
  rows: SafetyJhaRow[];
  onChange: (rows: SafetyJhaRow[]) => void;
}

function emptyRow(): SafetyJhaRow {
  return {
    id: newRowId(),
    task: '',
    hazards: '',
    controls: '',
    ppe: '',
    responsible: '',
  };
}

export default function JhaRowsEditor({ rows, onChange }: JhaRowsEditorProps) {
  const updateRow = (id: string, patch: Partial<SafetyJhaRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => onChange([...rows, emptyRow()])}
        >
          Add row
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(createDefaultJhaExamples())}
        >
          Load examples
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No JHA rows yet. Add a row or load the default examples.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                  Row {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-slate-700 dark:hover:text-red-400"
                  aria-label="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Task / activity"
                  value={row.task}
                  onChange={(e) => updateRow(row.id, { task: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Responsible person"
                  value={row.responsible}
                  onChange={(e) => updateRow(row.id, { responsible: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Potential hazards"
                  value={row.hazards}
                  onChange={(e) => updateRow(row.id, { hazards: e.target.value })}
                  fullWidth
                />
                <Input
                  label="PPE required"
                  value={row.ppe}
                  onChange={(e) => updateRow(row.id, { ppe: e.target.value })}
                  fullWidth
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Control measures"
                    value={row.controls}
                    onChange={(e) => updateRow(row.id, { controls: e.target.value })}
                    fullWidth
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
