import React from 'react';
import { Calendar } from 'lucide-react';
import Input from './Input';
import { normalizeDateInputValue, toDateInputValue } from '../../utils/dateInput';

export interface DatePickerFieldProps {
  label?: string;
  value: unknown;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
  allowClear?: boolean;
  id?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  helperText,
  error,
  fullWidth = false,
  allowClear = true,
  id,
  disabled,
  required,
}: DatePickerFieldProps) {
  const inputValue = toDateInputValue(value);
  const showClear = allowClear && !required && Boolean(inputValue) && !disabled;

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <Input
        id={id}
        label={label}
        type="date"
        value={inputValue}
        onChange={(event) => onChange(normalizeDateInputValue(event.target.value))}
        helperText={helperText}
        error={error}
        fullWidth={fullWidth}
        disabled={disabled}
        required={required}
        icon={<Calendar className="h-5 w-5 text-slate-400" aria-hidden />}
      />
      {showClear ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          Clear date
        </button>
      ) : null}
    </div>
  );
}
