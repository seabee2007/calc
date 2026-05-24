import React from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Checkbox from '../../ui/Checkbox';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { getCalculationPsi } from '../../../utils/calculationDimensions';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepMixSpec: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, calculation } = planner;
  const isPump = form.placementMethod === 'pump';
  const psiFromCalc = getCalculationPsi(calculation);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Mix design intent
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Document mix requirements from project specs. Slump must match mix design — do not
          add water beyond approved limits.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="PSI strength"
            options={[
              { value: '2500', label: '2500 PSI' },
              { value: '3000', label: '3000 PSI' },
              { value: '4000', label: '4000 PSI' },
              { value: '5000', label: '5000 PSI' },
            ]}
            value={form.psi}
            onChange={(v) => setField('psi', v)}
            disabled={Boolean(psiFromCalc)}
          />
          <Select
            label="Aggregate size"
            options={[
              { value: '3/8', label: '3/8 in' },
              { value: '1/2', label: '1/2 in' },
              { value: '3/4', label: '3/4 in' },
              { value: '1', label: '1 in' },
            ]}
            value={form.aggregateSize}
            onChange={(v) => setField('aggregateSize', v)}
          />
          {psiFromCalc && (
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
              PSI auto-filled from the linked concrete calculation ({psiFromCalc} PSI).
            </p>
          )}
          <Input
            label="Air entrainment %"
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={form.airEntrainment}
            onChange={(e) => setField('airEntrainment', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <Checkbox
            label="Water reducer"
            checked={form.waterReducer}
            onChange={(e) => setField('waterReducer', e.target.checked)}
          />
          <Checkbox
            label="Retarder"
            checked={form.retarder}
            onChange={(e) => setField('retarder', e.target.checked)}
          />
          <Checkbox
            label="Fiber"
            checked={form.fiber}
            onChange={(e) => setField('fiber', e.target.checked)}
          />
          <Checkbox
            label="Hot weather mix"
            checked={form.hotWeatherMix}
            onChange={(e) => setField('hotWeatherMix', e.target.checked)}
          />
          <Checkbox
            label="SCC / self-consolidating"
            checked={form.scc}
            onChange={(e) => setField('scc', e.target.checked)}
          />
        </div>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Slump requirements
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Specified slump (in)"
            type="number"
            min="0"
            step="0.5"
            value={form.specifiedSlump}
            onChange={(e) => setField('specifiedSlump', e.target.value)}
          />
          <Input
            label="Slump tolerance (± in)"
            type="number"
            min="0"
            step="0.5"
            value={form.slumpTolerance}
            onChange={(e) => setField('slumpTolerance', e.target.value)}
          />
          <Input
            label="Required at placement (in)"
            type="number"
            min="0"
            step="0.5"
            value={form.requiredSlumpAtPlacement}
            onChange={(e) => setField('requiredSlumpAtPlacement', e.target.value)}
          />
        </div>

        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
          Slump must match project specifications and mix design. Do not add water beyond
          approved limits. Use admixtures when needed.
        </p>
      </section>

      {isPump && (
        <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Pump truck slump check
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Pump placement detected. Recommended slump range: 4–6 in depending on mix design
            and aggregate size (ACPA guidance).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Pump line length (ft)"
              type="number"
              min="0"
              value={form.pumpLineLength}
              onChange={(e) => setField('pumpLineLength', e.target.value)}
            />
            <Input
              label="Vertical height (ft)"
              type="number"
              min="0"
              value={form.pumpVerticalHeight}
              onChange={(e) => setField('pumpVerticalHeight', e.target.value)}
            />
            <Input
              label="Hose diameter (in)"
              value={form.hoseDiameter}
              onChange={(e) => setField('hoseDiameter', e.target.value)}
            />
            <Input
              label="Slump at pump hopper (in)"
              type="number"
              min="0"
              step="0.5"
              value={form.requiredSlumpAtPump}
              onChange={(e) => setField('requiredSlumpAtPump', e.target.value)}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default StepMixSpec;
