import React, { useMemo, useState } from 'react';
import { calculateVolume } from '../../../domain/modules/volumeModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
  parseInches,
} from './modulePanelShared';

export default function VolumePanel() {
  const [lengthFt, setLengthFt] = useState('10');
  const [widthFt, setWidthFt] = useState('10');
  const [heightIn, setHeightIn] = useState('4');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateVolume({
        lengthInches: parseFeet(lengthFt),
        widthInches: parseFeet(widthFt),
        heightInches: parseInches(heightIn),
      }),
    [lengthFt, widthFt, heightIn],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.cubicYards;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.cubicYards]);

  return (
    <div className="space-y-4" data-testid="volume-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <ModuleNumberField label="Length" value={lengthFt} onChange={setLengthFt} unit="ft" />
        <ModuleNumberField label="Width" value={widthFt} onChange={setWidthFt} unit="ft" />
        <ModuleNumberField label="Height" value={heightIn} onChange={setHeightIn} unit="in" />
      </div>
      <ModuleResultRow label="Volume (cu ft)" value={String(result.cubicFeet)} />
      <ModuleResultRow label="Volume (cu yd)" value={String(result.cubicYards)} />
      <ModuleResultRow label="Volume (cu m)" value={String(result.cubicMeters)} />
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
