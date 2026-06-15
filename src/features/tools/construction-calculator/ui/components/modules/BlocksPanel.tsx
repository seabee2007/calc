import React, { useMemo, useState } from 'react';
import { calculateBlocks } from '../../../domain/modules/blocksModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import NumberSlot from '../slots/NumberSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface BlocksPanelProps {
  controller: CalculatorInputController;
}

export default function BlocksPanel({ controller }: BlocksPanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const wallLength = controller.getSlotValue('blocks', 'wallLength');
  const wallHeight = controller.getSlotValue('blocks', 'wallHeight');
  const blockLength = controller.getSlotValue('blocks', 'blockLength');
  const blockHeight = controller.getSlotValue('blocks', 'blockHeight');
  const wastePercent = controller.getSlotValue('blocks', 'wastePercent');

  const result = useMemo(() => {
    if (wallLength === null || wallHeight === null || blockLength === null || blockHeight === null) {
      return null;
    }
    return calculateBlocks({
      wallLengthInches: wallLength,
      wallHeightInches: wallHeight,
      blockLengthInches: blockLength,
      blockHeightInches: blockHeight,
      wastePercent: wastePercent ?? 5,
    });
  }, [wallLength, wallHeight, blockLength, blockHeight, wastePercent]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.blockCountWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="blocks-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot moduleId="blocks" slotId="wallLength" label="BLOCKS · WALL LENGTH" controller={controller} />
        <DimensionSlot moduleId="blocks" slotId="wallHeight" label="BLOCKS · WALL HEIGHT" controller={controller} />
        <DimensionSlot moduleId="blocks" slotId="blockLength" label="BLOCKS · BLOCK LENGTH" controller={controller} />
        <DimensionSlot moduleId="blocks" slotId="blockHeight" label="BLOCKS · BLOCK HEIGHT" controller={controller} />
        <NumberSlot moduleId="blocks" slotId="wastePercent" label="BLOCKS · WASTE %" controller={controller} unit="%" />
      </div>
      {result && (
        <>
          <ModuleResultRow label="Wall area (sq ft)" value={String(result.wallAreaSqFt)} />
          <ModuleResultRow label="Blocks needed" value={String(result.blockCount)} sendValue={result.blockCount} controller={controller} />
          <ModuleResultRow label="Blocks (with waste)" value={String(result.blockCountWithWaste)} sendValue={result.blockCountWithWaste} controller={controller} />
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
