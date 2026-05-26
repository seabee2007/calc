import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardCopy,
  Loader2,
  MapPin,
  Phone,
  Save,
  Search,
} from 'lucide-react';
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
import { hasSavedBatchPlantContact } from '../../utils/projectLocation';

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

/** Dark-surface card for call sheet step (readable on planner page background). */
const DARK_CARD =
  'p-4 space-y-4 bg-slate-800/95 border border-slate-600 shadow-lg text-gray-100';

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
  const contactLookupKeyRef = useRef<string | null>(null);

  const plantLine = batchPlantDisplayLine(form);
  const plantName = form.batchPlantName.trim();
  const hasPlantFromEarlierSteps = Boolean(plantName || plantLine);
  const canLookup = hasPlantFromEarlierSteps;
  const savedContactOnProject = hasSavedBatchPlantContact(project);
  const hasContactFields = Boolean(
    form.batchPlantPhone.trim() ||
      form.batchPlantEmail.trim() ||
      form.batchPlantDispatchContact.trim(),
  );
  const showAiLookup =
    canLookup && !hasContactFields && !savedContactOnProject;

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

  const runContactLookup = async () => {
    if (!canLookup) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupNotes(null);

    try {
      const lat = parsePlannerCoord(form.batchPlantLatitude);
      const lng = parsePlannerCoord(form.batchPlantLongitude);
      const result = await lookupBatchPlantContact({
        plantName: plantName,
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

  useEffect(() => {
    if (!showAiLookup) return;
    const key = `${plantName}|${plantLine}|${form.batchPlantLatitude}|${form.batchPlantLongitude}`;
    if (contactLookupKeyRef.current === key) return;
    contactLookupKeyRef.current = key;
    void runContactLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per plant identity
  }, [showAiLookup, plantName, plantLine, form.batchPlantLatitude, form.batchPlantLongitude]);

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
  const travelMi = parseFloat(form.travelDistance);
  const travelMin = parseFloat(form.travelTimeMinutes);

  return (
    <section className="space-y-4 pt-4 border-t border-slate-600">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-cyan-400" />
          Order ready-mix
        </h3>
        <p className="text-sm text-slate-300">
          Industry-style dispatch call sheet — project info, placement, mix, quantity, weather, QC,
          and safety. Batch plant details carry forward from earlier planner steps.
        </p>
      </div>

      <PlannerStepLocationsCard form={form} />

      <CallSheetDetailsForm planner={planner} />

      <div className={DARK_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Batch plant contact</h4>
          {showAiLookup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runContactLookup()}
              disabled={lookupLoading}
              icon={
                lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )
              }
              className="border-slate-500 text-slate-100 hover:bg-slate-700"
            >
              {lookupLoading ? 'Looking up…' : 'Refresh contact (AI)'}
            </Button>
          )}
        </div>

        {hasPlantFromEarlierSteps && (
          <div className="rounded-lg bg-slate-900/90 border border-slate-600 p-3 space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
              From planner steps
            </p>
            {plantName && (
              <p className="font-medium text-white flex items-start gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                {plantName}
              </p>
            )}
            {plantLine && (
              <p className="text-slate-300 flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                {plantLine}
              </p>
            )}
            {(Number.isFinite(travelMi) && travelMi > 0) ||
            (Number.isFinite(travelMin) && travelMin > 0) ? (
              <p className="text-slate-400 text-xs">
                Route:{' '}
                {Number.isFinite(travelMi) && travelMi > 0 ? `${travelMi.toFixed(1)} mi` : '—'}
                {Number.isFinite(travelMin) && travelMin > 0
                  ? ` · ${Math.round(travelMin)} min drive`
                  : ''}
              </p>
            ) : null}
          </div>
        )}

        {hasContactFields && (
          <p className="text-xs text-emerald-200/90 bg-emerald-950/50 border border-emerald-800/60 rounded-md p-2">
            Contact details are filled from your batch plant search. Edit below if anything changed.
          </p>
        )}

        {showAiLookup && !lookupLoading && (
          <p className="text-xs text-amber-200/90 bg-amber-950/40 border border-amber-800/50 rounded-md p-2 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Looking up dispatch contact from your selected plant. Confirm phone and email with
              the plant before ordering.
            </span>
          </p>
        )}

        {lookupError && (
          <p className="text-sm text-red-400">{lookupError}</p>
        )}
        {lookupNotes && (
          <p className="text-xs text-slate-400">{lookupNotes}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Plant phone"
            type="tel"
            value={form.batchPlantPhone}
            onChange={(e) => {
              setField('batchPlantPhone', e.target.value);
              setField('batchPlantContactSource', '');
            }}
            placeholder="Main or dispatch line"
          />
          <Input
            label="Plant email"
            type="email"
            value={form.batchPlantEmail}
            onChange={(e) => {
              setField('batchPlantEmail', e.target.value);
              setField('batchPlantContactSource', '');
            }}
            placeholder="orders@…"
          />
          <Input
            label="Dispatch / contact name"
            value={form.batchPlantDispatchContact}
            onChange={(e) => {
              setField('batchPlantDispatchContact', e.target.value);
              setField('batchPlantContactSource', '');
            }}
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
                className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:underline"
              >
                <Phone className="h-4 w-4" />
                Call plant
              </a>
            )}
          </div>
        )}
      </div>

      <div className={DARK_CARD}>
        <h4 className="text-sm font-semibold text-white">Order status & notes</h4>
        <Select
          label="Placement order status"
          options={ORDER_STATUS_OPTIONS}
          value={orderStatus}
          onChange={(v) => setField('orderStatus', v as PlacementOrderStatus)}
        />
        <label className="block text-sm font-medium text-slate-200">
          Additional notes (appears on call sheet)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm min-h-[100px] placeholder:text-slate-500"
            value={form.orderNotes}
            onChange={(e) => setField('orderNotes', e.target.value)}
            placeholder={'No washout on pavement.\nCall superintendent before entering convoy gate.\nSlump test each truck.'}
          />
        </label>
      </div>

      <div className={DARK_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Order call sheet</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCallSheet}
            icon={<ClipboardCopy className="h-4 w-4" />}
            className="border-slate-500 text-slate-100 hover:bg-slate-700"
          >
            {copyDone ? 'Copied!' : 'Copy call sheet'}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono bg-slate-950 rounded-lg p-3 max-h-[32rem] overflow-y-auto text-slate-200 border border-slate-600">
          {callSheetText}
        </pre>
      </div>

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
          <p className="text-xs text-slate-400">
            Link a saved project in Step 1 to store order status (for a future orders dashboard).
          </p>
        )}
        {saveMessage && (
          <p className="text-sm text-emerald-400">{saveMessage}</p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Saved orders store contact, status, and this call sheet on the project. A dashboard for
        ordered vs scheduled placements can use this data later.
      </p>
    </section>
  );
};

export default PourOrderSection;
