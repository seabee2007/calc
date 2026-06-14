import React, { useMemo, useState } from 'react';
import {
  centimetersToDecimalInches,
  decimalInchesToCentimeters,
  decimalInchesToDecimalFeet,
  decimalInchesToMeters,
  decimalInchesToMillimeters,
  decimalInchesToYards,
  decimalFeetToDecimalInches,
  formatFeetInchesFraction,
  metersToDecimalInches,
  millimetersToDecimalInches,
  yardsToDecimalInches,
} from '../../../domain/constructionDimensionMath';
import { DEFAULT_FRACTION_PRECISION } from '../../../domain/constructionCalculatorTypes';
import { ModuleNumberField, ModuleResultRow } from './modulePanelShared';

type ConvertFrom = 'ft-in' | 'decimal-ft' | 'yd' | 'm' | 'cm' | 'mm';

export default function ConversionsPanel() {
  const [fromUnit, setFromUnit] = useState<ConvertFrom>('ft-in');
  const [feet, setFeet] = useState('5');
  const [inches, setInches] = useState('4');
  const [decimalValue, setDecimalValue] = useState('5.33');

  const decimalInches = useMemo(() => {
    switch (fromUnit) {
      case 'ft-in':
        return (parseFloat(feet) || 0) * 12 + (parseFloat(inches) || 0);
      case 'decimal-ft':
        return decimalFeetToDecimalInches(parseFloat(decimalValue) || 0);
      case 'yd':
        return yardsToDecimalInches(parseFloat(decimalValue) || 0);
      case 'm':
        return metersToDecimalInches(parseFloat(decimalValue) || 0);
      case 'cm':
        return centimetersToDecimalInches(parseFloat(decimalValue) || 0);
      case 'mm':
        return millimetersToDecimalInches(parseFloat(decimalValue) || 0);
      default:
        return 0;
    }
  }, [fromUnit, feet, inches, decimalValue]);

  return (
    <div className="space-y-4" data-testid="conversions-panel">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Convert from</span>
        <select
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          value={fromUnit}
          onChange={(e) => setFromUnit(e.target.value as ConvertFrom)}
        >
          <option value="ft-in">Feet & inches</option>
          <option value="decimal-ft">Decimal feet</option>
          <option value="yd">Yards</option>
          <option value="m">Meters</option>
          <option value="cm">Centimeters</option>
          <option value="mm">Millimeters</option>
        </select>
      </label>

      {fromUnit === 'ft-in' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModuleNumberField label="Feet" value={feet} onChange={setFeet} />
          <ModuleNumberField label="Inches" value={inches} onChange={setInches} />
        </div>
      ) : (
        <ModuleNumberField label="Value" value={decimalValue} onChange={setDecimalValue} />
      )}

      <ModuleResultRow
        label="Feet-inches-fraction"
        value={formatFeetInchesFraction(decimalInches, DEFAULT_FRACTION_PRECISION)}
      />
      <ModuleResultRow label="Decimal feet" value={String(Math.round(decimalInchesToDecimalFeet(decimalInches) * 10000) / 10000)} />
      <ModuleResultRow label="Yards" value={String(Math.round(decimalInchesToYards(decimalInches) * 10000) / 10000)} />
      <ModuleResultRow label="Meters" value={String(Math.round(decimalInchesToMeters(decimalInches) * 10000) / 10000)} />
      <ModuleResultRow label="Centimeters" value={String(Math.round(decimalInchesToCentimeters(decimalInches) * 100) / 100)} />
      <ModuleResultRow label="Millimeters" value={String(Math.round(decimalInchesToMillimeters(decimalInches) * 100) / 100)} />
    </div>
  );
}
