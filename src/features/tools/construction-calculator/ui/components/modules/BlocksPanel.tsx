import React, { useMemo, useState } from 'react';
import { calculateBlocks } from '../../../domain/modules/blocksModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
  parseInches,
} from './modulePanelShared';

export default function BlocksPanel() {
  const [wallLengthFt, setWallLengthFt] = useState('20');
  const [wallHeightFt, setWallHeightFt] = useState('8');
  const [blockLengthIn, setBlockLengthIn] = useState('16');
  const [blockHeightIn, setBlockHeightIn] = useState('8');
  const [waste, setWaste] = useState('5');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateBlocks({
        wallLengthInches: parseFeet(wallLengthFt),
        wallHeightInches: parseFeet(wallHeightFt),
        blockLengthInches: parseInches(blockLengthIn),
        blockHeightInches: parseInches(blockHeightIn),
        wastePercent: parseFloat(waste) || 0,
      }),
    [wallLengthFt, wallHeightFt, blockLengthIn, blockHeightIn, waste],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.blockCountWithWaste;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.blockCountWithWaste]);

  return (
    <div className="space-y-4" data-testid="blocks-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Wall length" value={wallLengthFt} onChange={setWallLengthFt} unit="ft" />
        <ModuleNumberField label="Wall height" value={wallHeightFt} onChange={setWallHeightFt} unit="ft" />
        <ModuleNumberField label="Block length" value={blockLengthIn} onChange={setBlockLengthIn} unit="in" />
        <ModuleNumberField label="Block height" value={blockHeightIn} onChange={setBlockHeightIn} unit="in" />
        <ModuleNumberField label="Waste %" value={waste} onChange={setWaste} unit="%" />
      </div>
      <ModuleResultRow label="Wall area (sq ft)" value={String(result.wallAreaSqFt)} />
      <ModuleResultRow label="Blocks needed" value={String(result.blockCount)} />
      <ModuleResultRow label="Blocks (with waste)" value={String(result.blockCountWithWaste)} />
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
