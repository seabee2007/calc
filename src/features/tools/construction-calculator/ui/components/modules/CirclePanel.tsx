import React, { useMemo, useState } from 'react';
import { calculateCircle } from '../../../domain/modules/circleModule';
import { calculateCostPerUnit } from '../../../domain/modules/costPerUnit';
import {
  CostFields,
  ModuleNumberField,
  ModuleResultRow,
  parseInches,
} from './modulePanelShared';

export default function CirclePanel() {
  const [diameter, setDiameter] = useState('12');
  const [height, setHeight] = useState('');
  const [coneHeight, setConeHeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const result = useMemo(
    () =>
      calculateCircle({
        diameterInches: parseInches(diameter),
        heightInches: height ? parseInches(height) : undefined,
        coneHeightInches: coneHeight ? parseInches(coneHeight) : undefined,
      }),
    [diameter, height, coneHeight],
  );

  const cost = useMemo(() => {
    const q = parseFloat(quantity) || result.areaSqFt;
    const uc = parseFloat(unitCost) || 0;
    return calculateCostPerUnit({ quantity: q, unitCost: uc });
  }, [quantity, unitCost, result.areaSqFt]);

  return (
    <div className="space-y-4" data-testid="circle-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Diameter" value={diameter} onChange={setDiameter} unit="in" />
        <ModuleNumberField label="Cylinder height" value={height} onChange={setHeight} unit="in" />
        <ModuleNumberField label="Cone height" value={coneHeight} onChange={setConeHeight} unit="in" />
      </div>
      <ModuleResultRow label="Radius" value={`${result.radiusInches} in`} />
      <ModuleResultRow label="Area" value={`${result.areaSqFt} sq ft`} />
      <ModuleResultRow label="Circumference" value={`${result.circumferenceInches} in`} />
      {result.cylinderVolumeCuFt !== undefined && (
        <ModuleResultRow label="Cylinder volume" value={`${result.cylinderVolumeCuFt} cu ft`} />
      )}
      {result.coneVolumeCuFt !== undefined && (
        <ModuleResultRow label="Cone volume" value={`${result.coneVolumeCuFt} cu ft`} />
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
