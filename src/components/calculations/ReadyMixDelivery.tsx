import React, { useMemo, useState } from 'react';
import { Truck, Clock, AlertTriangle } from 'lucide-react';
import Select from '../ui/Select';
import {
  READY_MIX_TRUCK_TYPES,
  calculateReadyMixDelivery,
  coldJointRiskClass,
  DEFAULT_TRUCK_CAPACITY_YD,
} from '../../utils/readyMixDelivery';
import { VolumeUnit } from '../../types';

interface ReadyMixDeliveryProps {
  volume: number;
  volumeUnit: VolumeUnit;
}

const ReadyMixDelivery: React.FC<ReadyMixDeliveryProps> = ({
  volume,
  volumeUnit,
}) => {
  const [truckTypeId, setTruckTypeId] = useState('standard_rear');

  const plan = useMemo(
    () => calculateReadyMixDelivery(volume, volumeUnit, truckTypeId),
    [volume, volumeUnit, truckTypeId]
  );

  const volumeLabel =
    volumeUnit === 'cubic_yards'
      ? 'yd³'
      : volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  return (
    <section aria-labelledby="delivery-planning-heading">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h4
          id="delivery-planning-heading"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          Delivery Planning
        </h4>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Plan truck loads using typical U.S. ready-mix capacities. Rule of thumb:{' '}
        <span className="font-medium text-gray-800 dark:text-gray-200">
          1 truck ≈ {DEFAULT_TRUCK_CAPACITY_YD} yd³
        </span>{' '}
        (always round up).
      </p>

      <Select
        label="Truck type"
        options={READY_MIX_TRUCK_TYPES.map((t) => ({
          value: t.id,
          label: `${t.name} (${t.capacityLabel})`,
        }))}
        value={truckTypeId}
        onChange={setTruckTypeId}
        fullWidth
      />

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-4">
        {plan.truckType.description}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-400">Pour volume</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {volume.toFixed(2)} {volumeLabel}
            <span className="block text-sm font-normal text-gray-600 dark:text-gray-400 mt-0.5">
              ({plan.volumeYd.toFixed(2)} yd³)
            </span>
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-400">Recommended trucks</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {plan.usesVariableCapacity
              ? 'Contact supplier'
              : plan.recommendedTrucks}
          </p>
          {!plan.usesVariableCapacity && plan.planningCapacityYd > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              ⌈{plan.volumeYd.toFixed(1)} ÷ {plan.planningCapacityYd}⌉ loads
            </p>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600 flex items-start gap-2">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-600 dark:text-gray-400">Est. discharge time</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {plan.usesVariableCapacity || plan.recommendedTrucks === 0
                ? '—'
                : `${plan.dischargeMinutesMin}–${plan.dischargeMinutesMax} min`}
            </p>
          </div>
        </div>

        <div
          className={`rounded-lg p-3 border flex items-start gap-2 ${coldJointRiskClass(plan.coldJointRisk)}`}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm opacity-90">Cold joint risk</p>
            <p className="font-semibold">{plan.coldJointRisk}</p>
          </div>
        </div>
      </div>

      <details className="mt-4 group">
        <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">›</span>
          Compare truck capacities
        </summary>
        <ul className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-400 pl-3">
          {READY_MIX_TRUCK_TYPES.map((t) => (
            <li
              key={t.id}
              className="flex justify-between gap-2 border-b border-gray-200 dark:border-gray-600 pb-1.5 last:border-0"
            >
              <span>{t.name}</span>
              <span className="font-medium text-gray-800 dark:text-gray-200 shrink-0">
                {t.capacityLabel}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2 pt-1">
            <span>Planning default</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              ~{DEFAULT_TRUCK_CAPACITY_YD} yd³ / truck
            </span>
          </li>
        </ul>
      </details>
    </section>
  );
};

export default ReadyMixDelivery;
