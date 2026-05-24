import React from 'react';
import { Clock, Truck } from 'lucide-react';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepPlacementProduction: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, production, deliveryPlan } = planner;
  const spacing =
    form.truckSpacingMinutes || String(Math.round(production.truckSpacingMinutes));

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
            placeholder="e.g. 120 × 80 ft"
            className="sm:col-span-2"
          />
          <Input
            label="Placement sequence"
            value={form.placementSequence}
            onChange={(e) => setField('placementSequence', e.target.value)}
            placeholder="e.g. North end first, work south"
            className="sm:col-span-2"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold">Placement duration</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {production.placementDurationHours > 0
              ? `${production.placementDurationHours.toFixed(1)} hr`
              : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {deliveryPlan.volumeYd.toFixed(1)} yd³ ÷ {form.placementRateYdPerHr || '20'} yd³/hr
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold">Truck schedule</h4>
          </div>
          <p className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <span className="block">
              Recommended spacing:{' '}
              <strong>{spacing} min</strong>
            </span>
            <span className="block">
              Per-truck discharge:{' '}
              <strong>{Math.round(production.truckDischargeMinutes)} min</strong>
            </span>
            <span className="block">
              Trucks needed:{' '}
              <strong>{production.recommendedTrucks || '—'}</strong>
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Spacing = truck load ÷ placement rate
          </p>
        </Card>
      </section>
    </div>
  );
};

export default StepPlacementProduction;
