import React, { useEffect } from 'react';
import { DollarSign, Save, Users } from 'lucide-react';
import type { Calculation } from '../../types';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useLaborCalculatorState } from '../../hooks/useLaborCalculatorState';
import type { LaborEstimate } from '../../types/laborEstimate';
import LaborRatesItemized from '../labor/LaborRatesItemized';
import LaborCostBreakdownSummary from '../labor/LaborCostBreakdownSummary';

interface LaborCalculatorPanelProps {
  calculation?: Calculation;
  savedEstimate?: LaborEstimate;
  onSave: (payload: ReturnType<
    ReturnType<typeof useLaborCalculatorState>['buildSavePayload']
  >) => Promise<void>;
  saveDisabled?: boolean;
}

const LaborCalculatorPanel: React.FC<LaborCalculatorPanelProps> = ({
  calculation,
  savedEstimate,
  onSave,
  saveDisabled,
}) => {
  const {
    inputs,
    setField,
    setInputs,
    volumeYd,
    placementRateEstimate: est,
    applyFromCalculation,
    buildSavePayload,
    preferences,
  } = useLaborCalculatorState(calculation);

  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  useEffect(() => {
    if (calculation) applyFromCalculation(calculation);
  }, [calculation?.id, applyFromCalculation]);

  useEffect(() => {
    if (savedEstimate?.inputs) {
      const { burdenedHourlyRate: _removed, ...rest } = savedEstimate.inputs as LaborEstimate['inputs'] & {
        burdenedHourlyRate?: string;
      };
      setInputs((prev) => ({ ...prev, ...rest }));
    }
  }, [savedEstimate?.id, setInputs]);

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const crew = parseInt(inputs.crewSize, 10) || 0;
  const finishers = parseInt(inputs.finishers, 10) || 0;
  const laborers = Math.max(0, crew - finishers);
  const breakdown = est.laborCostBreakdown;

  return (
    <div className="space-y-6">
      <LaborRatesItemized />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-600" />
          Crew & production
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Labor cost is itemized by trade (laborer, finisher, foreman). Crew size affects
          mobilization man-hours and foreman time on site.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label={`Pour volume (${volumeLabel})`}
            type="number"
            min="0"
            step="0.1"
            value={inputs.manualVolume}
            onChange={(e) => setField('manualVolume', e.target.value)}
            helperText={
              calculation
                ? `From concrete calc: ${calculation.result.volume.toFixed(2)} ${volumeLabel}`
                : undefined
            }
          />
          <Input
            label="Slab / area (optional)"
            value={inputs.slabSize}
            onChange={(e) => setField('slabSize', e.target.value)}
            placeholder="e.g. 40 × 60 ft"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Input
            label="Crew size"
            type="number"
            min="1"
            value={inputs.crewSize}
            onChange={(e) => setField('crewSize', e.target.value)}
          />
          <Input
            label="Finishers"
            type="number"
            min="0"
            value={inputs.finishers}
            onChange={(e) => setField('finishers', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Input
            label="Setup hours"
            type="number"
            min="0"
            step="0.5"
            value={inputs.setupHours}
            onChange={(e) => setField('setupHours', e.target.value)}
          />
          <Input
            label="Cleanup hours"
            type="number"
            min="0"
            step="0.5"
            value={inputs.cleanupHours}
            onChange={(e) => setField('cleanupHours', e.target.value)}
          />
        </div>
      </Card>

      {volumeYd > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Labor estimate
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              Worker-hours: <strong>{est.totalManHours.toFixed(1)}</strong>
            </p>
            <p>
              Crew duration: <strong>{est.estimatedCrewDurationHours.toFixed(1)} hrs</strong>
            </p>
            {breakdown && (
              <LaborCostBreakdownSummary
                breakdown={breakdown}
                formatCurrency={formatCurrency}
                laborers={laborers}
                finishers={finishers}
              />
            )}
            {est.laborCost != null && (
              <p className="sm:col-span-2 flex items-center gap-1.5 text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                <DollarSign className="h-4 w-4 text-green-600" />
                Total labor:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {formatCurrency(est.laborCost)}
                </strong>
              </p>
            )}
          </div>

          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            icon={<Save size={18} />}
            disabled={saveDisabled || est.laborCost == null || est.laborCost <= 0}
            onClick={() => void onSave(buildSavePayload())}
          >
            Save labor estimate to project
          </Button>
        </Card>
      )}

      {volumeYd <= 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Enter volume or save a concrete calculation first to estimate labor cost.
        </p>
      )}
    </div>
  );
};

export default LaborCalculatorPanel;
