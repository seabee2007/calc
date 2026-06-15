import React, { useMemo, useState } from 'react';
import { calculateVolume } from '../../../domain/modules/volumeModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface VolumePanelProps {
  controller: CalculatorInputController;
}

export default function VolumePanel({ controller }: VolumePanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const length = controller.getSlotValue('volume', 'length');
  const width = controller.getSlotValue('volume', 'width');
  const height = controller.getSlotValue('volume', 'height');

  const result = useMemo(() => {
    if (length === null || width === null || height === null) return null;
    return calculateVolume({ lengthInches: length, widthInches: width, heightInches: height });
  }, [length, width, height]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.cubicYards;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="volume-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <DimensionSlot moduleId="volume" slotId="length" label="VOLUME · LENGTH" controller={controller} />
        <DimensionSlot moduleId="volume" slotId="width" label="VOLUME · WIDTH" controller={controller} />
        <DimensionSlot moduleId="volume" slotId="height" label="VOLUME · HEIGHT" controller={controller} />
      </div>
      {result && (
        <>
          <ModuleResultRow
            label="Volume (cu ft)"
            value={String(result.cubicFeet)}
            sendValue={result.cubicFeet}
            controller={controller}
          />
          <ModuleResultRow label="Volume (cu yd)" value={String(result.cubicYards)} />
          <ModuleResultRow label="Volume (cu m)" value={String(result.cubicMeters)} />
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
