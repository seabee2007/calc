import React from 'react';

export interface EmployeeFilterChip<T extends string> {
  id: T;
  label: string;
}

interface EmployeeFilterChipsProps<T extends string> {
  chips: EmployeeFilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function EmployeeFilterChips<T extends string>({
  chips,
  value,
  onChange,
}: EmployeeFilterChipsProps<T>) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium touch-manipulation ${
            value === chip.id
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
