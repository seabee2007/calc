import React, { useMemo, useState } from 'react';
import { calculateConcrete } from '../../../domain/modules/concreteModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import NumberSlot from '../slots/NumberSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface ConcretePanelProps {
  controller: CalculatorInputController;
}

export default function ConcretePanel({ controller }: ConcretePanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const length = controller.getSlotValue('concrete', 'length');
  const width = controller.getSlotValue('concrete', 'width');
  const depth = controller.getSlotValue('concrete', 'depth');
  const wastePercent = controller.getSlotValue('concrete', 'wastePercent');

  const result = useMemo(() => {
    if (length === null || width === null || depth === null) return null;
    return calculateConcrete({
      lengthInches: length,
      widthInches: width,
      depthInches: depth,
      wastePercent: wastePercent ?? 10,
    });
  }, [length, width, depth, wastePercent]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.cubicYardsWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="concrete-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot moduleId="concrete" slotId="length" label="CONCRETE · LENGTH" controller={controller} />
        <DimensionSlot moduleId="concrete" slotId="width" label="CONCRETE · WIDTH" controller={controller} />
        <DimensionSlot moduleId="concrete" slotId="depth" label="CONCRETE · DEPTH" controller={controller} />
        <NumberSlot
          moduleId="concrete"
          slotId="wastePercent"
          label="CONCRETE · WASTE %"
          controller={controller}
          unit="%"
        />
      </div>
      {result && (
        <>
          <ModuleResultRow label="Cubic feet" value={String(result.cubicFeet)} sendValue={result.cubicFeet} controller={controller} />
          <ModuleResultRow label="Cubic yards" value={String(result.cubicYards)} />
          <ModuleResultRow
            label="Cubic yards (with waste)"
            value={String(result.cubicYardsWithWaste)}
            sendValue={result.cubicYardsWithWaste}
            controller={controller}
          />
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
