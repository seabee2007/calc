import React from 'react';
import Input from '../ui/Input';
import TimeField from '../ui/TimeField';
import type { TruckTicketFormState } from '../../types/concreteTruckTicket';

interface TruckTicketFormProps {
  form: TruckTicketFormState;
  onChange: <K extends keyof TruckTicketFormState>(
    key: K,
    value: TruckTicketFormState[K],
  ) => void;
  orderedYardsHint?: string;
  batchPlantReadOnly?: boolean;
}

const TruckTicketForm: React.FC<TruckTicketFormProps> = ({
  form,
  onChange,
  orderedYardsHint,
  batchPlantReadOnly = false,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Ticket identification
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Record date"
            type="date"
            value={form.recordDate}
            onChange={(e) => onChange('recordDate', e.target.value)}
          />
          <Input
            label="Ticket number"
            value={form.ticketNumber}
            onChange={(e) => onChange('ticketNumber', e.target.value)}
          />
          <Input
            label="Truck number"
            value={form.truckNumber}
            onChange={(e) => onChange('truckNumber', e.target.value)}
          />
          <Input
            label="Mix code"
            value={form.mixCode}
            onChange={(e) => onChange('mixCode', e.target.value)}
            placeholder="e.g. 3000 PSI · 3/4 aggregate"
            className="sm:col-span-2"
          />
          <Input
            label="Batch plant"
            value={form.batchPlant}
            onChange={(e) => onChange('batchPlant', e.target.value)}
            readOnly={batchPlantReadOnly}
            className="sm:col-span-2"
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Schedule
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TimeField
            label="Batch time"
            value={form.batchTime}
            onChange={(v) => onChange('batchTime', v)}
          />
          <TimeField
            label="Depart time"
            value={form.departTime}
            onChange={(v) => onChange('departTime', v)}
          />
          <TimeField
            label="Arrival time"
            value={form.arrivalTime}
            onChange={(v) => onChange('arrivalTime', v)}
          />
          <TimeField
            label="Discharge start"
            value={form.dischargeStart}
            onChange={(v) => onChange('dischargeStart', v)}
          />
          <TimeField
            label="Discharge end"
            value={form.dischargeEnd}
            onChange={(v) => onChange('dischargeEnd', v)}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Volume
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Ordered yards (yd³)"
            type="number"
            min="0"
            step="0.01"
            value={form.orderedYards}
            onChange={(e) => onChange('orderedYards', e.target.value)}
            helperText={orderedYardsHint}
          />
          <Input
            label="Delivered yards (yd³)"
            type="number"
            min="0"
            step="0.01"
            value={form.deliveredYards}
            onChange={(e) => onChange('deliveredYards', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Fresh concrete tests
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Slump (in)"
            type="number"
            step="0.5"
            value={form.slump}
            onChange={(e) => onChange('slump', e.target.value)}
          />
          <Input
            label="Slump after adjustment (in)"
            type="number"
            step="0.5"
            value={form.slumpAfterAdjustment}
            onChange={(e) => onChange('slumpAfterAdjustment', e.target.value)}
          />
          <Input
            label="Air content (%)"
            type="number"
            step="0.1"
            value={form.airContent}
            onChange={(e) => onChange('airContent', e.target.value)}
          />
          <Input
            label="Concrete temp (°F)"
            type="number"
            value={form.concreteTemp}
            onChange={(e) => onChange('concreteTemp', e.target.value)}
          />
          <Input
            label="Water added at plant (gal)"
            type="number"
            min="0"
            step="0.1"
            value={form.waterAddedPlant}
            onChange={(e) => onChange('waterAddedPlant', e.target.value)}
          />
          <Input
            label="Water added on site (gal)"
            type="number"
            min="0"
            step="0.1"
            value={form.waterAddedSite}
            onChange={(e) => onChange('waterAddedSite', e.target.value)}
          />
          <Input
            label="Drum revolutions"
            type="number"
            min="0"
            step="1"
            value={form.drumRevolutions}
            onChange={(e) => onChange('drumRevolutions', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Additional QC
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Admixture added on site"
            value={form.admixtureAddedOnSite}
            onChange={(e) => onChange('admixtureAddedOnSite', e.target.value)}
          />
          <Input
            label="Inspector / QC initials"
            value={form.inspectorInitials}
            onChange={(e) => onChange('inspectorInitials', e.target.value)}
          />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ticketAccepted}
              onChange={(e) => onChange('ticketAccepted', e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Ticket accepted — load approved for placement
          </label>
        </div>
      </div>
    </div>
  );
};

export default TruckTicketForm;
