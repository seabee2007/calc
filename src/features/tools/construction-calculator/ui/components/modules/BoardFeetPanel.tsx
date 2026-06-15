import React, { useMemo, useState } from 'react';
import { calculateBoardFeetModule } from '../../../domain/modules/boardFeetModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import { buildDimensionFromDecimal } from '../../../domain/constructionCalculatorFormatters';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface BoardFeetPanelProps {
  controller: CalculatorInputController;
}

export default function BoardFeetPanel({ controller }: BoardFeetPanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const thickness = controller.getSlotValue('board-feet', 'thickness');
  const width = controller.getSlotValue('board-feet', 'width');
  const length = controller.getSlotValue('board-feet', 'length');

  const result = useMemo(() => {
    if (thickness === null || width === null || length === null) return null;
    return calculateBoardFeetModule({
      thicknessInches: thickness,
      widthInches: width,
      lengthFeet: length / 12,
    });
  }, [thickness, width, length]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.boardFeet;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="board-feet-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <DimensionSlot moduleId="board-feet" slotId="thickness" label="BOARD FEET · THICKNESS" controller={controller} />
        <DimensionSlot moduleId="board-feet" slotId="width" label="BOARD FEET · WIDTH" controller={controller} />
        <DimensionSlot moduleId="board-feet" slotId="length" label="BOARD FEET · LENGTH" controller={controller} />
      </div>
      {result && (
        <ModuleResultRow
          label="Board feet"
          value={String(result.boardFeet)}
          sendValue={result.boardFeet}
          controller={controller}
        />
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
