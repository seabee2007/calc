import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardCopy,
  Loader2,
  MapPin,
  Phone,
  Search,
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import PlannerStepLocationsCard from './PlannerStepLocationsCard';
import CallSheetDetailsForm from './CallSheetDetailsForm';
import type { PourPlannerContext } from '../../hooks/usePourPlannerState';
import type { ScoredPourDay } from '../../utils/pourScoring';
import { lookupBatchPlantContact } from '../../services/batchPlantContactService';
import { pourOrderCallSheetText } from '../../utils/pourOrderSummary';
import { batchPlantDisplayLine, parsePlannerCoord } from '../../utils/addressForm';
import { hasSavedBatchPlantContact } from '../../utils/projectLocation';

interface PourOrderSectionProps {
  planner: PourPlannerContext;
  selectedDay?: ScoredPourDay;
}

/** Card styling aligned with CallSheetDetailsForm (light + dark). */
const STEP_CARD =
  'p-4 space-y-4 rounded-lg bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-600 shadow-lg';

const PourOrderSection: React.FC<PourOrderSectionProps> = ({ planner, selectedDay }) => {
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

  const dispatchNotes =
    form.orderNotes.trim() || project?.placementOrder?.orderNotes?.trim() || '';

  const callSheetText = useMemo(
    () =>
      pourOrderCallSheetText({
        form: dispatchNotes !== form.orderNotes.trim()
          ? { ...form, orderNotes: dispatchNotes }
          : form,
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
      dispatchNotes,
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

  const travelMi = parseFloat(form.travelDistance);
  const travelMin = parseFloat(form.travelTimeMinutes);

  return (
    <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-600">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          Order ready-mix
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Industry-style dispatch call sheet — project info, placement, mix, quantity, weather, QC,
          and safety. Batch plant details carry forward from earlier planner steps.
        </p>
      </div>

      <PlannerStepLocationsCard form={form} />

      <CallSheetDetailsForm planner={planner} />

      <div className={STEP_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Batch plant contact</h4>
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
              className="border-gray-300 dark:border-slate-500 text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              {lookupLoading ? 'Looking up…' : 'Refresh contact (AI)'}
            </Button>
          )}
        </div>

        {hasPlantFromEarlierSteps && (
          <div className="rounded-lg bg-gray-50 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-600 p-3 space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400/90">
              From planner steps
            </p>
            {plantName && (
              <p className="font-medium text-gray-900 dark:text-white flex items-start gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400 mt-0.5" />
                {plantName}
              </p>
            )}
            {plantLine && (
              <p className="text-gray-600 dark:text-slate-300 flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-400 mt-0.5" />
                {plantLine}
              </p>
            )}
            {(Number.isFinite(travelMi) && travelMi > 0) ||
            (Number.isFinite(travelMin) && travelMin > 0) ? (
              <p className="text-gray-500 dark:text-slate-400 text-xs">
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
          <p className="text-xs text-emerald-800 dark:text-emerald-200/90 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-md p-2">
            Contact details are filled from your batch plant search. Edit below if anything changed.
          </p>
        )}

        {hasPlantFromEarlierSteps && !hasContactFields && !lookupLoading && (
          <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-600 rounded-md p-2">
            Contact not provided
          </p>
        )}

        {showAiLookup && !lookupLoading && (
          <p className="text-xs text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-md p-2 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Looking up dispatch contact from your selected plant. Confirm phone and email with
              the plant before ordering.
            </span>
          </p>
        )}

        {lookupError && (
          <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
        )}
        {lookupNotes && (
          <p className="text-xs text-gray-500 dark:text-slate-400">{lookupNotes}</p>
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
                className="inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <Phone className="h-4 w-4" />
                Call plant
              </a>
            )}
          </div>
        )}
      </div>

      <div className={STEP_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Order call sheet</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCallSheet}
            icon={<ClipboardCopy className="h-4 w-4" />}
            className="border-gray-300 dark:border-slate-500 text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            {copyDone ? 'Copied!' : 'Copy call sheet'}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 dark:bg-slate-950 rounded-lg p-3 max-h-[32rem] overflow-y-auto text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-600">
          {callSheetText}
        </pre>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400">
        Use <span className="font-medium text-gray-700 dark:text-slate-300">Save call sheet &amp; return to project</span>{' '}
        below to store batch plant contact and this call sheet. Update placement order status on
        the project&apos;s Next actions panel after you call the plant.
      </p>
    </section>
  );
};

export default PourOrderSection;
