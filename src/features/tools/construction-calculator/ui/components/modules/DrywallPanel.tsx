import React, { useMemo, useState } from 'react';
import { calculateDrywall } from '../../../domain/modules/drywallModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import NumberSlot from '../slots/NumberSlot';
import { CostFields, ModuleResultRow } from './modulePanelShared';

interface DrywallPanelProps {
  controller: CalculatorInputController;
}

export default function DrywallPanel({ controller }: DrywallPanelProps) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const wallLength = controller.getSlotValue('drywall', 'wallLength');
  const wallHeight = controller.getSlotValue('drywall', 'wallHeight');
  const sheetWidth = controller.getSlotValue('drywall', 'sheetWidth');
  const sheetHeight = controller.getSlotValue('drywall', 'sheetHeight');
  const wastePercent = controller.getSlotValue('drywall', 'wastePercent');

  const result = useMemo(() => {
    if (wallLength === null || wallHeight === null || sheetWidth === null || sheetHeight === null) {
      return null;
    }
    return calculateDrywall({
      wallLengthInches: wallLength,
      wallHeightInches: wallHeight,
      sheetWidthInches: sheetWidth,
      sheetHeightInches: sheetHeight,
      wastePercent: wastePercent ?? 10,
    });
  }, [wallLength, wallHeight, sheetWidth, sheetHeight, wastePercent]);

  const cost = useMemo(() => {
    if (!result) return { totalCost: 0 };
    const q = parseFloat(quantity) || result.sheetCountWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result]);

  return (
    <div className="space-y-4" data-testid="drywall-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot moduleId="drywall" slotId="wallLength" label="DRYWALL · WALL LENGTH" controller={controller} />
        <DimensionSlot moduleId="drywall" slotId="wallHeight" label="DRYWALL · WALL HEIGHT" controller={controller} />
        <DimensionSlot moduleId="drywall" slotId="sheetWidth" label="DRYWALL · SHEET WIDTH" controller={controller} />
        <DimensionSlot moduleId="drywall" slotId="sheetHeight" label="DRYWALL · SHEET HEIGHT" controller={controller} />
        <NumberSlot moduleId="drywall" slotId="wastePercent" label="DRYWALL · WASTE %" controller={controller} unit="%" />
      </div>
      {result && (
        <>
          <ModuleResultRow label="Wall area (sq ft)" value={String(result.wallAreaSqFt)} />
          <ModuleResultRow label="Sheets needed" value={String(result.sheetCount)} sendValue={result.sheetCount} controller={controller} />
          <ModuleResultRow label="Sheets (with waste)" value={String(result.sheetCountWithWaste)} sendValue={result.sheetCountWithWaste} controller={controller} />
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
