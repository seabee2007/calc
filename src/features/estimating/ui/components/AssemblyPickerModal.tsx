/**
 * Add Construction Activity modal.
 *
 * Paths:
 *  - Build from Production Rate Library (dynamic division → category → work elements)
 *  - Manual / Custom Activity
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, BookOpen, PenLine, AlertTriangle } from 'lucide-react';
import ModalShell from '../../../../components/ui/ModalShell';
import Button from '../../../../components/ui/Button';
import {
  assignProjectActivityCode,
  validateInstanceLabelForDuplicateTemplate,
} from '../../application/constructionActivityCoding';
import {
  buildProductionRateCategorySourceTemplateKey,
  createDraftActivityFromAssemblyCategory,
  getAssemblyGroupForCategory,
  previewDraftProductionRateActivity,
  updateDraftLineItemQuantity,
  updateDraftLineItemVariant,
  type DraftProductionRateActivity,
  type DraftProductionRateLineItem,
  MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
} from '../../application/productionRateAssemblyBuilder';
import { mapProductionRateToLaborRoleKey } from '../../application/laborRoleMapping';
import { useProjectLaborRates } from '../hooks/useProjectLaborRates';
import { getAvailableDivisions } from '../../data/productionRates/productionRateLibraryQueries';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';
import { CSI_DIVISIONS } from '../../domain/csiDivisions';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../../domain/laborRateTypes';
import { useProductionRateLibrary } from '../hooks/useProductionRateLibrary';
import type {
  AddManualActivityParams,
  AddFromProductionRateAssemblyParams,
} from '../hooks/useConstructionActivities';
import ActivityInstanceFields, { buildIdentityFromForm } from './ActivityInstanceFields';
import {
  formatProductionRateDisplayTitle,
  formatProductionRateSubtitle,
} from '../../data/productionRates/productionRateDisplayFormatters';
import {
  ProductionRateSourceDetails,
  ProductionRateVariantSelector,
} from './ProductionRateCanonicalControls';

const DEFAULT_CREW_SIZE = 4;
const DEFAULT_HOURS_PER_DAY = 8;

type SourceMode = 'choose' | 'production_rate' | 'manual';
type Step = 'choose' | 'configure';
type WizardStep = 1 | 2;

interface Props {
  projectId: string;
  onConfirmProductionRate: (params: AddFromProductionRateAssemblyParams) => void;
  onConfirmManual: (params: AddManualActivityParams) => void;
  onCancel: () => void;
  saving?: boolean;
  existingActivities?: ProjectConstructionActivity[];
  projectLaborRates?: ProjectLaborRate[];
  /** Preselect a CSI division when opening from an empty division shell. */
  initialDivisionCode?: string;
}

interface ManualLineDraft {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  manHoursPerUnit: string;
  laborRoleId: string;
}

function emptyManualLine(): ManualLineDraft {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    unit: 'EA',
    quantity: '',
    manHoursPerUnit: '',
    laborRoleId: '',
  };
}

export default function AssemblyPickerModal({
  projectId,
  onConfirmProductionRate,
  onConfirmManual,
  onCancel,
  saving,
  existingActivities = [],
  projectLaborRates: projectLaborRatesProp = [],
  initialDivisionCode,
}: Props) {
  const library = useProductionRateLibrary(true);
  const {
    projectRates: loadedProjectRates,
    loading: laborRatesLoading,
    ensureProjectLaborRatesReady,
  } = useProjectLaborRates(projectId);
  const [laborRatesReady, setLaborRatesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (projectLaborRatesProp.length > 0) {
        setLaborRatesReady(true);
        return;
      }
      await ensureProjectLaborRatesReady();
      if (!cancelled) {
        setLaborRatesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureProjectLaborRatesReady, projectId, projectLaborRatesProp.length]);

  const projectLaborRates =
    projectLaborRatesProp.length > 0 ? projectLaborRatesProp : loadedProjectRates;

  const [sourceMode, setSourceMode] = useState<SourceMode>('choose');
  const [step, setStep] = useState<Step>('choose');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  const [divisionCode, setDivisionCode] = useState('');
  const [category, setCategory] = useState('');
  const [draft, setDraft] = useState<DraftProductionRateActivity | null>(null);

  const [manualDivisionCode, setManualDivisionCode] = useState('03');
  const [manualLines, setManualLines] = useState<ManualLineDraft[]>([emptyManualLine()]);

  useEffect(() => {
    const code = initialDivisionCode?.trim();
    if (!code) return;
    setSourceMode('production_rate');
    setStep('configure');
    setWizardStep(1);
    setDivisionCode(code);
    setCategory('');
  }, [initialDivisionCode]);

  const [activityName, setActivityName] = useState('');
  const [instanceLabel, setInstanceLabel] = useState('');
  const [location, setLocation] = useState('');
  const [drawingReference, setDrawingReference] = useState('');
  const [notes, setNotes] = useState('');

  const [crewSizeStr, setCrewSizeStr] = useState(String(DEFAULT_CREW_SIZE));
  const [hoursPerDayStr, setHoursPerDayStr] = useState(String(DEFAULT_HOURS_PER_DAY));
  const [durationOverrideStr, setDurationOverrideStr] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const crewSize = Math.max(1, parseInt(crewSizeStr) || DEFAULT_CREW_SIZE);
  const hoursPerDay = Math.max(0.5, parseFloat(hoursPerDayStr) || DEFAULT_HOURS_PER_DAY);
  const durationOverride =
    durationOverrideStr !== '' ? Math.max(1, parseInt(durationOverrideStr) || 1) : null;

  const crewSizeError = (parseInt(crewSizeStr) || 0) <= 0 ? 'Must be > 0' : null;
  const hoursPerDayError = (parseFloat(hoursPerDayStr) || 0) <= 0 ? 'Must be > 0' : null;
  const durationOverrideError =
    durationOverrideStr !== '' && (parseInt(durationOverrideStr) || 0) <= 0 ? 'Must be > 0' : null;
  const hasValidationError = !!crewSizeError || !!hoursPerDayError || !!durationOverrideError;

  const divisionOptions = useMemo(
    () => getAvailableDivisions(library.rates),
    [library.rates],
  );

  const categoryOptions = useMemo(
    () => library.categoryOptions({ divisionCode }),
    [library, divisionCode],
  );

  const selectedDivisionName = useMemo(() => {
    return (
      divisionOptions.find((option) => option.divisionCode === divisionCode)?.divisionName ??
      CSI_DIVISIONS.find((d) => d.code === divisionCode)?.name ??
      divisionCode
    );
  }, [divisionCode, divisionOptions]);

  const sourceTemplateKey = useMemo(() => {
    if (sourceMode === 'production_rate' && divisionCode && category) {
      return buildProductionRateCategorySourceTemplateKey(divisionCode, category);
    }
    if (sourceMode === 'manual') return MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY;
    return '';
  }, [sourceMode, divisionCode, category]);

  const identity = useMemo(
    () =>
      buildIdentityFromForm({
        activityName,
        instanceLabel,
        location,
        drawingReference,
        notes,
      }),
    [activityName, drawingReference, instanceLabel, location, notes],
  );

  const duplicateTemplateWarning = useMemo(() => {
    if (!sourceTemplateKey) return null;
    return validateInstanceLabelForDuplicateTemplate({
      existingActivities,
      sourceTemplateKey,
      instanceLabel,
    });
  }, [existingActivities, instanceLabel, sourceTemplateKey]);

  const assignedPreview = useMemo(() => {
    if (!sourceTemplateKey) return null;
    const divCode = sourceMode === 'manual' ? manualDivisionCode : divisionCode;
    if (!divCode) return null;
    return assignProjectActivityCode({
      existingActivities,
      divisionCode: divCode,
      sourceTemplateKey,
      identity,
    });
  }, [
    divisionCode,
    existingActivities,
    identity,
    manualDivisionCode,
    sourceMode,
    sourceTemplateKey,
  ]);

  useEffect(() => {
    if (sourceMode !== 'production_rate' || !divisionCode || !category || library.loading) {
      return;
    }
    const group = getAssemblyGroupForCategory(library.rates, divisionCode, category);
    if (!group) {
      setDraft(null);
      return;
    }
    setDraft(
      createDraftActivityFromAssemblyCategory({
        group,
        projectId,
        title: activityName || group.defaultTitle,
        crewSize,
        hoursPerDay,
        scheduleEnabled,
      }),
    );
  }, [
    activityName,
    category,
    crewSize,
    divisionCode,
    hoursPerDay,
    library.loading,
    library.rates,
    projectId,
    scheduleEnabled,
    sourceMode,
  ]);

  const preview = useMemo(() => {
    if (sourceMode !== 'production_rate' || !draft) return null;
    const workingDraft: DraftProductionRateActivity = {
      ...draft,
      title: activityName || draft.defaultTitle,
      crewSize,
      hoursPerDay,
      scheduleEnabled,
    };
    return previewDraftProductionRateActivity(
      workingDraft,
      projectLaborRates,
      durationOverride,
    );
  }, [
    activityName,
    crewSize,
    draft,
    durationOverride,
    hoursPerDay,
    laborRatesLoading,
    laborRatesReady,
    projectLaborRates,
    scheduleEnabled,
    sourceMode,
  ]);

  const manualPreview = useMemo(() => {
    if (sourceMode !== 'manual') return null;
    const parsedLines = manualLines
      .map((line) => ({
        description: line.description.trim(),
        unit: line.unit.trim(),
        quantity: parseFloat(line.quantity),
        manHoursPerUnit: parseFloat(line.manHoursPerUnit),
        laborRoleId: line.laborRoleId || null,
      }))
      .filter(
        (line) =>
          line.description &&
          line.unit &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0 &&
          Number.isFinite(line.manHoursPerUnit) &&
          line.manHoursPerUnit > 0,
      );

    const totalManHours = parsedLines.reduce(
      (sum, line) => sum + line.quantity * line.manHoursPerUnit,
      0,
    );
    const calculatedDurationDays =
      crewSize > 0 && hoursPerDay > 0
        ? Math.max(1, Math.ceil(totalManHours / (crewSize * hoursPerDay)))
        : 0;

    return {
      lineCount: parsedLines.length,
      totalManHours,
      calculatedDurationDays,
      effectiveDurationDays: durationOverride ?? calculatedDurationDays,
    };
  }, [crewSize, durationOverride, hoursPerDay, manualLines, sourceMode]);

  const handleChooseSource = useCallback((mode: Exclude<SourceMode, 'choose'>) => {
    setSourceMode(mode);
    setStep('configure');
    setActivityName('');
    setInstanceLabel('');
    setLocation('');
    setDrawingReference('');
    setNotes('');
    setDurationOverrideStr('');
    setCrewSizeStr(String(DEFAULT_CREW_SIZE));
    setHoursPerDayStr(String(DEFAULT_HOURS_PER_DAY));
    setScheduleEnabled(true);
    if (mode === 'production_rate') {
      setDivisionCode('');
      setCategory('');
      setDraft(null);
      setWizardStep(1);
    } else {
      setManualLines([emptyManualLine()]);
      setManualDivisionCode('03');
    }
  }, []);

  const handleDivisionChange = useCallback((code: string) => {
    setDivisionCode(code);
    setCategory('');
    setDraft(null);
    setActivityName('');
  }, []);

  const handleCategoryChange = useCallback(
    (nextCategory: string) => {
      setCategory(nextCategory);
      setActivityName(nextCategory);
    },
    [],
  );

  const setWorkElementVariant = useCallback(
    (draftId: string, nextRate: ProductionRateLibraryEntry) => {
      setDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          lineItems: current.lineItems.map((item) =>
            item.draftId === draftId ? updateDraftLineItemVariant(item, nextRate) : item,
          ),
        };
      });
    },
    [],
  );

  const toggleWorkElement = useCallback((rateId: string, selected: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        lineItems: current.lineItems.map((item) =>
          item.draftId === rateId ? { ...item, selected } : item,
        ),
      };
    });
  }, []);

  const setWorkElementQuantity = useCallback((rateId: string, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : parseFloat(rawValue);
    const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        lineItems: current.lineItems.map((item) =>
          item.draftId === rateId ? updateDraftLineItemQuantity(item, quantity) : item,
        ),
      };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (hasValidationError || duplicateTemplateWarning || !assignedPreview) return;

    if (sourceMode === 'production_rate') {
      if (!draft || !divisionCode || !category) return;
      const selected = draft.lineItems.filter((item) => item.selected && item.quantity > 0);
      if (selected.length === 0) return;

      onConfirmProductionRate({
        group: getAssemblyGroupForCategory(library.rates, divisionCode, category)!,
        selectedLineItems: selected.map((item) => ({
          rateId: item.rate.id,
          quantity: item.quantity,
        })),
        crewSize,
        hoursPerDay,
        durationDaysOverride: durationOverride,
        scheduleEnabled,
        identity: {
          ...identity,
          activityName: activityName || category,
        },
      });
      return;
    }

    if (sourceMode === 'manual') {
      const parsedLines = manualLines
        .map((line) => ({
          description: line.description.trim(),
          unit: line.unit.trim(),
          quantity: parseFloat(line.quantity),
          manHoursPerUnit: parseFloat(line.manHoursPerUnit),
          laborRoleId: line.laborRoleId || null,
        }))
        .filter(
          (line) =>
            line.description &&
            line.unit &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0 &&
            Number.isFinite(line.manHoursPerUnit) &&
            line.manHoursPerUnit > 0,
        );

      if (parsedLines.length === 0) return;

      onConfirmManual({
        divisionCode: manualDivisionCode,
        divisionName:
          CSI_DIVISIONS.find((d) => d.code === manualDivisionCode)?.name ?? manualDivisionCode,
        lineItems: parsedLines,
        crewSize,
        hoursPerDay,
        durationDaysOverride: durationOverride,
        scheduleEnabled,
        identity,
      });
    }
  }, [
    activityName,
    assignedPreview,
    category,
    crewSize,
    divisionCode,
    duplicateTemplateWarning,
    durationOverride,
    hasValidationError,
    hoursPerDay,
    identity,
    library.rates,
    manualDivisionCode,
    manualLines,
    onConfirmManual,
    onConfirmProductionRate,
    draft,
    scheduleEnabled,
    sourceMode,
  ]);

  const selectedCount =
    draft?.lineItems.filter((item) => item.selected && item.quantity > 0).length ?? 0;
  const canConfirmProduction =
    sourceMode === 'production_rate' && selectedCount > 0 && !library.loading && !!preview;
  const canConfirmManual =
    sourceMode === 'manual' && (manualPreview?.lineCount ?? 0) > 0;
  const canConfirm =
    (sourceMode === 'production_rate' ? canConfirmProduction : canConfirmManual) &&
    !hasValidationError &&
    !duplicateTemplateWarning;

  const headerTitle =
    step === 'choose'
      ? 'Add Construction Activity'
      : sourceMode === 'production_rate'
        ? 'Build from Production Rate Library'
        : 'Manual / Custom Activity';

  const progressLabel =
    step === 'configure' && sourceMode === 'production_rate'
      ? `Step ${wizardStep} of 2`
      : undefined;

  const canAdvanceWizard = Boolean(divisionCode && category);

  const modalFooter =
    step === 'configure' ? (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {sourceMode === 'production_rate' && wizardStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => setWizardStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
            >
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sourceMode === 'production_rate' && wizardStep < 2 ? (
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!canAdvanceWizard || library.loading}
              onClick={() => setWizardStep(2)}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              disabled={saving || !canConfirm}
              onClick={handleConfirm}
            >
              {saving ? 'Saving…' : 'Add to Estimate'}
            </Button>
          )}
        </div>
      </>
    ) : (
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    );

  return (
    <ModalShell
      isOpen
      onClose={onCancel}
      title={headerTitle}
      progressLabel={progressLabel}
      size="xl"
      stackAboveDrawer
      footer={modalFooter}
    >
      {step === 'choose' ? (
        <SourceChoiceStep onChoose={handleChooseSource} />
      ) : sourceMode === 'production_rate' ? (
        <ProductionRateConfigureStep
          wizardStep={wizardStep}
          libraryLoading={library.loading}
          libraryError={library.error}
          totalRates={library.totalCount}
          showSourceRecords={library.showSourceRecords}
          onShowSourceRecordsChange={library.setShowSourceRecords}
          isSourceIndex={library.isSourceIndex}
          divisionOptions={divisionOptions}
          categoryOptions={categoryOptions}
          divisionCode={divisionCode}
          category={category}
          draft={draft}
          preview={preview}
          projectLaborRates={projectLaborRates}
          laborRatesLoading={laborRatesLoading && !laborRatesReady}
          activityName={activityName}
          instanceLabel={instanceLabel}
          location={location}
          drawingReference={drawingReference}
          notes={notes}
          onDivisionChange={handleDivisionChange}
          onCategoryChange={handleCategoryChange}
          onToggleWorkElement={toggleWorkElement}
          onQuantityChange={setWorkElementQuantity}
          onVariantChange={setWorkElementVariant}
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
          scheduleEnabled={scheduleEnabled}
          onCrewSizeChange={setCrewSizeStr}
          onHoursPerDayChange={setHoursPerDayStr}
          onDurationOverrideChange={setDurationOverrideStr}
          onScheduleEnabledChange={setScheduleEnabled}
          crewSizeError={crewSizeError}
          hoursPerDayError={hoursPerDayError}
          durationOverrideError={durationOverrideError}
        />
      ) : (
        <ManualConfigureStep
          divisionCode={manualDivisionCode}
          divisionName={selectedDivisionName}
          lines={manualLines}
          preview={manualPreview}
          projectLaborRates={projectLaborRates}
          activityName={activityName}
          instanceLabel={instanceLabel}
          location={location}
          drawingReference={drawingReference}
          notes={notes}
          onDivisionChange={setManualDivisionCode}
          onLinesChange={setManualLines}
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
          scheduleEnabled={scheduleEnabled}
          onCrewSizeChange={setCrewSizeStr}
          onHoursPerDayChange={setHoursPerDayStr}
          onDurationOverrideChange={setDurationOverrideStr}
          onScheduleEnabledChange={setScheduleEnabled}
          crewSizeError={crewSizeError}
          hoursPerDayError={hoursPerDayError}
          durationOverrideError={durationOverrideError}
        />
      )}
    </ModalShell>
  );
}

function SourceChoiceStep({
  onChoose,
}: {
  onChoose: (mode: Exclude<SourceMode, 'choose'>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChoose('production_rate')}
        className="rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-cyan-600 dark:hover:bg-cyan-900/20"
      >
        <BookOpen size={22} className="mb-3 text-cyan-600 dark:text-cyan-400" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Build from Production Rate Library
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Pick an approved division category, select work elements, enter quantities, and price labor.
        </p>
      </button>
      <button
        type="button"
        onClick={() => onChoose('manual')}
        className="rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-cyan-600 dark:hover:bg-cyan-900/20"
      >
        <PenLine size={22} className="mb-3 text-slate-600 dark:text-slate-300" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Manual / Custom Activity
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Enter your own activity title, line items, units, man-hour rates, and labor roles.
        </p>
      </button>
    </div>
  );
}

function CrewScheduleFields(props: {
  crewSizeStr: string;
  hoursPerDayStr: string;
  durationOverrideStr: string;
  scheduleEnabled: boolean;
  onCrewSizeChange: (value: string) => void;
  onHoursPerDayChange: (value: string) => void;
  onDurationOverrideChange: (value: string) => void;
  onScheduleEnabledChange: (value: boolean) => void;
  crewSizeError: string | null;
  hoursPerDayError: string | null;
  durationOverrideError: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/30">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Crew &amp; Schedule
        </p>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={props.scheduleEnabled}
            onChange={(e) => props.onScheduleEnabledChange(e.target.checked)}
            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Schedule enabled
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Crew Size"
          value={props.crewSizeStr}
          onChange={props.onCrewSizeChange}
          error={props.crewSizeError}
        />
        <NumberField
          label="Hours / Day"
          value={props.hoursPerDayStr}
          onChange={props.onHoursPerDayChange}
          error={props.hoursPerDayError}
          step="0.5"
        />
        <NumberField
          label="Duration Override"
          value={props.durationOverrideStr}
          onChange={props.onDurationOverrideChange}
          error={props.durationOverrideError}
          placeholder="calc'd"
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  error,
  placeholder,
  step = '1',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-slate-100 ${
          error ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'
        }`}
      />
      {error && <p className="mt-0.5 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function ProductionRateConfigureStep({
  wizardStep = 2,
  libraryLoading,
  libraryError,
  totalRates,
  showSourceRecords,
  onShowSourceRecordsChange,
  isSourceIndex,
  divisionOptions,
  categoryOptions,
  divisionCode,
  category,
  draft,
  preview,
  projectLaborRates,
  laborRatesLoading,
  activityName,
  instanceLabel,
  location,
  drawingReference,
  notes,
  onDivisionChange,
  onCategoryChange,
  onToggleWorkElement,
  onQuantityChange,
  onVariantChange,
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
  scheduleEnabled,
  onCrewSizeChange,
  onHoursPerDayChange,
  onDurationOverrideChange,
  onScheduleEnabledChange,
  crewSizeError,
  hoursPerDayError,
  durationOverrideError,
}: {
  wizardStep?: WizardStep;
  libraryLoading: boolean;
  libraryError: string | null;
  totalRates: number;
  showSourceRecords: boolean;
  onShowSourceRecordsChange: (value: boolean) => void;
  isSourceIndex: boolean;
  divisionOptions: ReturnType<typeof getAvailableDivisions>;
  categoryOptions: string[];
  divisionCode: string;
  category: string;
  draft: DraftProductionRateActivity | null;
  preview: ReturnType<typeof previewDraftProductionRateActivity> | null;
  projectLaborRates: ProjectLaborRate[];
  laborRatesLoading: boolean;
  activityName: string;
  instanceLabel: string;
  location: string;
  drawingReference: string;
  notes: string;
  onDivisionChange: (code: string) => void;
  onCategoryChange: (category: string) => void;
  onToggleWorkElement: (rateId: string, selected: boolean) => void;
  onQuantityChange: (rateId: string, value: string) => void;
  onVariantChange: (draftId: string, nextRate: ProductionRateLibraryEntry) => void;
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
  scheduleEnabled: boolean;
  onCrewSizeChange: (value: string) => void;
  onHoursPerDayChange: (value: string) => void;
  onDurationOverrideChange: (value: string) => void;
  onScheduleEnabledChange: (value: boolean) => void;
  crewSizeError: string | null;
  hoursPerDayError: string | null;
  durationOverrideError: string | null;
}) {
  const [showDevSourceDetails, setShowDevSourceDetails] = useState(false);

  if (libraryLoading) {
    return <p className="text-sm text-slate-500">Loading approved production rates…</p>;
  }
  if (libraryError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        {libraryError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {totalRates.toLocaleString()} approved production rates available
          {isSourceIndex ? ' (source records — debug)' : ''}
        </p>
       
      </div>

      {wizardStep === 1 ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Division
            </label>
            <select
              value={divisionCode}
              onChange={(e) => onDivisionChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select division…</option>
              {divisionOptions.map((option) => (
                <option key={option.divisionCode} value={option.divisionCode}>
                  Division {option.divisionCode} — {option.divisionName} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Activity Category
            </label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={!divisionCode}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select category…</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {wizardStep === 2 && draft ? (
        <>
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

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Work Elements
            </p>
            {draft.lineItems.map((item) => (
              <WorkElementRow
                key={item.draftId}
                item={item}
                projectLaborRates={projectLaborRates}
                laborRatesLoading={laborRatesLoading}
                showDevSourceDetails={showDevSourceDetails}
                previewLineItem={preview?.projectLineItems.find(
                  (line) => line.sourceProductionRateKey === item.rate.id,
                )}
                onToggle={(selected) => onToggleWorkElement(item.draftId, selected)}
                onQuantityChange={(value) => onQuantityChange(item.draftId, value)}
                onVariantChange={(nextRate) => onVariantChange(item.draftId, nextRate)}
                showQuantity
              />
            ))}
          </div>

          <CrewScheduleFields
            crewSizeStr={crewSizeStr}
            hoursPerDayStr={hoursPerDayStr}
            durationOverrideStr={durationOverrideStr}
            scheduleEnabled={scheduleEnabled}
            onCrewSizeChange={onCrewSizeChange}
            onHoursPerDayChange={onHoursPerDayChange}
            onDurationOverrideChange={onDurationOverrideChange}
            onScheduleEnabledChange={onScheduleEnabledChange}
            crewSizeError={crewSizeError}
            hoursPerDayError={hoursPerDayError}
            durationOverrideError={durationOverrideError}
          />

          {preview && (
            <ActivityPreviewSummary
              preview={preview}
              crewSizeStr={crewSizeStr}
              hoursPerDayStr={hoursPerDayStr}
              durationOverrideStr={durationOverrideStr}
              durationOverrideError={durationOverrideError}
            />
          )}
        </>
      ) : wizardStep === 2 ? (
        <p className="text-sm text-slate-500">Select a division and activity category to continue.</p>
      ) : null}
    </div>
  );
}

function WorkElementRow({
  item,
  projectLaborRates,
  laborRatesLoading,
  showDevSourceDetails,
  previewLineItem,
  onToggle,
  onQuantityChange,
  onVariantChange,
  showQuantity = true,
}: {
  item: DraftProductionRateLineItem;
  projectLaborRates: ProjectLaborRate[];
  laborRatesLoading: boolean;
  showDevSourceDetails: boolean;
  showQuantity?: boolean;
  previewLineItem?: {
    calculatedManHours: number;
    laborCost: number;
    laborRoleName?: string | null;
    laborRoleKey?: string | null;
    fullyBurdenedRateSnapshot: number;
  };
  onToggle: (selected: boolean) => void;
  onQuantityChange: (value: string) => void;
  onVariantChange: (nextRate: ProductionRateLibraryEntry) => void;
}) {
  const mappedRoleKey = mapProductionRateToLaborRoleKey(item.rate);
  const displayTitle = formatProductionRateDisplayTitle(item.rate);
  const subtitle = formatProductionRateSubtitle(item.rate, { includeCrew: true });
  const missingLaborRate =
    !laborRatesLoading &&
    !!previewLineItem &&
    previewLineItem.calculatedManHours > 0 &&
    previewLineItem.fullyBurdenedRateSnapshot <= 0;
  const usingFallback =
    !!previewLineItem?.laborRoleKey &&
    mappedRoleKey !== previewLineItem.laborRoleKey &&
    previewLineItem.fullyBurdenedRateSnapshot > 0;

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{displayTitle}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
          <ProductionRateVariantSelector
            entry={item.rate}
            onVariantChange={onVariantChange}
            className="mt-2 max-w-md"
          />
          <ProductionRateSourceDetails
            entry={item.rate}
            className="mt-2"
            enabled={showDevSourceDetails}
          />
          {missingLaborRate && item.selected && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={11} /> Missing labor rate
            </p>
          )}
        </div>
        {item.selected && showQuantity ? (
          <div className="w-28 shrink-0">
            <label className="mb-1 block text-[10px] text-slate-500">
              Quantity ({item.rate.unitOfMeasure})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={item.quantity || ''}
              onChange={(e) => onQuantityChange(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        ) : null}
      </div>
      {showQuantity && item.selected && item.quantity > 0 && previewLineItem && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800">
          <span>{previewLineItem.calculatedManHours.toFixed(2)} MH</span>
          <span>
            Labor: {previewLineItem.laborRoleName ?? '—'} · $
            {previewLineItem.fullyBurdenedRateSnapshot.toFixed(2)}/hr
          </span>
          {usingFallback ? (
            <span className="text-slate-400">Using {previewLineItem.laborRoleName}</span>
          ) : null}
          <span>${previewLineItem.laborCost.toFixed(2)} labor</span>
        </div>
      )}
    </div>
  );
}

function ManualConfigureStep({
  divisionCode,
  lines,
  preview,
  projectLaborRates,
  activityName,
  instanceLabel,
  location,
  drawingReference,
  notes,
  onDivisionChange,
  onLinesChange,
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
  scheduleEnabled,
  onCrewSizeChange,
  onHoursPerDayChange,
  onDurationOverrideChange,
  onScheduleEnabledChange,
  crewSizeError,
  hoursPerDayError,
  durationOverrideError,
}: {
  divisionCode: string;
  divisionName: string;
  lines: ManualLineDraft[];
  preview: { lineCount: number; totalManHours: number; effectiveDurationDays: number } | null;
  projectLaborRates: ProjectLaborRate[];
  activityName: string;
  instanceLabel: string;
  location: string;
  drawingReference: string;
  notes: string;
  onDivisionChange: (code: string) => void;
  onLinesChange: (lines: ManualLineDraft[]) => void;
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
  scheduleEnabled: boolean;
  onCrewSizeChange: (value: string) => void;
  onHoursPerDayChange: (value: string) => void;
  onDurationOverrideChange: (value: string) => void;
  onScheduleEnabledChange: (value: boolean) => void;
  crewSizeError: string | null;
  hoursPerDayError: string | null;
  durationOverrideError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Division
        </label>
        <select
          value={divisionCode}
          onChange={(e) => onDivisionChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {CSI_DIVISIONS.map((division) => (
            <option key={division.code} value={division.code}>
              {division.label}
            </option>
          ))}
        </select>
      </div>

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manual Line Items
          </p>
          <button
            type="button"
            onClick={() => onLinesChange([...lines, emptyManualLine()])}
            className="text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
          >
            + Add line item
          </button>
        </div>
        {lines.map((line, index) => (
          <div
            key={line.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700"
          >
            <input
              value={line.description}
              onChange={(e) =>
                onLinesChange(
                  lines.map((entry, i) =>
                    i === index ? { ...entry, description: e.target.value } : entry,
                  ),
                )
              }
              placeholder="Description"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
            />
            <input
              value={line.quantity}
              onChange={(e) =>
                onLinesChange(
                  lines.map((entry, i) =>
                    i === index ? { ...entry, quantity: e.target.value } : entry,
                  ),
                )
              }
              placeholder="Quantity"
              type="number"
              min="0"
              step="any"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              value={line.unit}
              onChange={(e) =>
                onLinesChange(
                  lines.map((entry, i) =>
                    i === index ? { ...entry, unit: e.target.value } : entry,
                  ),
                )
              }
              placeholder="Unit"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              value={line.manHoursPerUnit}
              onChange={(e) =>
                onLinesChange(
                  lines.map((entry, i) =>
                    i === index ? { ...entry, manHoursPerUnit: e.target.value } : entry,
                  ),
                )
              }
              placeholder="MH / unit"
              type="number"
              min="0"
              step="any"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <select
              value={line.laborRoleId}
              onChange={(e) =>
                onLinesChange(
                  lines.map((entry, i) =>
                    i === index ? { ...entry, laborRoleId: e.target.value } : entry,
                  ),
                )
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Labor role…</option>
              {projectLaborRates
                .filter((rate) => rate.isActive)
                .map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.roleName}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>

      <CrewScheduleFields
        crewSizeStr={crewSizeStr}
        hoursPerDayStr={hoursPerDayStr}
        durationOverrideStr={durationOverrideStr}
        scheduleEnabled={scheduleEnabled}
        onCrewSizeChange={onCrewSizeChange}
        onHoursPerDayChange={onHoursPerDayChange}
        onDurationOverrideChange={onDurationOverrideChange}
        onScheduleEnabledChange={onScheduleEnabledChange}
        crewSizeError={crewSizeError}
        hoursPerDayError={hoursPerDayError}
        durationOverrideError={durationOverrideError}
      />

      {preview && preview.lineCount > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          {preview.totalManHours.toFixed(1)} MH · {preview.lineCount} items ·{' '}
          {preview.effectiveDurationDays}d · Manual pricing
        </div>
      )}
    </div>
  );
}

function ActivityPreviewSummary({
  preview,
  crewSizeStr,
  hoursPerDayStr,
  durationOverrideStr,
  durationOverrideError,
}: {
  preview: ReturnType<typeof previewDraftProductionRateActivity>;
  crewSizeStr: string;
  hoursPerDayStr: string;
  durationOverrideStr: string;
  durationOverrideError: string | null;
}) {
  const hasOverride = durationOverrideStr !== '' && !durationOverrideError;
  const effectiveDuration = hasOverride
    ? parseInt(durationOverrideStr)
    : preview.rollup.calculatedDurationDays;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Activity Preview
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Work Elements', value: `${preview.projectLineItems.length}` },
          { label: 'Man-Hours', value: preview.rollup.totalManHours.toFixed(1) },
          { label: 'Labor Cost', value: `$${preview.rollup.totalLaborCost.toFixed(2)}` },
          { label: 'Duration', value: `${effectiveDuration}d` },
          { label: 'Crew', value: crewSizeStr },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded border border-slate-200 bg-white p-2 text-center dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-[10px] uppercase text-slate-400">{stat.label}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{stat.value}</p>
          </div>
        ))}
      </div>
      {preview.rollup.totalManHours > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          {preview.rollup.totalManHours.toFixed(1)} MH ÷ ({crewSizeStr} crew × {hoursPerDayStr}h/day)
          {' = '}
          <strong>{preview.rollup.calculatedDurationDays}d</strong>
        </p>
      )}
      {preview.laborRoleWarnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {preview.laborRoleWarnings.map((warning) => (
            <p key={warning} className="text-[11px] text-amber-600 dark:text-amber-400">
              • {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
