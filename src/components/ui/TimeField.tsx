import React from 'react';
import { Clock } from 'lucide-react';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  className?: string;
  disabled?: boolean;
}

const TimeField: React.FC<TimeFieldProps> = ({
  label,
  value,
  onChange,
  helperText,
  className = '',
  disabled = false,
}) => {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="time"
          step={900}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
      </div>
      {helperText && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export default TimeField;
