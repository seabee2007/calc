import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardCopy,
  Loader2,
  Phone,
  Save,
  Search,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import PlannerStepLocationsCard from './PlannerStepLocationsCard';
import CallSheetDetailsForm from './CallSheetDetailsForm';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../utils/pourScoring';
import { lookupBatchPlantContact } from '../../services/batchPlantContactService';
import { pourOrderCallSheetText } from '../../utils/pourOrderSummary';
import {
  PLACEMENT_ORDER_STATUS_LABELS,
  type PlacementOrderStatus,
} from '../../types/placementOrder';
import { batchPlantDisplayLine, parsePlannerCoord } from '../../utils/addressForm';

interface PourOrderSectionProps {
  planner: PourPlannerContext;
  selectedDay?: ScoredPourDay;
  canSaveToProject: boolean;
  onSaveOrder: () => Promise<void>;
  saveLoading?: boolean;
  saveMessage?: string | null;
}

const ORDER_STATUS_OPTIONS = (
  Object.entries(PLACEMENT_ORDER_STATUS_LABELS) as [PlacementOrderStatus, string][]
).map(([value, label]) => ({ value, label }));

const PourOrderSection: React.FC<PourOrderSectionProps> = ({
  planner,
  selectedDay,
  canSaveToProject,
  onSaveOrder,
  saveLoading = false,
  saveMessage = null,
}) => {
  const {
    form,
    setField,
    deliveryPlan,
    truckCount,
    production,
    deliveryWindow,
    preferences,
    project,
    hotWeather,
  } = planner;

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupNotes, setLookupNotes] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const plantLine = batchPlantDisplayLine(form);
  const canLookup = Boolean(form.batchPlantName.trim() || plantLine);

  const callSheetText = useMemo(
    () =>
      pourOrderCallSheetText({
        form,
        volumeYd: deliveryPlan.volumeYd,
        truckCount,
        truckCapacityYd: planner.truckCapacityYd,
        pourDurationHours: production.placementDurationHours,
        travelTimeMin: parseFloat(form.travelTimeMinutes) || 0,
        travelDistanceMi: parseFloat(form.travelDistance) || 0,
        deliveryStatus: deliveryWindow.statusLabel,
        preferences,
        selectedDay,
        projectPourDateIso: project?.pourDate,
        hotWeatherRiskLevel: hotWeather.riskLevel,
      }),
    [
      form,
      deliveryPlan.volumeYd,
      truckCount,
      planner.truckCapacityYd,
      production.placementDurationHours,
      deliveryWindow.statusLabel,
      hotWeather.riskLevel,
      preferences,
      selectedDay,
      project?.pourDate,
    ],
  );

  const handleLookupContact = async () => {
    if (!canLookup) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupNotes(null);

    try {
      const lat = parsePlannerCoord(form.batchPlantLatitude);
      const lng = parsePlannerCoord(form.batchPlantLongitude);
      const result = await lookupBatchPlantContact({
        plantName: form.batchPlantName.trim(),
        plantAddress: plantLine,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
      });

      if (result.phone) setField('batchPlantPhone', result.phone);
      if (result.email) setField('batchPlantEmail', result.email);
      if (result.dispatchContact) {
        setField('batchPlantDispatchContact', result.dispatchContact);
      }
      if (result.website) setField('batchPlantWebsite', result.website);
      setField('batchPlantContactSource', 'ai');
      setLookupNotes(
        `${result.notes} (confidence: ${result.confidence})`,
      );
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Could not look up plant contact.',
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopyCallSheet = async () => {
    try {
      await navigator.clipboard.writeText(callSheetText);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    } catch {
      setLookupError('Could not copy to clipboard.');
    }
  };

  const orderStatus = form.orderStatus || 'draft';

  return (
    <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Order ready-mix
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Industry-style dispatch call sheet — project info, placement, mix, quantity, weather, QC,
          and safety. Auto-fills from Steps 1–6; complete the fields below before calling the plant.
        </p>
      </div>

      <PlannerStepLocationsCard form={form} />

      <CallSheetDetailsForm planner={planner} />

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Batch plant contact
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLookupContact}
            disabled={!canLookup || lookupLoading}
            icon={
              lookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )
            }
          >
            {lookupLoading ? 'Looking up…' : 'Find contact (AI)'}
          </Button>
        </div>

        <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            AI lookup uses public directory knowledge only — always confirm phone and email with the
            plant before placing an order. Edit fields manually if anything looks wrong.
          </span>
        </p>

        {lookupError && (
          <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
        )}
        {lookupNotes && (
          <p className="text-xs text-gray-600 dark:text-gray-400">{lookupNotes}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Plant phone"
            type="tel"
            value={form.batchPlantPhone}
            onChange={(e) => setField('batchPlantPhone', e.target.value)}
            placeholder="Main or dispatch line"
          />
          <Input
            label="Plant email"
            type="email"
            value={form.batchPlantEmail}
            onChange={(e) => setField('batchPlantEmail', e.target.value)}
            placeholder="orders@…"
          />
          <Input
            label="Dispatch / contact name"
            value={form.batchPlantDispatchContact}
            onChange={(e) => setField('batchPlantDispatchContact', e.target.value)}
            placeholder="Dispatcher or sales"
            className="sm:col-span-2"
          />
          <Input
            label="Website (optional)"
            value={form.batchPlantWebsite}
            onChange={(e) => setField('batchPlantWebsite', e.target.value)}
            placeholder="https://…"
            className="sm:col-span-2"
          />
        </div>

        {(form.batchPlantPhone || form.batchPlantEmail) && (
          <div className="flex flex-wrap gap-2">
            {form.batchPlantPhone && (
              <a
                href={`tel:${form.batchPlantPhone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Phone className="h-4 w-4" />
                Call plant
              </a>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Order status & notes
        </h4>
        <Select
          label="Placement order status"
          options={ORDER_STATUS_OPTIONS}
          value={orderStatus}
          onChange={(v) => setField('orderStatus', v as PlacementOrderStatus)}
        />
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Additional notes (appears on call sheet)
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm min-h-[100px]"
            value={form.orderNotes}
            onChange={(e) => setField('orderNotes', e.target.value)}
            placeholder={'No washout on pavement.\nCall superintendent before entering convoy gate.\nSlump test each truck.'}
          />
        </label>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Order call sheet
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCallSheet}
            icon={<ClipboardCopy className="h-4 w-4" />}
          >
            {copyDone ? 'Copied!' : 'Copy call sheet'}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-h-[32rem] overflow-y-auto text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
          {callSheetText}
        </pre>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          type="button"
          onClick={onSaveOrder}
          disabled={!canSaveToProject || saveLoading}
          icon={
            saveLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )
          }
        >
          {saveLoading ? 'Saving…' : 'Save order to project'}
        </Button>
        {!canSaveToProject && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Link a saved project in Step 1 to store order status (for a future orders dashboard).
          </p>
        )}
        {saveMessage && (
          <p className="text-sm text-green-600 dark:text-green-400">{saveMessage}</p>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Saved orders store contact, status, and this call sheet on the project. A dashboard for
        ordered vs scheduled placements can use this data later.
      </p>
    </section>
  );
};

export default PourOrderSection;
