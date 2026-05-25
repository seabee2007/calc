import React, { useEffect } from 'react';
import Input from '../../ui/Input';
import TimeField from '../../ui/TimeField';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepQcExport: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, deliveryPlan } = planner;

  useEffect(() => {
    if (deliveryPlan.volumeYd <= 0) return;
    const current = parseFloat(form.orderedYards);
    if (!Number.isFinite(current) || current <= 0) {
      setField('orderedYards', deliveryPlan.volumeYd.toFixed(2));
    }
  }, [deliveryPlan.volumeYd, form.orderedYards, setField]);

  useEffect(() => {
    if (!form.mixCode && form.psi) {
      const parts = [form.psi ? `${form.psi} PSI` : '', form.aggregateSize]
        .filter(Boolean)
        .join(' · ');
      if (parts) setField('mixCode', parts);
    }
  }, [form.psi, form.aggregateSize, form.mixCode, setField]);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Truck ticket & QC
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Record delivery ticket data and field QC for this load. Batch plant comes from Step 1.
        </p>

        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Ticket identification
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Input
            label="Ticket number"
            value={form.ticketNumber}
            onChange={(e) => setField('ticketNumber', e.target.value)}
          />
          <Input
            label="Truck number"
            value={form.truckNumber}
            onChange={(e) => setField('truckNumber', e.target.value)}
          />
          <Input
            label="Mix code"
            value={form.mixCode}
            onChange={(e) => setField('mixCode', e.target.value)}
            placeholder="e.g. 3000 PSI · 3/4 aggregate"
            className="sm:col-span-2"
          />
          <Input
            label="Batch plant"
            value={form.batchPlantAddress}
            readOnly
            helperText="Set in Step 1 — Project overview"
            className="sm:col-span-2"
          />
        </div>

        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Schedule
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <TimeField
            label="Batch time"
            value={form.batchTime}
            onChange={(v) => setField('batchTime', v)}
          />
          <TimeField
            label="Depart time"
            value={form.departTime}
            onChange={(v) => setField('departTime', v)}
          />
          <TimeField
            label="Arrival time"
            value={form.arrivalTime}
            onChange={(v) => setField('arrivalTime', v)}
          />
          <TimeField
            label="Discharge start"
            value={form.dischargeStart}
            onChange={(v) => setField('dischargeStart', v)}
          />
          <TimeField
            label="Discharge end"
            value={form.dischargeEnd}
            onChange={(v) => setField('dischargeEnd', v)}
          />
        </div>

        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Volume
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Input
            label="Ordered yards (yd³)"
            type="number"
            min="0"
            step="0.01"
            value={form.orderedYards}
            onChange={(e) => setField('orderedYards', e.target.value)}
            helperText={
              deliveryPlan.volumeYd > 0
                ? `From pour plan: ${deliveryPlan.volumeYd.toFixed(2)} yd³`
                : undefined
            }
          />
          <Input
            label="Delivered yards (yd³)"
            type="number"
            min="0"
            step="0.01"
            value={form.deliveredYards}
            onChange={(e) => setField('deliveredYards', e.target.value)}
          />
        </div>

        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Fresh concrete tests
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Input
            label="Slump (in)"
            type="number"
            step="0.5"
            value={form.slump}
            onChange={(e) => setField('slump', e.target.value)}
          />
          <Input
            label="Slump after adjustment (in)"
            type="number"
            step="0.5"
            value={form.slumpAfterAdjustment}
            onChange={(e) => setField('slumpAfterAdjustment', e.target.value)}
          />
          <Input
            label="Air content (%)"
            type="number"
            step="0.1"
            value={form.airContent}
            onChange={(e) => setField('airContent', e.target.value)}
          />
          <Input
            label="Concrete temp (°F)"
            type="number"
            value={form.concreteTemp}
            onChange={(e) => setField('concreteTemp', e.target.value)}
          />
          <Input
            label="Water added at plant (gal)"
            type="number"
            min="0"
            step="0.1"
            value={form.waterAddedPlant}
            onChange={(e) => setField('waterAddedPlant', e.target.value)}
          />
          <Input
            label="Water added on site (gal)"
            type="number"
            min="0"
            step="0.1"
            value={form.waterAddedSite}
            onChange={(e) => setField('waterAddedSite', e.target.value)}
          />
          <Input
            label="Drum revolutions"
            type="number"
            min="0"
            step="1"
            value={form.drumRevolutions}
            onChange={(e) => setField('drumRevolutions', e.target.value)}
          />
        </div>

        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Additional QC
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Admixture added on site"
            value={form.admixtureAddedOnSite}
            onChange={(e) => setField('admixtureAddedOnSite', e.target.value)}
          />
          <Input
            label="Inspector / QC initials"
            value={form.inspectorInitials}
            onChange={(e) => setField('inspectorInitials', e.target.value)}
          />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ticketAccepted}
              onChange={(e) => setField('ticketAccepted', e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Ticket accepted — load approved for placement
          </label>
        </div>
      </section>
    </div>
  );
};

export default StepQcExport;
