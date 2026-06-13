import React from 'react';
import ClearableNumberInput from './ClearableNumberInput';

interface TaxRatePercentInputProps {
  label?: string;
  value: number;
  onChange: (rate: number) => void;
  fullWidth?: boolean;
}

/** Whole-number tax rate %; zero displays as placeholder until edited. */
export default function TaxRatePercentInput({
  label = 'Tax rate (%)',
  value,
  onChange,
  fullWidth,
}: TaxRatePercentInputProps) {
  return (
    <ClearableNumberInput
      label={label}
      value={value}
      onChange={onChange}
      min={0}
      step={1}
      integer
      fullWidth={fullWidth}
    />
  );
}
