import React from 'react';
import { FORM_LABEL, FORM_INPUT } from '../../../../../../theme/appTheme';

interface ModuleNumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  step?: string;
}

export function ModuleNumberField({
  label,
  value,
  onChange,
  unit,
  step = 'any',
}: ModuleNumberFieldProps) {
  return (
    <label className="block">
      <span className={FORM_LABEL}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={FORM_INPUT}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          min="0"
        />
        {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </label>
  );
}

interface ModuleResultRowProps {
  label: string;
  value: string;
}

export function ModuleResultRow({ label, value }: ModuleResultRowProps) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 py-2 dark:border-slate-700">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

interface CostFieldsProps {
  quantity: string;
  unitCost: string;
  onQuantityChange: (v: string) => void;
  onUnitCostChange: (v: string) => void;
  totalCost: string;
}

export function CostFields({
  quantity,
  unitCost,
  onQuantityChange,
  onUnitCostChange,
  totalCost,
}: CostFieldsProps) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Cost estimate</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Quantity" value={quantity} onChange={onQuantityChange} />
        <ModuleNumberField
          label="Unit cost"
          value={unitCost}
          onChange={onUnitCostChange}
          unit="$"
          step="0.01"
        />
      </div>
      <ModuleResultRow label="Total cost" value={`$${totalCost}`} />
    </div>
  );
}

export function parseInches(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseFeet(value: string): number {
  return parseInches(value) * 12;
}
