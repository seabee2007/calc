import React from 'react';
import { AlertTriangle, Clock, Truck } from 'lucide-react';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepPlacementProduction: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, production, deliveryPlan, truckCount, calculation, volume } =
    planner;

  const placementRate = parseFloat(form.placementRateYdPerHr) || 20;
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

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Crew & production rate
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Coordinate crew capacity with truck spacing to prevent onsite stacking and slump loss.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Crew size"
            type="number"
            min="0"
            value={form.crewSize}
            onChange={(e) => setField('crewSize', e.target.value)}
          />
          <Input
            label="Finishers"
            type="number"
            min="0"
            value={form.finishers}
            onChange={(e) => setField('finishers', e.target.value)}
          />
          <Input
            label="Vibrators"
            type="number"
            min="0"
            value={form.vibrators}
            onChange={(e) => setField('vibrators', e.target.value)}
          />
          <Input
            label="Placement rate (yd³/hr)"
            type="number"
            min="0"
            step="1"
            value={form.placementRateYdPerHr}
            onChange={(e) => setField('placementRateYdPerHr', e.target.value)}
          />
          <Input
            label="Discharge rate (yd³/hr)"
            type="number"
            min="0"
            step="1"
            value={form.dischargeRateYdPerHr}
            onChange={(e) => setField('dischargeRateYdPerHr', e.target.value)}
          />
          {form.placementMethod === 'pump' && (
            <Input
              label="Pump rate (yd³/hr)"
              type="number"
              min="0"
              value={form.pumpRate}
              onChange={(e) => setField('pumpRate', e.target.value)}
            />
          )}
          <Input
            label="Slab size / area"
            value={form.slabSize}
            onChange={(e) => setField('slabSize', e.target.value)}
            placeholder={
              calculation ? 'From project calculation' : 'e.g. 120 × 80 ft'
            }
            readOnly={Boolean(calculation && form.slabSize)}
            className="sm:col-span-2"
          />
          {calculation && form.slabSize && (
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Auto-filled from the linked concrete calculation.
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Placement duration</h4>
          </div>
          {volume > 0 ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {production.placementDurationHours.toFixed(1)} hr
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {deliveryPlan.volumeYd.toFixed(1)} yd³ ÷ {placementRate} yd³/hr
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
                  Load size:{' '}
                  <strong>{truckCapacity} yd³</strong>
                </span>
                <span className="block">
                  Arrival spacing:{' '}
                  <strong>{spacingMinutes} min</strong>
                  {form.truckSpacingMinutes ? '' : ' (recommended)'}
                </span>
                <span className="block">
                  Per-truck discharge:{' '}
                  <strong>{dischargeMinutes} min</strong>
                </span>
                <span className="block">
                  Pour window:{' '}
                  <strong>{Math.round(pourDurationMin)} min</strong>
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Spacing = {truckCapacity} yd³ ÷ {placementRate} yd³/hr
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
