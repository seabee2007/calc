import React, { useState } from 'react';
import Input from '../ui/Input';

export interface ClearableNumberInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  fullWidth?: boolean;
  integer?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

function parseDraft(raw: string, integer?: boolean): number {
  if (raw === '' || raw === '-' || raw === '.') return 0;
  const parsed = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatStoredValue(value: number, integer?: boolean): string {
  return integer ? String(Math.round(value)) : String(value);
}

/** Numeric input that shows 0 as an empty field with placeholder until edited. */
export default function ClearableNumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder = '0',
  fullWidth,
  integer = false,
  disabled = false,
  'data-testid': dataTestId,
}: ClearableNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const displayValue =
    draft !== null
      ? draft
      : value === 0
        ? ''
        : formatStoredValue(value, integer);

  const commitDraft = (raw: string) => {
    onChange(clamp(parseDraft(raw, integer), min, max));
    setDraft(null);
  };

  return (
    <Input
      label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      fullWidth={fullWidth}
      value={displayValue}
      disabled={disabled}
      data-testid={dataTestId}
      onFocus={() => {
        setDraft(value === 0 ? '' : formatStoredValue(value, integer));
      }}
      onBlur={() => {
        if (draft !== null) {
          commitDraft(draft);
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        onChange(clamp(parseDraft(nextValue, integer), min, max));
      }}
    />
  );
}
