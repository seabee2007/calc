import React, { useMemo, useState } from 'react';
import { calculateConcrete } from '../../../domain/modules/concreteModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
  parseInches,
} from './modulePanelShared';

export default function ConcretePanel() {
  const [lengthFt, setLengthFt] = useState('20');
  const [widthFt, setWidthFt] = useState('10');
  const [depthIn, setDepthIn] = useState('4');
  const [waste, setWaste] = useState('10');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateConcrete({
        lengthInches: parseFeet(lengthFt),
        widthInches: parseFeet(widthFt),
        depthInches: parseInches(depthIn),
        wastePercent: parseFloat(waste) || 0,
      }),
    [lengthFt, widthFt, depthIn, waste],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.cubicYardsWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.cubicYardsWithWaste]);

  return (
    <div className="space-y-4" data-testid="concrete-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Length" value={lengthFt} onChange={setLengthFt} unit="ft" />
        <ModuleNumberField label="Width" value={widthFt} onChange={setWidthFt} unit="ft" />
        <ModuleNumberField label="Depth" value={depthIn} onChange={setDepthIn} unit="in" />
        <ModuleNumberField label="Waste %" value={waste} onChange={setWaste} unit="%" />
      </div>
      <ModuleResultRow label="Cubic feet" value={String(result.cubicFeet)} />
      <ModuleResultRow label="Cubic yards" value={String(result.cubicYards)} />
      <ModuleResultRow label="Cubic yards (with waste)" value={String(result.cubicYardsWithWaste)} />
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
