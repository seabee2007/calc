import React, { useMemo, useState } from 'react';
import { calculateArea } from '../../../domain/modules/areaModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface AreaPanelProps {
  controller: CalculatorInputController;
}

export default function AreaPanel({ controller }: AreaPanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const length = controller.getSlotValue('area', 'length');
  const width = controller.getSlotValue('area', 'width');

  const result = useMemo(() => {
    if (length === null || width === null) return null;
    return calculateArea({ lengthInches: length, widthInches: width });
  }, [length, width]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.squareFeet;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="area-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot moduleId="area" slotId="length" label="AREA · LENGTH" controller={controller} />
        <DimensionSlot moduleId="area" slotId="width" label="AREA · WIDTH" controller={controller} />
      </div>
      {result && (
        <>
          <ModuleResultRow
            label="Area (sq ft)"
            value={String(result.squareFeet)}
            sendValue={result.squareFeet}
            controller={controller}
          />
          <ModuleResultRow label="Area (sq yd)" value={String(result.squareYards)} />
          <ModuleResultRow label="Area (sq m)" value={String(result.squareMeters)} />
        </>
      )}
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
