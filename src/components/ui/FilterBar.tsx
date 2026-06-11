import React from 'react';
import { FOCUS_RING } from '../../theme/appTheme';

export interface FilterBarOption {
  id: string;
  label: string;
}

export interface FilterBarProps {
  options: FilterBarOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Filter options',
}) => (
  <div
    className={`flex flex-wrap gap-2 ${className}`}
    role="group"
    aria-label={ariaLabel}
  >
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.id)}
          className={[
            'rounded-full border px-3 py-1 text-sm transition-colors',
            FOCUS_RING,
            active
              ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-500 dark:bg-cyan-500'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
          ].join(' ')}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default FilterBar;
