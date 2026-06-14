import React, { useMemo, useState } from 'react';
import { calculateDrywall } from '../../../domain/modules/drywallModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
  parseInches,
} from './modulePanelShared';

export default function DrywallPanel() {
  const [wallLengthFt, setWallLengthFt] = useState('12');
  const [wallHeightFt, setWallHeightFt] = useState('8');
  const [sheetWidth, setSheetWidth] = useState('48');
  const [sheetHeight, setSheetHeight] = useState('96');
  const [waste, setWaste] = useState('10');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateDrywall({
        wallLengthInches: parseFeet(wallLengthFt),
        wallHeightInches: parseFeet(wallHeightFt),
        sheetWidthInches: parseInches(sheetWidth),
        sheetHeightInches: parseInches(sheetHeight),
        wastePercent: parseFloat(waste) || 0,
      }),
    [wallLengthFt, wallHeightFt, sheetWidth, sheetHeight, waste],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.sheetCountWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.sheetCountWithWaste]);

  return (
    <div className="space-y-4" data-testid="drywall-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Wall length" value={wallLengthFt} onChange={setWallLengthFt} unit="ft" />
        <ModuleNumberField label="Wall height" value={wallHeightFt} onChange={setWallHeightFt} unit="ft" />
        <ModuleNumberField label="Sheet width" value={sheetWidth} onChange={setSheetWidth} unit="in" />
        <ModuleNumberField label="Sheet height" value={sheetHeight} onChange={setSheetHeight} unit="in" />
        <ModuleNumberField label="Waste %" value={waste} onChange={setWaste} unit="%" />
      </div>
      <ModuleResultRow label="Wall area (sq ft)" value={String(result.wallAreaSqFt)} />
      <ModuleResultRow label="Sheets needed" value={String(result.sheetCount)} />
      <ModuleResultRow label="Sheets (with waste)" value={String(result.sheetCountWithWaste)} />
      <CostFields
        quantity={quantity}
        unitCost={unitCost}
        onQuantityChange={setQuantity}
        onUnitCostChange={setUnitCost}
        totalCost={String(cost.totalCost)}
      />
    </div>
  );
}
