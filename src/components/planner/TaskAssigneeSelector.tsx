import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import Select from '../ui/Select';
import type { TaskAssigneeOption } from '../../utils/taskAssigneeOptions';
import {
  getAssigneeInitials,
  normalizeAssigneeIds,
  resolveSelectedAssignees,
} from '../../utils/taskAssigneeOptions';

interface SelectedAssigneesListProps {
  assignees: TaskAssigneeOption[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}

export function SelectedAssigneesList({
  assignees,
  onRemove,
  readOnly = false,
}: SelectedAssigneesListProps) {
  if (assignees.length === 0) {
    return <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">No assignees selected</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Assigned to
      </p>
      {assignees.map((assignee) => (
        <div
          key={assignee.id}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-900/60"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-700 ring-1 ring-cyan-500/30 dark:text-cyan-200 dark:ring-cyan-400/30">
              {getAssigneeInitials(assignee.label)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                {assignee.label}
              </p>
              {assignee.email && (
                <p className="truncate text-xs text-gray-500 dark:text-slate-400">{assignee.email}</p>
              )}
            </div>
          </div>
          {!readOnly && onRemove && (
            <button
              type="button"
              className="rounded-lg p-1 text-gray-400 hover:bg-slate-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={`Remove ${assignee.label}`}
              onClick={() => onRemove(assignee.id)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

interface TaskAssigneeSelectorProps {
  label?: string;
  options: TaskAssigneeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  showSelectedList?: boolean;
  listClassName?: string;
}

export default function TaskAssigneeSelector({
  label = 'Assign to',
  options,
  value,
  onChange,
  disabled = false,
  showSelectedList = true,
  listClassName,
}: TaskAssigneeSelectorProps) {
  const [pickerValue, setPickerValue] = useState('');

  const availableOptions = useMemo(
    () => options.filter((option) => !value.includes(option.id)),
    [options, value],
  );

  const selectedAssignees = useMemo(
    () => resolveSelectedAssignees(value, options),
    [value, options],
  );

  const selectOptions = useMemo(
    () => [
      { value: '', label: 'Select assignee...' },
      ...availableOptions.map((option) => ({ value: option.id, label: option.label })),
    ],
    [availableOptions],
  );

  const handleSelect = (nextId: string) => {
    if (!nextId || disabled) return;
    onChange(normalizeAssigneeIds([...value, nextId]));
    setPickerValue('');
  };

  const handleRemove = (id: string) => {
    if (disabled) return;
    onChange(value.filter((entry) => entry !== id));
  };

  return (
    <div className={`min-w-0 ${listClassName ?? ''}`}>
      <Select
        label={label}
        value={pickerValue}
        onChange={handleSelect}
        options={selectOptions}
        disabled={disabled || availableOptions.length === 0}
        fullWidth
      />
      {showSelectedList && (
        <SelectedAssigneesList
          assignees={selectedAssignees}
          onRemove={disabled ? undefined : handleRemove}
          readOnly={disabled}
        />
      )}
    </div>
  );
}
