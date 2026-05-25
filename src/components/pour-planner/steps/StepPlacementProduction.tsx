import React from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  RotateCcw,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Select from '../../ui/Select';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import { BOTTLENECK_LABELS } from '../../../utils/placementProduction';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepPlacementProduction: React.FC<StepProps> = ({ planner }) => {
  const {
    form,
    setField,
    production,
    deliveryPlan,
    truckCount,
    calculation,
    volume,
    placementRateEstimate: est,
    effectivePlacementRateYdPerHr,
  } = planner;

  const placementRate = effectivePlacementRateYdPerHr;
  const truckCapacity =
    parseFloat(form.truckCapacityYd) || deliveryPlan.planningCapacityYd;
  const spacingMinutes = Math.round(
    parseFloat(form.truckSpacingMinutes) || production.truckSpacingMinutes,
  );
  const dischargeMinutes = Math.round(production.truckDischargeMinutes);
  const trucksScheduled = truckCount || production.recommendedTrucks;
  const spacingTooTight =
    spacingMinutes > 0 &&
    dischargeMinutes > 0 &&
    spacingMinutes < dischargeMinutes;
  const lastTruckArrivalMin =
    trucksScheduled > 1 ? (trucksScheduled - 1) * spacingMinutes : 0;
  const pourDurationMin = production.placementDurationHours * 60;

  const crewSize = parseInt(form.crewSize, 10) || 0;
  const thicknessIn =
    est.slabThicknessFt != null
      ? (est.slabThicknessFt * 12).toFixed(1)
      : form.slabThicknessIn;

  const displayRate = form.placementRateManualOverride
    ? form.placementRateYdPerHr
    : String(est.effectiveRateYdPerHr);

  const handleRateChange = (value: string) => {
    setField('placementRateManualOverride', true);
    setField('placementRateYdPerHr', value);
  };

  const handleResetRate = () => {
    setField('placementRateManualOverride', false);
    setField('placementRateYdPerHr', String(est.effectiveRateYdPerHr));
  };

  const clearManualOverride = () => {
    if (form.placementRateManualOverride) {
      setField('placementRateManualOverride', false);
    }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Crew & production planning
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Placement rate uses the slowest bottleneck — placement crew vs finishing crew — then
          applies efficiency, access, weather, and complexity modifiers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Crew size (total)"
            type="number"
            min="0"
            value={form.crewSize}
            onChange={(e) => {
              setField('crewSize', e.target.value);
              clearManualOverride();
            }}
            helperText={`${est.laborers} laborer${est.laborers !== 1 ? 's' : ''} placing · ${est.finishers} finishing`}
          />
          <Input
            label="Finishers"
            type="number"
            min="0"
            value={form.finishers}
            onChange={(e) => {
              setField('finishers', e.target.value);
              clearManualOverride();
            }}
          />
          <Input
            label="Vibrators"
            type="number"
            min="0"
            value={form.vibrators}
            onChange={(e) => setField('vibrators', e.target.value)}
          />
          <Input
            label="Laborer rate (CY/hr each)"
            type="number"
            min="0"
            step="0.5"
            value={form.laborerRateCYHr}
            onChange={(e) => {
              setField('laborerRateCYHr', e.target.value);
              clearManualOverride();
            }}
          />
          <Input
            label="Finisher rate (SF/hr each)"
            type="number"
            min="0"
            step="10"
            value={form.finisherRateSFHr}
            onChange={(e) => {
              setField('finisherRateSFHr', e.target.value);
              clearManualOverride();
            }}
          />
          {!calculation && (
            <Input
              label="Slab thickness (in)"
              type="number"
              min="0"
              step="0.5"
              value={form.slabThicknessIn}
              onChange={(e) => {
                setField('slabThicknessIn', e.target.value);
                clearManualOverride();
              }}
              helperText="Used to convert finisher SF/hr → CY/hr"
            />
          )}
          <Input
            label="Slab size / area"
            value={form.slabSize}
            onChange={(e) => setField('slabSize', e.target.value)}
            placeholder={
              calculation ? 'From project calculation' : 'e.g. 120 × 80 ft (6 in thick)'
            }
            readOnly={Boolean(calculation && form.slabSize)}
            className="sm:col-span-2"
          />
          {calculation && form.slabSize && (
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Auto-filled from linked calculation
              {est.slabAreaSqFt != null &&
                ` · ${Math.round(est.slabAreaSqFt).toLocaleString()} ft²`}
              {thicknessIn && ` · ${thicknessIn} in thick`}.
            </p>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Production modifiers
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Crew efficiency"
            value={form.crewEfficiency}
            onChange={(v) => {
              setField('crewEfficiency', v as typeof form.crewEfficiency);
              clearManualOverride();
            }}
            options={[
              { value: 'excellent', label: 'Excellent crew (100%)' },
              { value: 'average', label: 'Average crew (85%)' },
              { value: 'new', label: 'New / inexperienced (70%)' },
            ]}
          />
          <Select
            label="Complexity"
            value={form.complexityFactor}
            onChange={(v) => {
              setField('complexityFactor', v as typeof form.complexityFactor);
              clearManualOverride();
            }}
            options={[
              { value: 'auto', label: 'Auto from calc type' },
              { value: 'open_slab', label: 'Open slab (100%)' },
              { value: 'heavy_rebar', label: 'Heavy rebar (85%)' },
              { value: 'curbs_edges', label: 'Curbs / edges (75%)' },
              { value: 'tight_access', label: 'Tight access (70%)' },
            ]}
          />
          <Select
            label="Access factor"
            value={form.accessFactorMode}
            onChange={(v) => {
              setField('accessFactorMode', v as typeof form.accessFactorMode);
              clearManualOverride();
            }}
            options={[
              { value: 'auto', label: 'Auto from placement method' },
              { value: 'chute', label: 'Direct chute (100%)' },
              { value: 'pump', label: 'Pump truck (90%)' },
              { value: 'conveyor', label: 'Conveyor (85%)' },
              { value: 'buggy', label: 'Buggy (75%)' },
              { value: 'wheelbarrow', label: 'Wheelbarrow (50%)' },
            ]}
          />
          <Select
            label="Weather factor"
            value={form.weatherFactorMode}
            onChange={(v) => {
              setField('weatherFactorMode', v as typeof form.weatherFactorMode);
              clearManualOverride();
            }}
            options={[
              { value: 'auto', label: 'Auto from weather step' },
              { value: 'normal', label: 'Normal (100%)' },
              { value: 'hot', label: 'Hot weather (90%)' },
              { value: 'cold', label: 'Cold weather (85%)' },
              { value: 'rain', label: 'Rain risk (80%)' },
            ]}
          />
          {form.placementMethod === 'pump' && (
            <Input
              label="Pump rate (CY/hr)"
              type="number"
              min="0"
              value={form.pumpRate}
              onChange={(e) => {
                setField('pumpRate', e.target.value);
                clearManualOverride();
              }}
            />
          )}
          <Input
            label="Adjusted placement rate (CY/hr)"
            type="number"
            min="0"
            step="0.5"
            value={displayRate}
            onChange={(e) => handleRateChange(e.target.value)}
            helperText={
              form.placementRateManualOverride
                ? 'Manual override — reset to use calculated rate'
                : `Calculated: ${est.adjustedRateCYHr} CY/hr`
            }
          />
          <Input
            label="Discharge rate (CY/hr)"
            type="number"
            min="0"
            step="1"
            value={form.dischargeRateYdPerHr}
            onChange={(e) => setField('dischargeRateYdPerHr', e.target.value)}
          />
        </div>
      </section>

      <Card className="p-4 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Crew bottleneck analysis
          </h4>
          {form.placementRateManualOverride && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={handleResetRate}
            >
              Use calculated
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Placement crew
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {est.placementCrewRateCYHr} CY/hr
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {est.laborers} × {form.laborerRateCYHr} CY/hr
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Finishing crew
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {est.finishingRateCYHr} CY/hr
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {est.finishers} × {form.finisherRateSFHr} SF/hr → CY/hr
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Adjusted rate
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {est.adjustedRateCYHr} CY/hr
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Limited by {BOTTLENECK_LABELS[est.limitingFactor].toLowerCase()}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">{est.summary}</p>
        {est.bottleneckRecommendation && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-blue-800 dark:text-blue-200 bg-blue-100/60 dark:bg-blue-900/40 rounded-md px-3 py-2">
            <Users className="h-4 w-4 shrink-0 mt-0.5" />
            {est.bottleneckRecommendation}
          </p>
        )}
      </Card>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Labor-hour estimate (RSMeans-style)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label="Placing productivity (CY/labor-hr)"
            type="number"
            min="0"
            step="0.1"
            value={form.placingProductivityCYPerLaborHour}
            onChange={(e) => setField('placingProductivityCYPerLaborHour', e.target.value)}
          />
          <Input
            label="Finishing productivity (SF/labor-hr)"
            type="number"
            min="0"
            step="10"
            value={form.finishingProductivitySFPerLaborHour}
            onChange={(e) => setField('finishingProductivitySFPerLaborHour', e.target.value)}
          />
          <Input
            label="Setup hours"
            type="number"
            min="0"
            step="0.5"
            value={form.setupHours}
            onChange={(e) => setField('setupHours', e.target.value)}
          />
          <Input
            label="Cleanup hours"
            type="number"
            min="0"
            step="0.5"
            value={form.cleanupHours}
            onChange={(e) => setField('cleanupHours', e.target.value)}
          />
          <Input
            label="Burdened hourly labor rate ($)"
            type="number"
            min="0"
            step="1"
            value={form.burdenedHourlyRate}
            onChange={(e) => setField('burdenedHourlyRate', e.target.value)}
            className="sm:col-span-2"
          />
        </div>

        {volume > 0 ? (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>
                Estimated placing labor:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {est.placingLaborHours.toFixed(1)} labor-hrs
                </strong>
              </p>
              <p>
                Estimated finishing labor:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {est.finishingLaborHours.toFixed(1)} labor-hrs
                </strong>
              </p>
              <p>
                Setup / cleanup:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {est.setupCleanupHours.toFixed(1)} labor-hrs
                </strong>
              </p>
              <p>
                Adjusted total:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {est.adjustedLaborHours.toFixed(1)} labor-hrs
                </strong>
              </p>
              <p>
                Crew size:{' '}
                <strong className="text-gray-900 dark:text-white">{crewSize || '—'}</strong>
              </p>
              <p>
                Estimated crew duration:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {est.estimatedCrewDurationHours.toFixed(1)} hours
                </strong>
              </p>
              {est.laborCost != null && (
                <p className="sm:col-span-2 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Labor cost:{' '}
                  <strong className="text-gray-900 dark:text-white text-base">
                    {formatCurrency(est.laborCost)}
                  </strong>
                </p>
              )}
            </div>
          </Card>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Link a calculation or enter volume in step 1 for labor-hour estimates.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Pour duration</h4>
          </div>
          {volume > 0 ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {production.placementDurationHours.toFixed(1)} hr
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {deliveryPlan.volumeYd.toFixed(1)} yd³ ÷ {placementRate} CY/hr
              </p>
              {trucksScheduled > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Last truck arrives ~{lastTruckArrivalMin} min after first load
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a calculation or enter volume in step 1 to estimate pour duration.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Truck schedule</h4>
          </div>
          {volume > 0 && trucksScheduled > 0 ? (
            <>
              <p className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <span className="block">
                  Trucks scheduled:{' '}
                  <strong>{trucksScheduled}</strong>
                  {form.numberOfTrucks ? '' : ' (recommended)'}
                </span>
                <span className="block">
                  Load size: <strong>{truckCapacity} yd³</strong>
                </span>
                <span className="block">
                  Arrival spacing: <strong>{spacingMinutes} min</strong>
                  {form.truckSpacingMinutes ? '' : ' (recommended)'}
                </span>
                <span className="block">
                  Per-truck discharge: <strong>{dischargeMinutes} min</strong>
                </span>
                <span className="block">
                  Pour window: <strong>{Math.round(pourDurationMin)} min</strong>
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Spacing = {truckCapacity} yd³ ÷ {placementRate} CY/hr
              </p>
              {spacingTooTight && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Spacing is shorter than discharge time — trucks may stack onsite.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter volume and truck details in steps 1–3 to build a schedule.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
};

export default StepPlacementProduction;
