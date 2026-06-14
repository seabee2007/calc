import React, { useMemo, useState } from 'react';
import { calculateArea } from '../../../domain/modules/areaModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
} from './modulePanelShared';

export default function AreaPanel() {
  const [lengthFt, setLengthFt] = useState('10');
  const [widthFt, setWidthFt] = useState('12');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateArea({
        lengthInches: parseFeet(lengthFt),
        widthInches: parseFeet(widthFt),
      }),
    [lengthFt, widthFt],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.squareFeet;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.squareFeet]);

  return (
    <div className="space-y-4" data-testid="area-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Length" value={lengthFt} onChange={setLengthFt} unit="ft" />
        <ModuleNumberField label="Width" value={widthFt} onChange={setWidthFt} unit="ft" />
      </div>
      <ModuleResultRow label="Area (sq ft)" value={String(result.squareFeet)} />
      <ModuleResultRow label="Area (sq yd)" value={String(result.squareYards)} />
      <ModuleResultRow label="Area (sq m)" value={String(result.squareMeters)} />
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
