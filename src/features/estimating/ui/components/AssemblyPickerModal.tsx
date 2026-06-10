/**
 * Assembly Picker Modal
 *
 * Step 1 — Select a division + assembly.
 * Step 2 — Enter quantities for each assembly input.
 * Step 3 — Preview rollup. Confirm adds to project.
 */
import { useCallback, useMemo, useState } from 'react';
import { X, ChevronRight, ArrowLeft, Plus } from 'lucide-react';
import { CA_ASSEMBLY_GROUPS, CA_ASSEMBLY_BY_ID } from '../../data/activityAssemblyRegistry';
import {
  DIV03_ALL_PRODUCTION_RATES,
  DIV03_CONCRETE,
  CONTINUOUS_FOOTING_LINE_ITEMS,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../../data/div03ConcreteSeeds';
import {
  DIV31_EARTHWORK,
  DIV31_PRODUCTION_RATES,
  CLEAR_AND_GRUB_LINE_ITEMS,
  EXCAVATE_FOOTINGS_LINE_ITEMS,
  BACKFILL_AND_COMPACT_LINE_ITEMS,
} from '../../data/div31EarthworkSeeds';
import { instantiateFromAssemblySpec } from '../../domain/activityAssemblyInstantiation';
import type { ActivityAssemblySpec, AssemblyUserInputs } from '../../domain/activityAssemblyTypes';
import type { ActivityLineItemTemplate, EstimateDivision, ProductionRate, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import {
  assignProjectActivityCode,
  validateInstanceLabelForDuplicateTemplate,
} from '../../application/constructionActivityCoding';
import type { AddFromAssemblyParams } from '../hooks/useConstructionActivities';
import ActivityInstanceFields, { buildIdentityFromForm } from './ActivityInstanceFields';

const DIVISION_MAP = new Map<string, EstimateDivision>([
  ['03', DIV03_CONCRETE],
  ['31', DIV31_EARTHWORK],
]);

const RATE_MAP = new Map<string, ProductionRate>([
  ...DIV03_ALL_PRODUCTION_RATES.map((r): [string, ProductionRate] => [r.id, r]),
  ...DIV31_PRODUCTION_RATES.map((r): [string, ProductionRate] => [r.id, r]),
]);

const LINE_ITEM_MAP = new Map<string, readonly ActivityLineItemTemplate[]>([
  ['asm-03-place-slab-on-grade', PLACE_SLAB_ON_GRADE_LINE_ITEMS],
  ['asm-03-place-continuous-footing', CONTINUOUS_FOOTING_LINE_ITEMS],
  ['asm-31-clear-and-grub', CLEAR_AND_GRUB_LINE_ITEMS],
  ['asm-31-excavate-footings', EXCAVATE_FOOTINGS_LINE_ITEMS],
  ['asm-31-backfill-compact', BACKFILL_AND_COMPACT_LINE_ITEMS],
]);

const DEFAULT_CREW_SIZE = 4;
const DEFAULT_HOURS_PER_DAY = 8;

type Step = 'select' | 'quantities';

interface Props {
  onConfirm: (params: AddFromAssemblyParams) => void;
  onCancel: () => void;
  saving?: boolean;
  existingActivities?: ProjectConstructionActivity[];
}

export default function AssemblyPickerModal({ onConfirm, onCancel, saving, existingActivities = [] }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Crew settings — lifted here so preview and confirm share the same values
  const [crewSizeStr, setCrewSizeStr] = useState(String(DEFAULT_CREW_SIZE));
  const [hoursPerDayStr, setHoursPerDayStr] = useState(String(DEFAULT_HOURS_PER_DAY));
  const [durationOverrideStr, setDurationOverrideStr] = useState('');

  const [activityName, setActivityName] = useState('');
  const [instanceLabel, setInstanceLabel] = useState('');
  const [location, setLocation] = useState('');
  const [drawingReference, setDrawingReference] = useState('');
  const [notes, setNotes] = useState('');

  const crewSize = Math.max(1, parseInt(crewSizeStr) || DEFAULT_CREW_SIZE);
  const hoursPerDay = Math.max(0.5, parseFloat(hoursPerDayStr) || DEFAULT_HOURS_PER_DAY);
  const durationOverride = durationOverrideStr !== ''
    ? Math.max(1, parseInt(durationOverrideStr) || 1)
    : null;

  // Validation errors
  const crewSizeError = (parseInt(crewSizeStr) || 0) <= 0 ? 'Must be > 0' : null;
  const hoursPerDayError = (parseFloat(hoursPerDayStr) || 0) <= 0 ? 'Must be > 0' : null;
  const durationOverrideError =
    durationOverrideStr !== '' && (parseInt(durationOverrideStr) || 0) <= 0
      ? 'Must be > 0'
      : null;
  const hasValidationError = !!crewSizeError || !!hoursPerDayError || !!durationOverrideError;

  const assembly = useMemo(
    () => (selectedAssemblyId ? CA_ASSEMBLY_BY_ID.get(selectedAssemblyId) : null),
    [selectedAssemblyId],
  );

  const identity = useMemo(
    () =>
      buildIdentityFromForm({
        activityName: activityName || assembly?.displayName || '',
        instanceLabel,
        location,
        drawingReference,
        notes,
      }),
    [activityName, assembly?.displayName, drawingReference, instanceLabel, location, notes],
  );

  const duplicateTemplateWarning = useMemo(() => {
    if (!assembly) return null;
    return validateInstanceLabelForDuplicateTemplate({
      existingActivities,
      sourceTemplateKey: assembly.activityTemplateId,
      instanceLabel,
    });
  }, [assembly, existingActivities, instanceLabel]);

  const assignedPreview = useMemo(() => {
    if (!assembly) return null;
    const division = DIVISION_MAP.get(assembly.divisionCode);
    if (!division) return null;
    return assignProjectActivityCode({
      existingActivities,
      divisionCode: division.code,
      sourceTemplateKey: assembly.activityTemplateId,
      templateMasterCode: assembly.templateMasterCode,
      identity,
    });
  }, [assembly, existingActivities, identity]);

  const preview = useMemo(() => {
    if (!assembly || !assignedPreview) return null;
    const division = DIVISION_MAP.get(assembly.divisionCode);
    const lineItemTemplates = LINE_ITEM_MAP.get(assembly.id);
    if (!division || !lineItemTemplates) return null;

    const userInputs: AssemblyUserInputs = {};
    for (const spec of assembly.quantityInputs) {
      const raw = inputValues[spec.id];
      const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : (spec.defaultValue ?? 0);
      userInputs[spec.id] = isNaN(parsed) ? 0 : parsed;
    }

    return instantiateFromAssemblySpec({
      assembly,
      userInputs,
      division,
      lineItemTemplates,
      productionRates: RATE_MAP,
      projectId: 'preview',
      crewSize,
      hoursPerDay,
      durationDaysOverride: durationOverride,
      activityTitleOverride: assignedPreview.title,
      activityCode: assignedPreview.activityCode,
      baseTitle: assignedPreview.baseTitle,
      instanceLabel: identity.instanceLabel,
      location: identity.location,
      drawingReference: identity.drawingReference,
      phase: identity.phase,
      notes: identity.notes,
      activitySequence: assignedPreview.activitySequence,
      instanceSequence: assignedPreview.instanceSequence,
    });
  }, [assembly, assignedPreview, crewSize, durationOverride, hoursPerDay, identity, inputValues]);

  const handleSelectAssembly = useCallback((id: string) => {
    const asm = CA_ASSEMBLY_BY_ID.get(id);
    setSelectedAssemblyId(id);
    setInputValues({});
    setActivityName(asm?.displayName ?? '');
    setInstanceLabel('');
    setLocation('');
    setDrawingReference('');
    setNotes('');
    setCrewSizeStr(String(asm?.defaultCrewSize ?? DEFAULT_CREW_SIZE));
    setHoursPerDayStr(String(asm?.defaultHoursPerDay ?? DEFAULT_HOURS_PER_DAY));
    setDurationOverrideStr('');
    setStep('quantities');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!assembly || hasValidationError || duplicateTemplateWarning) return;
    const division = DIVISION_MAP.get(assembly.divisionCode);
    const lineItemTemplates = LINE_ITEM_MAP.get(assembly.id);
    if (!division || !lineItemTemplates) return;

    const userInputs: AssemblyUserInputs = {};
    for (const spec of assembly.quantityInputs) {
      const raw = inputValues[spec.id];
      const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : 0;
      userInputs[spec.id] = isNaN(parsed) ? 0 : parsed;
    }

    onConfirm({
      assembly,
      userInputs,
      division,
      lineItemTemplates,
      productionRates: RATE_MAP,
      crewSize,
      hoursPerDay,
      durationDaysOverride: durationOverride,
      identity,
    });
  }, [
    assembly,
    crewSize,
    durationOverride,
    duplicateTemplateWarning,
    hasValidationError,
    hoursPerDay,
    identity,
    inputValues,
    onConfirm,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            {step === 'quantities' && (
              <button
                type="button"
                onClick={() => setStep('select')}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {step === 'select' ? 'Add Construction Activity' : 'Enter Quantities'}
            </h2>
            {step === 'quantities' && assembly && (
              <span className="text-sm text-slate-500">&mdash; {assembly.displayName}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {step === 'select' ? (
            <SelectStep onSelect={handleSelectAssembly} />
          ) : (
            <QuantitiesStep
              assembly={assembly!}
              inputValues={inputValues}
              onInputChange={(id, val) => setInputValues((p) => ({ ...p, [id]: val }))}
              preview={preview}
              activityName={activityName}
              instanceLabel={instanceLabel}
              location={location}
              drawingReference={drawingReference}
              notes={notes}
              onActivityNameChange={setActivityName}
              onInstanceLabelChange={setInstanceLabel}
              onLocationChange={setLocation}
              onDrawingReferenceChange={setDrawingReference}
              onNotesChange={setNotes}
              duplicateTemplateWarning={duplicateTemplateWarning}
              assignedCode={assignedPreview?.activityCode}
              assignedTitle={assignedPreview?.title}
              crewSizeStr={crewSizeStr}
              hoursPerDayStr={hoursPerDayStr}
              durationOverrideStr={durationOverrideStr}
              onCrewSizeChange={setCrewSizeStr}
              onHoursPerDayChange={setHoursPerDayStr}
              onDurationOverrideChange={setDurationOverrideStr}
              crewSizeError={crewSizeError}
              hoursPerDayError={hoursPerDayError}
              durationOverrideError={durationOverrideError}
            />
          )}
        </div>

        {/* Footer */}
        {step === 'quantities' && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-800/50">
            {preview && (
              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <span>
                  <strong className="text-cyan-700 dark:text-cyan-400">
                    {preview.rollup.totalManHours.toFixed(1)} MH
                  </strong>
                </span>
                {durationOverride != null ? (
                  <span>
                    <strong className="text-amber-600 dark:text-amber-400">{durationOverride}d</strong>
                    <span className="ml-1 text-xs text-slate-400">(override, calc {preview.rollup.calculatedDurationDays}d)</span>
                  </span>
                ) : (
                  <span>{preview.rollup.calculatedDurationDays}d estimated</span>
                )}
                <span>{preview.projectLineItems.length} line items</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || hasValidationError || !!duplicateTemplateWarning}
              className="ml-auto flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
            >
              <Plus size={15} />
              {saving ? 'Saving…' : 'Add to Estimate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Select assembly ───────────────────────────────────────────────────

function SelectStep({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {CA_ASSEMBLY_GROUPS.map((group) => (
        <div key={group.divisionCode}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Division {group.divisionCode} — {group.divisionName}
          </p>
          <div className="space-y-1.5">
            {group.assemblies.map((asm) => (
              <button
                key={asm.id}
                type="button"
                onClick={() => onSelect(asm.id)}
                className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 text-left hover:border-cyan-400 hover:bg-cyan-50 dark:hover:border-cyan-600 dark:hover:bg-cyan-900/20 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-300">
                    {asm.displayName}
                  </p>
                  {asm.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {asm.description}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-cyan-500 shrink-0 ml-3" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 2: Enter quantities ──────────────────────────────────────────────────

interface QuantitiesStepProps {
  assembly: ActivityAssemblySpec;
  inputValues: Record<string, string>;
  onInputChange: (id: string, value: string) => void;
  preview: ReturnType<typeof instantiateFromAssemblySpec> | null;
  activityName: string;
  instanceLabel: string;
  location: string;
  drawingReference: string;
  notes: string;
  onActivityNameChange: (value: string) => void;
  onInstanceLabelChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDrawingReferenceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  duplicateTemplateWarning?: string | null;
  assignedCode?: string;
  assignedTitle?: string;
  crewSizeStr: string;
  hoursPerDayStr: string;
  durationOverrideStr: string;
  onCrewSizeChange: (v: string) => void;
  onHoursPerDayChange: (v: string) => void;
  onDurationOverrideChange: (v: string) => void;
  crewSizeError: string | null;
  hoursPerDayError: string | null;
  durationOverrideError: string | null;
}

function QuantitiesStep({
  assembly,
  inputValues,
  onInputChange,
  preview,
  activityName,
  instanceLabel,
  location,
  drawingReference,
  notes,
  onActivityNameChange,
  onInstanceLabelChange,
  onLocationChange,
  onDrawingReferenceChange,
  onNotesChange,
  duplicateTemplateWarning,
  assignedCode,
  assignedTitle,
  crewSizeStr,
  hoursPerDayStr,
  durationOverrideStr,
  onCrewSizeChange,
  onHoursPerDayChange,
  onDurationOverrideChange,
  crewSizeError,
  hoursPerDayError,
  durationOverrideError,
}: QuantitiesStepProps) {
  const hasOverride = durationOverrideStr !== '' && !durationOverrideError;
  const effectiveDuration = hasOverride
    ? parseInt(durationOverrideStr)
    : preview?.rollup.calculatedDurationDays ?? 0;

  return (
    <div className="space-y-4">
      <ActivityInstanceFields
        activityName={activityName}
        instanceLabel={instanceLabel}
        location={location}
        drawingReference={drawingReference}
        notes={notes}
        onActivityNameChange={onActivityNameChange}
        onInstanceLabelChange={onInstanceLabelChange}
        onLocationChange={onLocationChange}
        onDrawingReferenceChange={onDrawingReferenceChange}
        onNotesChange={onNotesChange}
        duplicateTemplateWarning={duplicateTemplateWarning}
        previewCode={assignedCode}
        previewTitle={assignedTitle}
      />

      {/* Quantity input fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        {assembly.quantityInputs.map((spec) => (
          <div key={spec.id}>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {spec.label}
              <span className="ml-1.5 text-slate-400 font-normal">({spec.unit})</span>
            </label>
            {spec.description && (
              <p className="text-[11px] text-slate-400 mb-1">{spec.description}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={inputValues[spec.id] ?? ''}
                onChange={(e) => onInputChange(spec.id, e.target.value)}
                placeholder={spec.defaultValue?.toString() ?? '0'}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="shrink-0 text-xs text-slate-400">{spec.unit}</span>
            </div>
            {spec.formulaHint && (
              <p className="mt-0.5 text-[11px] text-cyan-600 dark:text-cyan-400 italic">
                {spec.formulaHint}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Crew settings ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-3">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
          Crew &amp; Schedule
        </p>
        <div className="grid grid-cols-3 gap-3">
          {/* Crew size */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Crew Size
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={crewSizeStr}
              onChange={(e) => onCrewSizeChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                crewSizeError
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {crewSizeError && (
              <p className="mt-0.5 text-[11px] text-red-500">{crewSizeError}</p>
            )}
          </div>

          {/* Hours per day */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Hours / Day
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={hoursPerDayStr}
              onChange={(e) => onHoursPerDayChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                hoursPerDayError
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {hoursPerDayError && (
              <p className="mt-0.5 text-[11px] text-red-500">{hoursPerDayError}</p>
            )}
          </div>

          {/* Duration override */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Duration Override
              <span className="ml-1 font-normal text-slate-400">(days, optional)</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={durationOverrideStr}
              onChange={(e) => onDurationOverrideChange(e.target.value)}
              placeholder="calc'd"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400 ${
                durationOverrideError
                  ? 'border-red-400 dark:border-red-500'
                  : durationOverrideStr !== ''
                    ? 'border-amber-400 dark:border-amber-500'
                    : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {durationOverrideError && (
              <p className="mt-0.5 text-[11px] text-red-500">{durationOverrideError}</p>
            )}
            {durationOverrideStr !== '' && !durationOverrideError && (
              <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                Overrides calculated duration
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
            Estimated Output
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Man-Hours', value: preview.rollup.totalManHours.toFixed(1), unit: 'MH', highlight: false },
              { label: 'Man-Days', value: preview.rollup.totalManDays.toFixed(1), unit: 'MD', highlight: false },
              {
                label: hasOverride ? 'Duration*' : 'Duration',
                value: `${effectiveDuration}`,
                unit: hasOverride ? 'd*' : 'days',
                highlight: hasOverride,
              },
              { label: 'Line Items', value: `${preview.projectLineItems.length}`, unit: '', highlight: false },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded border p-2 text-center ${
                  s.highlight
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <p className={`text-[10px] uppercase ${s.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {s.label}
                </p>
                <p className={`text-lg font-bold ${s.highlight ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>
                  {s.value}
                  {s.unit && <span className="text-xs font-normal ml-1">{s.unit}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Calc breakdown line */}
          {preview.rollup.totalManHours > 0 && (
            <p className="text-[11px] text-slate-400 mb-2">
              {preview.rollup.totalManHours.toFixed(1)} MH ÷ ({crewSizeStr} crew × {hoursPerDayStr}h/day)
              {' = '}
              <strong className="text-slate-600 dark:text-slate-300">
                {preview.rollup.calculatedDurationDays}d calculated
              </strong>
              {hasOverride && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' → '}
                  <strong>{durationOverrideStr}d override</strong>
                </span>
              )}
            </p>
          )}

          {/* Line item preview list */}
          <div className="space-y-0.5">
            {preview.projectLineItems.map((li) => (
              <div key={li.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-400 py-0.5">
                <span className="truncate flex-1 mr-2">{li.name}</span>
                <span className="tabular-nums shrink-0">
                  {li.quantity.toLocaleString()} {li.unit} → {li.calculatedManHours.toFixed(2)} MH
                </span>
              </div>
            ))}
          </div>
          {preview.rollup.warnings.length > 0 && (
            <div className="mt-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-2">
              {preview.rollup.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assembly source note */}
      <p className="text-[11px] text-slate-400">
        Source: NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12 (direct labor only, method-adjusted)
      </p>
    </div>
  );
}
