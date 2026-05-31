import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AttendanceRow } from '../../types/fieldTools';
import { newRowId } from '../../types/fieldTools';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface AttendanceRowsEditorProps {
  rows: AttendanceRow[];
  onChange: (rows: AttendanceRow[]) => void;
}

function emptyRow(): AttendanceRow {
  return {
    id: newRowId(),
    workerName: '',
    company: '',
    signature: '',
    time: '',
  };
}

export default function AttendanceRowsEditor({ rows, onChange }: AttendanceRowsEditorProps) {
  const updateRow = (id: string, patch: Partial<AttendanceRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => onChange([...rows, emptyRow()])}
      >
        Add attendee
      </Button>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No attendees listed yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="rounded p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Remove attendee"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Worker name"
                  value={row.workerName}
                  onChange={(e) => updateRow(row.id, { workerName: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Company"
                  value={row.company}
                  onChange={(e) => updateRow(row.id, { company: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Signature (typed)"
                  value={row.signature}
                  onChange={(e) => updateRow(row.id, { signature: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Time"
                  type="time"
                  value={row.time}
                  onChange={(e) => updateRow(row.id, { time: e.target.value })}
                  fullWidth
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
