import React, { useState } from 'react';
import Input from '../ui/Input';

interface TaxRatePercentInputProps {
  label?: string;
  value: number;
  onChange: (rate: number) => void;
  fullWidth?: boolean;
}

/** Whole-number tax rate %; shows empty field (placeholder 0) on focus when value is 0. */
export default function TaxRatePercentInput({
  label = 'Tax rate (%)',
  value,
  onChange,
  fullWidth,
}: TaxRatePercentInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const displayValue =
    draft !== null
      ? draft
      : value === 0
        ? ''
        : String(Math.round(value));

  return (
    <Input
      label={label}
      type="number"
      min={0}
      step={1}
      placeholder="0"
      fullWidth={fullWidth}
      value={displayValue}
      onFocus={() => {
        setDraft(value === 0 ? '' : String(Math.round(value)));
      }}
      onBlur={() => {
        const parsed = Math.max(0, Math.round(Number(draft) || 0));
        onChange(parsed);
        setDraft(null);
      }}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}
