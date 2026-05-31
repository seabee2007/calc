import React from 'react';
import type { InspectionStatus } from '../../types/fieldTools';

const OPTIONS: { value: InspectionStatus; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
];

interface InspectionStatusControlProps {
  value: InspectionStatus;
  onChange: (value: InspectionStatus) => void;
  disabled?: boolean;
}

export default function InspectionStatusControl({
  value,
  onChange,
  disabled = false,
}: InspectionStatusControlProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-slate-600"
      role="group"
      aria-label="Inspection result"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? null : opt.value)}
            className={`min-w-[3rem] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? opt.value === 'pass'
                  ? 'bg-emerald-600 text-white'
                  : opt.value === 'fail'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
