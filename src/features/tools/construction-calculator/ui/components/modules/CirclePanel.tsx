import React, { useMemo, useState } from 'react';
import { calculateCircle } from '../../../domain/modules/circleModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import { buildDimensionFromDecimal } from '../../../domain/constructionCalculatorFormatters';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface CirclePanelProps {
  controller: CalculatorInputController;
}

export default function CirclePanel({ controller }: CirclePanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const diameter = controller.getSlotValue('circle', 'diameter');
  const cylinderHeight = controller.getSlotValue('circle', 'cylinderHeight');
  const coneHeight = controller.getSlotValue('circle', 'coneHeight');

  const result = useMemo(() => {
    if (diameter === null) return null;
    return calculateCircle({
      diameterInches: diameter,
      heightInches: cylinderHeight ?? undefined,
      coneHeightInches: coneHeight ?? undefined,
    });
  }, [diameter, cylinderHeight, coneHeight]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.areaSqFt;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="circle-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot moduleId="circle" slotId="diameter" label="CIRCLE · DIAMETER" controller={controller} />
        <DimensionSlot moduleId="circle" slotId="cylinderHeight" label="CIRCLE · CYLINDER HEIGHT" controller={controller} />
        <DimensionSlot moduleId="circle" slotId="coneHeight" label="CIRCLE · CONE HEIGHT" controller={controller} />
      </div>
      {result && (
        <>
          <ModuleResultRow label="Radius" value={`${result.radiusInches} in`} />
          <ModuleResultRow
            label="Area"
            value={`${result.areaSqFt} sq ft`}
            sendValue={result.areaSqFt}
            controller={controller}
          />
          <ModuleResultRow
            label="Circumference"
            value={`${result.circumferenceInches} in`}
            sendValue={buildDimensionFromDecimal(result.circumferenceInches)}
            controller={controller}
          />
          {result.cylinderVolumeCuFt !== undefined && (
            <ModuleResultRow label="Cylinder volume" value={`${result.cylinderVolumeCuFt} cu ft`} sendValue={result.cylinderVolumeCuFt} controller={controller} />
          )}
          {result.coneVolumeCuFt !== undefined && (
            <ModuleResultRow label="Cone volume" value={`${result.coneVolumeCuFt} cu ft`} sendValue={result.coneVolumeCuFt} controller={controller} />
          )}
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
