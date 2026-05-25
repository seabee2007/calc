import React, { useEffect } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import Card from '../ui/Card';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import { PLACEMENT_AREA_OPTIONS } from '../../types/callSheet';
import { placementAreaFromCalculationType } from '../../types/callSheet';
import type { PlacementAreaType } from '../../types/callSheet';

interface CallSheetDetailsFormProps {
  planner: PourPlannerContext;
}

const CallSheetDetailsForm: React.FC<CallSheetDetailsFormProps> = ({ planner }) => {
  const { form, setField, calculation } = planner;

  useEffect(() => {
    if (!calculation || form.placementAreaType) return;
    const inferred = placementAreaFromCalculationType(calculation.type);
    if (inferred) setField('placementAreaType', inferred);
  }, [calculation?.type, form.placementAreaType, setField, calculation]);

  useEffect(() => {
    if (form.specificPlacementArea.trim() || !form.slabSize.trim()) return;
    setField('specificPlacementArea', form.slabSize);
  }, [form.slabSize, form.specificPlacementArea, setField]);

  return (
    <Card className="p-4 space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Call sheet details
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Fill dispatch fields below. Planner steps auto-fill mix, quantity, and weather where
          possible.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Project information
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Project number"
            value={form.projectNumber}
            onChange={(e) => setField('projectNumber', e.target.value)}
          />
          <Input
            label="Contractor"
            value={form.contractor}
            onChange={(e) => setField('contractor', e.target.value)}
          />
          <Input
            label="Superintendent"
            value={form.superintendent}
            onChange={(e) => setField('superintendent', e.target.value)}
          />
          <Input
            label="Point of contact"
            value={form.pointOfContact}
            onChange={(e) => setField('pointOfContact', e.target.value)}
          />
          <Input
            label="POC phone"
            type="tel"
            value={form.pointOfContactPhone}
            onChange={(e) => setField('pointOfContactPhone', e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Placement location
        </legend>
        <Select
          label="Placement area type"
          options={PLACEMENT_AREA_OPTIONS}
          value={form.placementAreaType}
          onChange={(v) => setField('placementAreaType', v as PlacementAreaType)}
        />
        <Input
          label="Specific placement area"
          value={form.specificPlacementArea}
          onChange={(e) => setField('specificPlacementArea', e.target.value)}
          placeholder="e.g. Vehicle pad north, Building 4 footing grid A"
        />
        <Input
          label="Access instructions"
          value={form.accessInstructions}
          onChange={(e) => setField('accessInstructions', e.target.value)}
          placeholder="Convoy gate, haul road, one-way entry"
        />
        <Input
          label="Gate codes / escorts required"
          value={form.gateCodesEscorts}
          onChange={(e) => setField('gateCodesEscorts', e.target.value)}
        />
        <Input
          label="Washout location"
          value={form.washoutLocation}
          onChange={(e) => setField('washoutLocation', e.target.value)}
          placeholder="Designated pit only — not on pavement"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Mix (call sheet extras)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Mix design number"
            value={form.mixDesignNumber}
            onChange={(e) => setField('mixDesignNumber', e.target.value)}
          />
          <Input
            label="Water-cement ratio"
            value={form.waterCementRatio}
            onChange={(e) => setField('waterCementRatio', e.target.value)}
            placeholder="e.g. 0.45"
          />
          <Input
            label="Color additive"
            value={form.colorAdditive}
            onChange={(e) => setField('colorAdditive', e.target.value)}
            className="sm:col-span-2"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox
            label="Superplasticizer"
            checked={form.superplasticizer}
            onChange={(e) => setField('superplasticizer', e.target.checked)}
          />
          <Checkbox
            label="Accelerator"
            checked={form.accelerator}
            onChange={(e) => setField('accelerator', e.target.checked)}
          />
        </div>
        {form.placementMethod === 'pump' && (
          <Input
            label="Pump company"
            value={form.pumpCompany}
            onChange={(e) => setField('pumpCompany', e.target.value)}
            placeholder="e.g. 42m boom — ABC Pumping"
          />
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          QC requirements
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Checkbox
            label="Third-party testing"
            checked={form.qcThirdPartyTesting}
            onChange={(e) => setField('qcThirdPartyTesting', e.target.checked)}
          />
          <Checkbox
            label="Slump test each truck"
            checked={form.qcSlumpTestsRequired}
            onChange={(e) => setField('qcSlumpTestsRequired', e.target.checked)}
          />
          <Checkbox
            label="Cylinders required"
            checked={form.qcCylindersRequired}
            onChange={(e) => setField('qcCylindersRequired', e.target.checked)}
          />
          <Checkbox
            label="7-day break"
            checked={form.qcBreak7Day}
            onChange={(e) => setField('qcBreak7Day', e.target.checked)}
          />
          <Checkbox
            label="28-day break"
            checked={form.qcBreak28Day}
            onChange={(e) => setField('qcBreak28Day', e.target.checked)}
          />
          <Checkbox
            label="Special inspection"
            checked={form.qcSpecialInspection}
            onChange={(e) => setField('qcSpecialInspection', e.target.checked)}
          />
        </div>
        <Input
          label="ACI / NAVFAC requirements"
          value={form.qcAciNavfac}
          onChange={(e) => setField('qcAciNavfac', e.target.value)}
          placeholder="e.g. NAVFAC slump each truck, cylinders every 50 CY"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Safety / site conditions
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Checkbox
            label="PPE requirements"
            checked={form.safetyPpe}
            onChange={(e) => setField('safetyPpe', e.target.checked)}
          />
          <Checkbox
            label="Traffic control"
            checked={form.safetyTrafficControl}
            onChange={(e) => setField('safetyTrafficControl', e.target.checked)}
          />
          <Checkbox
            label="Spotter required"
            checked={form.safetySpotter}
            onChange={(e) => setField('safetySpotter', e.target.checked)}
          />
          <Checkbox
            label="Powerline hazards"
            checked={form.safetyPowerlines}
            onChange={(e) => setField('safetyPowerlines', e.target.checked)}
          />
          <Checkbox
            label="Limited access"
            checked={form.safetyLimitedAccess}
            onChange={(e) => setField('safetyLimitedAccess', e.target.checked)}
          />
          <Checkbox
            label="Crane nearby"
            checked={form.safetyCraneNearby}
            onChange={(e) => setField('safetyCraneNearby', e.target.checked)}
          />
          <Checkbox
            label="Uneven terrain"
            checked={form.safetyUnevenTerrain}
            onChange={(e) => setField('safetyUnevenTerrain', e.target.checked)}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Call plant ___ min before first truck"
          type="number"
          min="0"
          value={form.callBeforeFirstTruck}
          onChange={(e) => setField('callBeforeFirstTruck', e.target.value)}
        />
      </div>
    </Card>
  );
};

export default CallSheetDetailsForm;
