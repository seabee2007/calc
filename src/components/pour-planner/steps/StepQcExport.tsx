import React from 'react';
import { FileDown } from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../../utils/pourScoring';
import { format, parseISO } from 'date-fns';

interface StepProps {
  planner: PourPlannerContext;
  selectedDate: string | null;
  selectedDay?: ScoredPourDay;
  onSavePourDate?: () => void;
  saveMessage?: string | null;
  canSavePourDate?: boolean;
}

export const StepQcExport: React.FC<StepProps> = ({
  planner,
  selectedDate,
  selectedDay,
  onSavePourDate,
  saveMessage,
  canSavePourDate,
}) => {
  const { form, setField } = planner;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          QC & ticket tracking
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Record field QC data per truck. This turns the planner into a superintendent field
          record.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            label="Batch time"
            type="time"
            value={form.batchTime}
            onChange={(e) => setField('batchTime', e.target.value)}
          />
          <Input
            label="Time water added"
            type="time"
            value={form.waterAddedTime}
            onChange={(e) => setField('waterAddedTime', e.target.value)}
          />
          <Input
            label="Arrival time"
            type="time"
            value={form.arrivalTime}
            onChange={(e) => setField('arrivalTime', e.target.value)}
          />
          <Input
            label="Discharge start"
            type="time"
            value={form.dischargeStartTime}
            onChange={(e) => setField('dischargeStartTime', e.target.value)}
          />
          <Input
            label="Discharge complete"
            type="time"
            value={form.dischargeFinishTime}
            onChange={(e) => setField('dischargeFinishTime', e.target.value)}
          />
          <Input
            label="Slump at arrival (in)"
            type="number"
            step="0.5"
            value={form.slumpAtArrival}
            onChange={(e) => setField('slumpAtArrival', e.target.value)}
          />
          <Input
            label="Slump after adjustment (in)"
            type="number"
            step="0.5"
            value={form.slumpAfterAdjustment}
            onChange={(e) => setField('slumpAfterAdjustment', e.target.value)}
          />
          <Input
            label="Concrete temp at arrival (°F)"
            type="number"
            value={form.concreteTempAtArrival}
            onChange={(e) => setField('concreteTempAtArrival', e.target.value)}
          />
          <Input
            label="Air content (%)"
            type="number"
            step="0.1"
            value={form.airContent}
            onChange={(e) => setField('airContent', e.target.value)}
          />
          <Input
            label="Water added on site (gal)"
            type="number"
            min="0"
            step="0.1"
            value={form.waterAddedOnSite}
            onChange={(e) => setField('waterAddedOnSite', e.target.value)}
          />
          <Input
            label="Admixture added on site"
            value={form.admixtureAddedOnSite}
            onChange={(e) => setField('admixtureAddedOnSite', e.target.value)}
          />
          <Input
            label="Inspector / QC initials"
            value={form.inspectorInitials}
            onChange={(e) => setField('inspectorInitials', e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Pour summary & export
        </h4>
        <Card className="p-4 text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <p>
            <strong>Project:</strong> {form.projectName || '—'}
          </p>
          <p>
            <strong>Pour date:</strong>{' '}
            {selectedDate
              ? format(parseISO(selectedDate), 'MMM d, yyyy')
              : 'Not selected from forecast'}
          </p>
          <p>
            <strong>Weather score:</strong>{' '}
            {selectedDay ? `${selectedDay.rating} (${selectedDay.score})` : '—'}
          </p>
          <p>
            <strong>Delivery status:</strong> {planner.deliveryWindow.statusLabel}
          </p>
          <p>
            <strong>Truck spacing:</strong>{' '}
            {Math.round(planner.production.truckSpacingMinutes)} min recommended
          </p>
        </Card>

        <div className="flex flex-wrap gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            icon={<FileDown className="h-4 w-4" />}
            disabled
            title="PDF export coming soon"
          >
            Export PDF (coming soon)
          </Button>
          {canSavePourDate && onSavePourDate && (
            <Button type="button" onClick={onSavePourDate}>
              Save pour date to project
            </Button>
          )}
        </div>
        {saveMessage && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">{saveMessage}</p>
        )}
      </section>
    </div>
  );
};

export default StepQcExport;
