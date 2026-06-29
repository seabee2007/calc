import { useCallback, useMemo, useRef, useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { assignProjectActivityCode } from '../../application/constructionActivityCoding';
import type {
  LineItemProductionRateAssignmentUpdate,
  UpdateProjectActivityInput,
} from '../../application/constructionActivityService';
import ActivityInstanceFields, { buildIdentityFromForm } from './ActivityInstanceFields';
import { useProjectLaborRates } from '../hooks/useProjectLaborRates';
import { resolveLaborRateForWorkElement, workElementFromLineItem } from '../../application/laborRateResolver';
import { isLineItemUnpricedForLabor } from '../../domain/constructionActivityCalculations';
import { roundToTwo } from '../../domain/estimateMath';
import { useSubscription } from '../../../../contexts/SubscriptionContext';
import ArdenCalcOverlay from './ArdenCalcOverlay';
import { usePrefersTouchLayout } from '../hooks/usePrefersTouchLayout';
import { Calculator } from 'lucide-react';
import { useProductionRateLibrary } from '../hooks/useProductionRateLibrary';
import type { ProductionRateLibraryEntry } from '../../data/productionRates/productionRateTypes';
import { mapProductionRateToLaborRoleKey } from '../../application/laborRoleMapping';
import {
  areProductionRateUnitsCompatible,
  convertQuantityForProductionRateUnit,
} from '../../application/matchQuantityToProductionRates';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

type LineItemAssignmentDraft =
  | { mode: 'production_rate'; productionRateId: string }
  | {
      mode: 'manual_override';
      manHoursPerUnit: string;
      reason: string;
      sourceNote: string;
    }
  | { mode: 'unassigned' };

function parseQuantity(value: string | undefined, fallback: number): number {
  return value !== undefined && value !== '' ? parseFloat(value) || 0 : fallback;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productionRateTitle(rate: ProductionRateLibraryEntry): string {
  return rate.canonicalTitle ?? rate.activityName;
}

function productionRateLabel(rate: ProductionRateLibraryEntry): string {
  const manHours = rate.manHoursPerUnit ?? 0;
  return `${productionRateTitle(rate)} - ${manHours.toFixed(3)} MH/${rate.unitOfMeasure}`;
}

function lineItemHasResolvedProductionRate(item: ProjectActivityLineItem): boolean {
  return !isLineItemUnpricedForLabor(item);
}

interface Props {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  onSave: (input: UpdateProjectActivityInput) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function EditConstructionActivityModal({
  activity,
  lineItems,
  onSave,
  onCancel,
  saving,
}: Props) {
  const [activityName, setActivityName] = useState(activity.baseTitle ?? activity.title);
  const [instanceLabel, setInstanceLabel] = useState(activity.instanceLabel ?? '');
  const [location, setLocation] = useState(activity.location ?? '');
  const [drawingReference, setDrawingReference] = useState(activity.drawingReference ?? '');
  const [notes, setNotes] = useState(activity.notes ?? '');
  const [crewSizeStr, setCrewSizeStr] = useState(String(activity.crewSize));
  const [hoursPerDayStr, setHoursPerDayStr] = useState(String(activity.hoursPerDay));
  const [durationOverrideStr, setDurationOverrideStr] = useState(
    activity.durationDaysOverride != null ? String(activity.durationDaysOverride) : '',
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(activity.scheduleEnabled);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(lineItems.map((item) => [item.id, String(item.quantity)])),
  );
  const [expandedPricing, setExpandedPricing] = useState<Record<string, boolean>>({});
  const [laborRoles, setLaborRoles] = useState<Record<string, string>>(
    Object.fromEntries(
      lineItems.map((item) => [item.id, item.laborRoleId ?? '']),
    ),
  );
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, LineItemAssignmentDraft>>({});
  const [productionRateSearch, setProductionRateSearch] = useState<Record<string, string>>({});
  const [focusedQuantityId, setFocusedQuantityId] = useState<string | null>(
    lineItems[0]?.id ?? null,
  );
  const [calcOpen, setCalcOpen] = useState(false);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sectionLauncherRef = useRef<HTMLButtonElement>(null);
  const prefersTouch = usePrefersTouchLayout();
  const { hasFeature } = useSubscription();
  const calcEnabled = hasFeature('arden_calc_in_estimator');

  const { projectRates, loading: ratesLoading } = useProjectLaborRates(activity.projectId);
  const productionRateLibrary = useProductionRateLibrary(true);
  const productionRateById = useMemo(
    () => new Map(productionRateLibrary.rates.map((rate) => [rate.id, rate])),
    [productionRateLibrary.rates],
  );

  const candidateProductionRatesByLineItem = useMemo(() => {
    const byLineItem = new Map<string, ProductionRateLibraryEntry[]>();
    lineItems.forEach((item) => {
      const search = (productionRateSearch[item.id] ?? '').trim().toLowerCase();
      const candidates = productionRateLibrary.rates
        .filter((rate) => {
          const manHours = rate.manHoursPerUnit ?? 0;
          if (manHours <= 0) return false;
          if (rate.divisionCode !== activity.divisionCode) return false;
          if (!areProductionRateUnitsCompatible(item.unit, rate.unitOfMeasure)) return false;
          if (!search) return true;
          return [
            productionRateTitle(rate),
            rate.description,
            rate.category,
            rate.subcategory,
            rate.figureTitle,
            rate.unitOfMeasure,
            ...(rate.keywords ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search);
        })
        .slice(0, 80);
      byLineItem.set(item.id, candidates);
    });
    return byLineItem;
  }, [activity.divisionCode, lineItems, productionRateLibrary.rates, productionRateSearch]);

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

  const preview = useMemo(
    () =>
      assignProjectActivityCode({
        existingActivities: [activity],
        divisionCode: activity.divisionCode,
        sourceTemplateKey: activity.sourceTemplateKey ?? activity.templateId ?? '',
        identity,
        preserveActivityCode: activity.activityCode,
        excludeActivityId: activity.id,
      }),
    [activity, identity],
  );

  const handleUseCalculatorResult = useCallback(
    (value: number) => {
      if (!focusedQuantityId) return false;
      setQuantities((current) => ({
        ...current,
        [focusedQuantityId]: String(value),
      }));
      return true;
    },
    [focusedQuantityId],
  );

  const openCalcForField = useCallback((fieldId: string) => {
    if (!calcEnabled) return;
    setFocusedQuantityId(fieldId);
    setCalcOpen(true);
  }, [calcEnabled]);

  const closeCalc = useCallback(() => {
    setCalcOpen(false);
    window.requestAnimationFrame(() => {
      if (focusedQuantityId && quantityInputRefs.current[focusedQuantityId]) {
        quantityInputRefs.current[focusedQuantityId]?.focus();
        return;
      }
      sectionLauncherRef.current?.focus();
    });
  }, [focusedQuantityId]);

  const resolveDraftAssignment = useCallback(
    (item: ProjectActivityLineItem): LineItemProductionRateAssignmentUpdate | null => {
      const draft = assignmentDrafts[item.id];
      if (!draft) return null;
      if (draft.mode === 'unassigned') {
        return { status: 'unassigned' };
      }
      if (draft.mode === 'production_rate') {
        const productionRate = productionRateById.get(draft.productionRateId);
        if (!productionRate || (productionRate.manHoursPerUnit ?? 0) <= 0) return null;
        if (!areProductionRateUnitsCompatible(item.unit, productionRate.unitOfMeasure)) return null;
        return {
          status: 'verified_rate',
          productionRate,
          matchConfidence: null,
          matchReason: 'Assigned in Edit Construction Activity.',
        };
      }
      const manHoursPerUnit = parsePositiveNumber(draft.manHoursPerUnit);
      if (!manHoursPerUnit || !draft.reason.trim() || !draft.sourceNote.trim()) return null;
      return {
        status: 'manual_override',
        manHoursPerUnit,
        reason: draft.reason.trim(),
        sourceNote: draft.sourceNote.trim(),
      };
    },
    [assignmentDrafts, productionRateById],
  );

  const isLineItemResolvedForSchedule = useCallback(
    (item: ProjectActivityLineItem, quantity: number): boolean => {
      if (quantity <= 0) return true;
      const draft = assignmentDrafts[item.id];
      if (!draft) return lineItemHasResolvedProductionRate(item);
      const assignment = resolveDraftAssignment(item);
      return assignment?.status === 'verified_rate' || assignment?.status === 'manual_override';
    },
    [assignmentDrafts, resolveDraftAssignment],
  );

  const unresolvedScheduleLineItems = useMemo(() => {
    if (!scheduleEnabled) return [];
    return lineItems.filter((item) => {
      const quantity = parseQuantity(quantities[item.id], item.quantity);
      return !isLineItemResolvedForSchedule(item, quantity);
    });
  }, [isLineItemResolvedForSchedule, lineItems, quantities, scheduleEnabled]);

  const assignmentDraftErrors = useMemo(
    () =>
      lineItems.filter((item) => {
        const draft = assignmentDrafts[item.id];
        if (!draft || draft.mode === 'unassigned') return false;
        return !resolveDraftAssignment(item);
      }),
    [assignmentDrafts, lineItems, resolveDraftAssignment],
  );

  const saveDisabled =
    Boolean(saving) ||
    !activityName.trim() ||
    assignmentDraftErrors.length > 0 ||
    unresolvedScheduleLineItems.length > 0;

  const handleSave = useCallback(async () => {
    const crewSize = Math.max(1, parseInt(crewSizeStr, 10) || activity.crewSize);
    const hoursPerDay = Math.max(0.5, parseFloat(hoursPerDayStr) || activity.hoursPerDay);
    const durationDaysOverride =
      durationOverrideStr.trim() === ''
        ? null
        : Math.max(1, parseInt(durationOverrideStr, 10) || 1);

    const lineItemQuantities: Record<string, number> = {};
    const lineItemLaborRoles: Record<string, string | null> = {};
    const lineItemProductionRateAssignments: Record<string, LineItemProductionRateAssignmentUpdate> = {};
    for (const item of lineItems) {
      const raw = quantities[item.id];
      lineItemQuantities[item.id] = parseQuantity(raw, item.quantity);
      lineItemLaborRoles[item.id] = laborRoles[item.id] || null;
      const assignment = resolveDraftAssignment(item);
      if (assignment) {
        lineItemProductionRateAssignments[item.id] = assignment;
      }
    }

    await onSave({
      activity,
      lineItems,
      identity,
      crewSize,
      hoursPerDay,
      durationDaysOverride,
      scheduleEnabled,
      lineItemQuantities,
      lineItemLaborRoles,
      lineItemProductionRateAssignments:
        Object.keys(lineItemProductionRateAssignments).length > 0
          ? lineItemProductionRateAssignments
          : undefined,
    });
  }, [
    activity,
    crewSizeStr,
    durationOverrideStr,
    hoursPerDayStr,
    identity,
    lineItems,
    laborRoles,
    onSave,
    quantities,
    resolveDraftAssignment,
    scheduleEnabled,
  ]);

  return (
    <Modal isOpen onClose={onCancel} title="Edit Construction Activity" size="lg">
      <div className="space-y-4">
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{activity.activityCode}</p>

        <ActivityInstanceFields
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
          previewTitle={preview.title}
          previewCode={activity.activityCode}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Crew Size</span>
            <input className={FIELD_CLASS} value={crewSizeStr} onChange={(e) => setCrewSizeStr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Hours / Day</span>
            <input className={FIELD_CLASS} value={hoursPerDayStr} onChange={(e) => setHoursPerDayStr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Duration Override (days)
            </span>
            <input
              className={FIELD_CLASS}
              value={durationOverrideStr}
              onChange={(e) => setDurationOverrideStr(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
          />
          Include on schedule (Logic Network / CPM)
        </label>

        <div>
      
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_36px_60px] items-center gap-2">
                <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.name}</span>
                <input
                  ref={(el) => {
                    quantityInputRefs.current[item.id] = el;
                  }}
                  className={FIELD_CLASS}
                  value={quantities[item.id] ?? ''}
                  onFocus={() => setFocusedQuantityId(item.id)}
                  onChange={(e) => setQuantities((current) => ({ ...current, [item.id]: e.target.value }))}
                />
                {calcEnabled ? (
                  <button
                    type="button"
                    onClick={() => openCalcForField(item.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400"
                    aria-label={`Open Arden Calc for ${item.name}`}
                    data-testid={`arden-calc-launcher-${item.id}`}
                  >
                    <Calculator className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span className="inline-flex h-8 w-8 shrink-0" aria-hidden />
                )}
                <span className="text-xs text-slate-500">{item.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pricing
          </p>
          {ratesLoading ? (
            <p className="text-xs text-slate-500">Loading project labor rates…</p>
          ) : projectRates.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              No project labor rates yet. Initialize the schedule in Estimate Settings.
            </p>
          ) : (
            <div className="space-y-2">
              {lineItems.map((item) => {
                const quantity = parseQuantity(quantities[item.id], item.quantity);
                const assignmentDraft = assignmentDrafts[item.id];
                const selectedProductionRate =
                  assignmentDraft?.mode === 'production_rate'
                    ? productionRateById.get(assignmentDraft.productionRateId) ?? null
                    : null;
                const manualManHoursPerUnit =
                  assignmentDraft?.mode === 'manual_override'
                    ? parsePositiveNumber(assignmentDraft.manHoursPerUnit)
                    : null;
                const effectiveManHoursPerUnit =
                  selectedProductionRate?.manHoursPerUnit ?? manualManHoursPerUnit ?? item.manHoursPerUnit;
                const quantityForLabor =
                  selectedProductionRate
                    ? convertQuantityForProductionRateUnit(
                        quantity,
                        item.unit,
                        selectedProductionRate.unitOfMeasure,
                      ) ?? quantity
                    : quantity;
                const effectiveUnit = selectedProductionRate?.unitOfMeasure ?? item.unit;
                const manHours = quantityForLabor * effectiveManHoursPerUnit * item.productionFactor;
                const resolved = resolveLaborRateForWorkElement({
                  workElement: selectedProductionRate ?? workElementFromLineItem(item),
                  projectLaborRates: projectRates,
                  preferredRoleId: laborRoles[item.id] || null,
                });
                const laborCost =
                  resolved.fullyBurdenedRateSnapshot > 0
                    ? roundToTwo(manHours * resolved.fullyBurdenedRateSnapshot)
                    : 0;
                const assignmentResolved = assignmentDraft
                  ? Boolean(resolveDraftAssignment(item))
                  : lineItemHasResolvedProductionRate(item);
                const missingProductionRate = !assignmentResolved && quantity > 0;
                const laborSummaryLabel = laborCost > 0
                  ? `$${laborCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} labor`
                  : missingProductionRate
                    ? 'Needs production rate'
                    : manHours > 0 && resolved.fullyBurdenedRateSnapshot <= 0
                      ? 'Needs labor pricing'
                      : 'No labor cost';
                const isOpen = expandedPricing[item.id] ?? false;
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                      onClick={() =>
                        setExpandedPricing((current) => ({
                          ...current,
                          [item.id]: !isOpen,
                        }))
                      }
                    >
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {item.name}
                      </span>
                      <span className="text-xs text-cyan-700 dark:text-cyan-400">
                        {laborSummaryLabel}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2 dark:border-slate-700">
                        {missingProductionRate ? (
                          <p className="sm:col-span-2 text-xs text-amber-600 dark:text-amber-300">
                            Missing production rate — labor cost cannot be calculated.
                          </p>
                        ) : null}
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs text-slate-500">Assigned work element</p>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {selectedProductionRate
                                  ? productionRateTitle(selectedProductionRate)
                                  : assignmentDraft?.mode === 'manual_override'
                                    ? 'Manual MH/unit override'
                                    : item.sourceProductionRateLabel ?? item.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400"
                                onClick={() =>
                                  setAssignmentDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      mode: 'production_rate',
                                      productionRateId:
                                        selectedProductionRate?.id ??
                                        (item.productionRateId && productionRateById.has(item.productionRateId)
                                          ? item.productionRateId
                                          : null) ??
                                        candidateProductionRatesByLineItem.get(item.id)?.[0]?.id ??
                                        '',
                                    },
                                  }))
                                }
                              >
                                {lineItemHasResolvedProductionRate(item) || selectedProductionRate
                                  ? 'Change Work Element'
                                  : 'Assign Work Element'}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400"
                                onClick={() =>
                                  setAssignmentDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      mode: 'manual_override',
                                      manHoursPerUnit:
                                        item.manHoursPerUnit > 0 ? String(item.manHoursPerUnit) : '',
                                      reason: item.manualProductionRateReason ?? '',
                                      sourceNote: item.manualProductionRateSourceNote ?? '',
                                    },
                                  }))
                                }
                              >
                                Manual MH/Unit Override
                              </button>
                              {assignmentDraft ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-400 hover:text-rose-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-rose-500/50 dark:hover:text-rose-300"
                                  onClick={() =>
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [item.id]: { mode: 'unassigned' },
                                    }))
                                  }
                                >
                                  Clear Assignment
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {assignmentDraft?.mode === 'production_rate' ? (() => {
                            const candidates = candidateProductionRatesByLineItem.get(item.id) ?? [];
                            const selectableRates =
                              selectedProductionRate &&
                              !candidates.some((candidate) => candidate.id === selectedProductionRate.id)
                                ? [selectedProductionRate, ...candidates]
                                : candidates;
                            return (
                              <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                                <input
                                  className={FIELD_CLASS}
                                  value={productionRateSearch[item.id] ?? ''}
                                  onChange={(event) =>
                                    setProductionRateSearch((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Search work elements"
                                />
                                <select
                                  className={FIELD_CLASS}
                                  value={assignmentDraft.productionRateId}
                                  onChange={(event) => {
                                    const productionRate = productionRateById.get(event.target.value);
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [item.id]: {
                                        mode: 'production_rate',
                                        productionRateId: event.target.value,
                                      },
                                    }));
                                    if (!productionRate) return;
                                    const roleKey = mapProductionRateToLaborRoleKey(productionRate);
                                    const projectRate = projectRates.find((rate) => rate.roleKey === roleKey);
                                    if (projectRate) {
                                      setLaborRoles((current) => ({
                                        ...current,
                                        [item.id]: projectRate.id,
                                      }));
                                    }
                                  }}
                                >
                                  <option value="">Select approved production rate...</option>
                                  {selectableRates.map((rate) => (
                                    <option key={rate.id} value={rate.id}>
                                      {productionRateLabel(rate)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })() : null}
                          {assignmentDraft?.mode === 'manual_override' ? (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <label className="block">
                                <span className="mb-1 block text-xs text-slate-500">MH / Unit</span>
                                <input
                                  className={FIELD_CLASS}
                                  value={assignmentDraft.manHoursPerUnit}
                                  onChange={(event) =>
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [item.id]: {
                                        ...assignmentDraft,
                                        manHoursPerUnit: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-slate-500">Reason</span>
                                <input
                                  className={FIELD_CLASS}
                                  value={assignmentDraft.reason}
                                  onChange={(event) =>
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [item.id]: {
                                        ...assignmentDraft,
                                        reason: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-slate-500">Source note</span>
                                <input
                                  className={FIELD_CLASS}
                                  value={assignmentDraft.sourceNote}
                                  onChange={(event) =>
                                    setAssignmentDrafts((current) => ({
                                      ...current,
                                      [item.id]: {
                                        ...assignmentDraft,
                                        sourceNote: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          ) : null}
                          {productionRateLibrary.loading ? (
                            <p className="text-xs text-slate-500">Loading approved production rates...</p>
                          ) : productionRateLibrary.error ? (
                            <p className="text-xs text-rose-600 dark:text-rose-300">
                              {productionRateLibrary.error}
                            </p>
                          ) : assignmentDraft?.mode === 'production_rate' &&
                            (candidateProductionRatesByLineItem.get(item.id)?.length ?? 0) === 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-300">
                              No approved rates in division {activity.divisionCode} match unit {item.unit}.
                            </p>
                          ) : null}
                        </div>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-xs text-slate-500">Labor role</span>
                          <select
                            className={FIELD_CLASS}
                            value={laborRoles[item.id] ?? ''}
                            onChange={(event) =>
                              setLaborRoles((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select role…</option>
                            {projectRates.map((rate) => (
                              <option key={rate.id} value={rate.id}>
                                {rate.roleName} ({rate.tradeCategory})
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <p className="text-xs text-slate-500">Base rate</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {resolved.projectRate
                              ? `$${resolved.projectRate.hourlyRate.toFixed(2)}/hr`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Burden</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {resolved.projectRate ? `${resolved.projectRate.burdenPercent}%` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Fully burdened rate</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {resolved.fullyBurdenedRateSnapshot > 0
                              ? `$${resolved.fullyBurdenedRateSnapshot.toFixed(2)}/hr`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Resolved role</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {resolved.laborRoleName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Man-hours</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {manHours.toFixed(2)} MH ({effectiveManHoursPerUnit.toFixed(3)} MH/{effectiveUnit})
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs text-slate-500">Labor cost</p>
                          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                            ${laborCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {assignmentDraftErrors.length > 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Complete the production-rate assignment or manual override details for:{' '}
            {assignmentDraftErrors.map((item) => item.name).join(', ')}.
          </p>
        ) : null}
        {unresolvedScheduleLineItems.length > 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Assign a work element or documented manual override before scheduling:{' '}
            {unresolvedScheduleLineItems.map((item) => item.name).join(', ')}.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            title={
              unresolvedScheduleLineItems.length > 0
                ? 'Resolve production rates before saving this scheduled activity.'
                : undefined
            }
            onClick={() => void handleSave()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Activity'}
          </button>
        </div>
      </div>

      {calcEnabled ? (
        <ArdenCalcOverlay
          open={calcOpen}
          onClose={closeCalc}
          prefersTouch={prefersTouch}
          onUseResult={handleUseCalculatorResult}
        />
      ) : null}
    </Modal>
  );
}
