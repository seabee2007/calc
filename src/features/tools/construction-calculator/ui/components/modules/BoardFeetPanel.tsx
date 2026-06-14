import React, { useMemo, useState } from 'react';
import { calculateBoardFeetModule } from '../../../domain/modules/boardFeetModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseInches,
} from './modulePanelShared';

export default function BoardFeetPanel() {
  const [thickness, setThickness] = useState('1.5');
  const [width, setWidth] = useState('5.5');
  const [lengthFt, setLengthFt] = useState('8');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateBoardFeetModule({
        thicknessInches: parseInches(thickness),
        widthInches: parseInches(width),
        lengthFeet: parseFloat(lengthFt) || 0,
      }),
    [thickness, width, lengthFt],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.boardFeet;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.boardFeet]);

  return (
    <div className="space-y-4" data-testid="board-feet-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <ModuleNumberField label="Thickness" value={thickness} onChange={setThickness} unit="in" />
        <ModuleNumberField label="Width" value={width} onChange={setWidth} unit="in" />
        <ModuleNumberField label="Length" value={lengthFt} onChange={setLengthFt} unit="ft" />
      </div>
      <ModuleResultRow label="Board feet" value={String(result.boardFeet)} />
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
