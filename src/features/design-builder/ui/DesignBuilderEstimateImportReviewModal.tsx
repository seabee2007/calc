import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Plus,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import {
  commitDesignActivityDrafts,
  type CommitDesignActivityDraftsResult,
} from '../application/designBuilderToEstimate';
import { buildDesignScopeCompileResult } from '../application/designScopeCompiler';
import type {
  DesignActivityDraft,
  DesignQuantityUsage,
  DesignQuantityUsageDestination,
  DesignQuantityUsageRole,
} from '../application/designScopeTypes';
import {
  areProductionRateUnitsCompatible,
  type ProductionRateCandidate,
} from '../../estimating/application/matchQuantityToProductionRates';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import { useProductionRateLibrary } from '../../estimating/ui/hooks/useProductionRateLibrary';
import { useProjectLaborRates } from '../../estimating/ui/hooks/useProjectLaborRates';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';

interface Props {
  isOpen: boolean;
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  previewLines: readonly DesignEstimatePreviewLine[];
  persistedQuantityItems: readonly DesignQuantityItem[];
  onClose: () => void;
  onCommitted: (result: CommitDesignActivityDraftsResult) => void;
}

type AddUsageDraft = {
  sourcePreviewLineId: string;
  destination: DesignQuantityUsageDestination;
  description: string;
  quantity: string;
  unit: string;
  formula: string;
};

function formatRateOption(candidate: ProductionRateCandidate): string {
  return `${candidate.workElementName} - ${candidate.manHoursPerUnit.toFixed(3)} MH/${candidate.unit}`;
}

function searchableRateText(candidate: ProductionRateCandidate): string {
  return [
    candidate.workElementName,
    candidate.category,
    candidate.divisionCode,
    candidate.divisionName,
    candidate.unit,
    candidate.matchReason,
    candidate.manHoursPerUnit.toFixed(3),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function dedupeRateCandidates(candidates: readonly ProductionRateCandidate[]): ProductionRateCandidate[] {
  const byDisplay = new Map<string, ProductionRateCandidate>();
  for (const candidate of candidates) {
    const key = formatRateOption(candidate).trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = byDisplay.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      byDisplay.set(key, candidate);
    }
  }
  return [...byDisplay.values()];
}

function destinationLabel(destination: DesignQuantityUsageDestination): string {
  switch (destination) {
    case 'activity_line_item':
      return 'Labor';
    case 'material_resource':
      return 'Material';
    case 'equipment_resource':
      return 'Equipment';
    case 'reference_only':
      return 'Reference';
    case 'rollup':
      return 'Rollup';
    default:
      return 'Excluded';
  }
}

function statusLabel(status: DesignActivityDraft['status']): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'needs_rate':
      return 'Needs rate';
    case 'material_only':
      return 'Material only';
    case 'reference_only':
      return 'Reference';
    case 'excluded':
      return 'Excluded';
    default:
      return 'Needs review';
  }
}

function statusClassName(status: DesignActivityDraft['status']): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'material_only':
    case 'reference_only':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200';
    case 'needs_rate':
    case 'needs_review':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
    default:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function isManualOverrideComplete(usage: DesignQuantityUsage): boolean {
  const manual = usage.manualOverride;
  return (
    Boolean(manual) &&
    Number.isFinite(manual?.manHoursPerUnit) &&
    (manual?.manHoursPerUnit ?? 0) > 0 &&
    Boolean(manual?.reason.trim()) &&
    Boolean(manual?.sourceNote.trim())
  );
}

function isUsageResolved(usage: DesignQuantityUsage): boolean {
  if (!usage.enabled) return true;
  if (usage.destination !== 'activity_line_item') return true;
  if (usage.reviewStatus === 'needs_review') return false;
  if (usage.manualOverride) return isManualOverrideComplete(usage);
  return Boolean(usage.productionRateId);
}

function resolveUsageReviewStatus(usage: DesignQuantityUsage): DesignQuantityUsage['reviewStatus'] {
  if (!usage.enabled) return usage.reviewStatus;
  if (usage.destination === 'material_resource' || usage.destination === 'equipment_resource') return 'material_only';
  if (usage.destination === 'reference_only' || usage.destination === 'rollup') return 'reference_only';
  if (usage.destination === 'excluded') return 'excluded';
  if (usage.reviewStatus === 'needs_review') return 'needs_review';
  if (usage.manualOverride) return isManualOverrideComplete(usage) ? 'ready' : 'needs_rate';
  return usage.productionRateId ? 'ready' : 'needs_rate';
}

function withResolvedUsage(usage: DesignQuantityUsage): DesignQuantityUsage {
  return {
    ...usage,
    reviewStatus: resolveUsageReviewStatus(usage),
  };
}

function resolveActivityStatus(activity: DesignActivityDraft): DesignActivityDraft['status'] {
  const enabled = activity.usages.filter((usage) => usage.enabled);
  if (enabled.length === 0) return activity.usages.some((usage) => usage.reviewStatus === 'needs_review') ? 'needs_review' : 'excluded';
  if (enabled.some((usage) => usage.reviewStatus === 'needs_review')) return 'needs_review';
  if (enabled.some((usage) => usage.destination === 'activity_line_item' && !isUsageResolved(usage))) return 'needs_rate';
  if (enabled.some((usage) => usage.destination === 'activity_line_item')) return 'ready';
  if (enabled.some((usage) => usage.destination === 'material_resource' || usage.destination === 'equipment_resource')) return 'material_only';
  return 'reference_only';
}

function withResolvedActivity(activity: DesignActivityDraft): DesignActivityDraft {
  const usages = activity.usages.map(withResolvedUsage);
  return {
    ...activity,
    usages,
    scheduleEnabled: usages.some((usage) => usage.enabled && usage.destination === 'activity_line_item'),
    status: resolveActivityStatus({ ...activity, usages }),
  };
}

function candidateFromLibraryRate(
  usage: DesignQuantityUsage,
  rate: ProductionRateLibraryEntry,
): ProductionRateCandidate {
  return {
    productionRateId: rate.id,
    divisionCode: rate.divisionCode,
    divisionName: rate.divisionName,
    workElementName: rate.canonicalTitle ?? rate.activityName,
    category: rate.category ?? null,
    unit: rate.unitOfMeasure,
    manHoursPerUnit: rate.manHoursPerUnit ?? 0,
    confidence: 0.5,
    matchReason: `Manual selection from approved Division ${usage.metadata.divisionCode ?? rate.divisionCode} production rates.`,
    unitCompatible: true,
  };
}

export default function DesignBuilderEstimateImportReviewModal({
  isOpen,
  projectId,
  estimateId,
  designModelId,
  previewLines,
  persistedQuantityItems,
  onClose,
  onCommitted,
}: Props) {
  const library = useProductionRateLibrary(isOpen);
  const { projectRates, ensureProjectLaborRatesReady } = useProjectLaborRates(projectId);
  const [activities, setActivities] = useState<DesignActivityDraft[]>([]);
  const [referenceUsages, setReferenceUsages] = useState<DesignQuantityUsage[]>([]);
  const [excludedUsages, setExcludedUsages] = useState<DesignQuantityUsage[]>([]);
  const [rollupUsages, setRollupUsages] = useState<DesignQuantityUsage[]>([]);
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Set<string>>(new Set());
  const [addUsageDrafts, setAddUsageDrafts] = useState<Record<string, AddUsageDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistedByPreviewId = useMemo(
    () => new Map(
      persistedQuantityItems.map((item) => [
        String(item.metadata.previewLineId ?? item.quantityType),
        item,
      ]),
    ),
    [persistedQuantityItems],
  );

  useEffect(() => {
    if (!isOpen || library.loading) return;
    const compiled = buildDesignScopeCompileResult({
      previewLines,
      persistedQuantityItems,
      productionRates: library.rates,
    });
    setActivities(compiled.activities.map(withResolvedActivity));
    setReferenceUsages(compiled.referenceUsages);
    setExcludedUsages(compiled.excludedUsages);
    setRollupUsages(compiled.rollupUsages);
    setExpandedActivityKeys(new Set(
      compiled.activities
        .filter((entry) => entry.status === 'needs_rate' || entry.status === 'needs_review')
        .map((entry) => entry.key),
    ));
    setAddUsageDrafts({});
    setError(null);
  }, [isOpen, library.loading, library.rates, persistedQuantityItems, previewLines]);

  const counts = useMemo(
    () => ({
      activities: activities.length,
      ready: activities.filter((entry) => entry.status === 'ready').length,
      needRate: activities.filter((entry) => entry.status === 'needs_rate' || entry.status === 'needs_review').length,
      materialOnly: activities.filter((entry) => entry.status === 'material_only').length,
      reference: referenceUsages.length + rollupUsages.length,
    }),
    [activities, referenceUsages.length, rollupUsages.length],
  );

  const createDisabled =
    saving ||
    (activities.length === 0 && referenceUsages.length === 0 && excludedUsages.length === 0 && rollupUsages.length === 0) ||
    activities.some((activity) => activity.usages.some((usage) => !isUsageResolved(usage)));

  function updateUsage(
    activityKey: string,
    usageId: string,
    update: (usage: DesignQuantityUsage) => DesignQuantityUsage,
  ) {
    setActivities((current) =>
      current.map((activity) => {
        if (activity.key !== activityKey) return activity;
        return withResolvedActivity({
          ...activity,
          usages: activity.usages.map((usage) =>
            usage.id === usageId ? update(usage) : usage,
          ),
        });
      }),
    );
  }

  function candidateRatesForUsage(usage: DesignQuantityUsage): ProductionRateCandidate[] {
    const candidates = usage.candidates ?? [];
    const candidateIds = new Set((usage.candidates ?? []).map((candidate) => candidate.productionRateId));
    const divisionCode = String(usage.metadata.divisionCode ?? usage.sourceLine?.divisionCode ?? '');
    const approvedFallbacks = library.rates
      .filter((rate) => {
        if (candidateIds.has(rate.id)) return false;
        if (rate.divisionCode !== divisionCode) return false;
        if ((rate.manHoursPerUnit ?? 0) <= 0) return false;
        if (!areProductionRateUnitsCompatible(usage.unit, rate.unitOfMeasure)) return false;
        return true;
      })
      .map((rate) => candidateFromLibraryRate(usage, rate));
    return dedupeRateCandidates([...candidates, ...approvedFallbacks]);
  }

  function startAddUsage(activity: DesignActivityDraft) {
    const source = previewLines[0];
    if (!source) return;
    setAddUsageDrafts((current) => ({
      ...current,
      [activity.key]: {
        sourcePreviewLineId: source.id,
        destination: 'activity_line_item',
        description: source.description,
        quantity: String(source.quantity),
        unit: source.unit,
        formula: source.formula,
      },
    }));
  }

  function patchAddUsageDraft(activityKey: string, patch: Partial<AddUsageDraft>) {
    setAddUsageDrafts((current) => {
      const existing = current[activityKey];
      if (!existing) return current;
      const next = { ...existing, ...patch };
      if (patch.sourcePreviewLineId) {
        const source = previewLines.find((line) => line.id === patch.sourcePreviewLineId);
        if (source) {
          next.description = source.description;
          next.quantity = String(source.quantity);
          next.unit = source.unit;
          next.formula = source.formula;
        }
      }
      return { ...current, [activityKey]: next };
    });
  }

  function addManualUsage(activity: DesignActivityDraft) {
    const draft = addUsageDrafts[activity.key];
    const source = draft ? previewLines.find((line) => line.id === draft.sourcePreviewLineId) : null;
    if (!draft || !source) return;
    const quantity = Number.parseFloat(draft.quantity);
    const usage: DesignQuantityUsage = {
      id: `manual:${activity.key}:${Date.now()}`,
      sourcePreviewLineId: source.id,
      sourceQuantityType: source.quantityType,
      persistedQuantityItem: persistedByPreviewId.get(source.id) ?? persistedByPreviewId.get(source.quantityType),
      sourceLine: source,
      enabled: true,
      locked: false,
      destination: draft.destination,
      role: roleForDestination(draft.destination),
      activityKey: activity.key,
      activityTitle: activity.title,
      description: draft.description.trim() || source.description,
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : source.quantity,
      unit: draft.unit.trim() || source.unit,
      formula: draft.formula.trim() || source.formula,
      derived: false,
      reviewStatus: draft.destination === 'activity_line_item'
        ? 'needs_rate'
        : draft.destination === 'material_resource' || draft.destination === 'equipment_resource'
          ? 'material_only'
          : draft.destination === 'excluded'
            ? 'excluded'
            : 'reference_only',
      reviewReason: 'User-added usage linked to a Design Builder quantity.',
      productionRateId: null,
      candidates: [],
      matchConfidence: null,
      matchReason: null,
      manualOverride: null,
      unitCost: 0,
      totalCost: 0,
      metadata: {
        designObjectId: source.designObjectId,
        divisionCode: source.divisionCode,
        divisionName: source.divisionName,
        userAdded: true,
      },
    };
    setActivities((current) =>
      current.map((entry) =>
        entry.key === activity.key
          ? withResolvedActivity({ ...entry, usages: [...entry.usages, usage] })
          : entry,
      ),
    );
    setAddUsageDrafts((current) => {
      const next = { ...current };
      delete next[activity.key];
      return next;
    });
  }

  async function handleCreateActivities() {
    if (createDisabled) return;
    setSaving(true);
    setError(null);
    try {
      const laborRates = projectRates.length > 0 ? projectRates : await ensureProjectLaborRatesReady();
      const result: RepositoryResult<CommitDesignActivityDraftsResult> =
        await commitDesignActivityDrafts({
          projectId,
          estimateId: estimateId ?? null,
          designModelId,
          activities,
          referenceUsages,
          excludedUsages,
          rollupUsages,
          existingActivities: [],
          projectLaborRates: laborRates,
          productionRates: library.rates,
        });
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not create Design Builder scope activities.');
        return;
      }
      onCommitted(result.data);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Design Builder Scope Activities"
      size="xl"
      closeOnBackdrop={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <SummaryStat label="Activities" value={counts.activities} />
          <SummaryStat label="Ready" value={counts.ready} tone={counts.ready > 0 ? 'ok' : undefined} />
          <SummaryStat label="Need rate" value={counts.needRate} tone={counts.needRate > 0 ? 'warn' : 'ok'} />
          <SummaryStat label="Material only" value={counts.materialOnly} />
          <SummaryStat label="Reference" value={counts.reference} />
        </div>

        {library.loading ? (
          <p className="text-sm text-slate-500">Loading approved production rates...</p>
        ) : library.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{library.error}</p>
        ) : activities.length === 0 && referenceUsages.length === 0 ? (
          <p className="text-sm text-slate-500">No design quantities are ready for scope import.</p>
        ) : (
          <div className="max-h-[58vh] space-y-3 overflow-auto pr-1">
            {activities.map((activity) => {
              const expanded = expandedActivityKeys.has(activity.key);
              const enabledUsages = activity.usages.filter((usage) => usage.enabled);
              return (
                <section
                  key={activity.key}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedActivityKeys((current) => {
                        const next = new Set(current);
                        if (next.has(activity.key)) next.delete(activity.key);
                        else next.add(activity.key);
                        return next;
                      })
                    }
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{activity.title}</span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Operation: {activity.operation.replace(/_/g, ' ')} | Outputs: {enabledUsages.length} | Schedule: {activity.scheduleEnabled ? 'Yes' : 'No'}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClassName(activity.status)}`}>
                      {statusLabel(activity.status)}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                      {activity.warnings.length > 0 ? (
                        <div className="space-y-1">
                          {activity.warnings.map((warning) => (
                            <div key={warning} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        {activity.usages.map((usage) => (
                          <UsageReviewRow
                            key={usage.id}
                            activityKey={activity.key}
                            usage={usage}
                            candidates={candidateRatesForUsage(usage)}
                            onUsageChange={(updater) =>
                              updateUsage(activity.key, usage.id, updater)
                            }
                          />
                        ))}
                      </div>
                      <AddUsagePanel
                        activity={activity}
                        previewLines={previewLines}
                        draft={addUsageDrafts[activity.key]}
                        onStart={() => startAddUsage(activity)}
                        onPatch={(patch) => patchAddUsageDraft(activity.key, patch)}
                        onCancel={() =>
                          setAddUsageDrafts((current) => {
                            const next = { ...current };
                            delete next[activity.key];
                            return next;
                          })
                        }
                        onAdd={() => addManualUsage(activity)}
                      />
                    </div>
                  ) : null}
                </section>
              );
            })}

            {referenceUsages.length || rollupUsages.length ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-700 dark:bg-slate-900">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Reference / Rollup Usages</div>
                <div className="mt-2 space-y-1 text-slate-500">
                  {[...referenceUsages, ...rollupUsages].map((usage) => (
                    <div key={usage.id}>
                      {usage.description}: {usage.quantity} {usage.unit}
                      {usage.reviewReason ? ` - ${usage.reviewReason}` : ''}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createDisabled || library.loading}
            title={createDisabled ? 'Resolve enabled labor usages before creating activities.' : undefined}
            onClick={() => void handleCreateActivities()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creating Activities...' : 'Create Activities'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UsageReviewRow({
  usage,
  candidates,
  onUsageChange,
}: {
  activityKey: string;
  usage: DesignQuantityUsage;
  candidates: ProductionRateCandidate[];
  onUsageChange: (updater: (usage: DesignQuantityUsage) => DesignQuantityUsage) => void;
}) {
  const selectedCandidate = candidates.find(
    (candidate) => candidate.productionRateId === usage.productionRateId,
  );
  const unresolved = !isUsageResolved(usage);

  return (
    <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={usage.enabled}
              disabled={usage.locked}
              onChange={(event) =>
                onUsageChange((current) => withResolvedUsage({ ...current, enabled: event.target.checked }))
              }
              className="mt-0.5"
            />
            {usage.destination === 'excluded' || usage.destination === 'rollup' || !usage.enabled ? (
              <CircleSlash size={14} className="mt-0.5 shrink-0 text-slate-400" />
            ) : unresolved ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <span className="min-w-0 break-words font-semibold leading-5 text-slate-900 dark:text-slate-100">
              {usage.description}
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800">
              {destinationLabel(usage.destination)}
            </span>
          </div>
          <div className="mt-1 break-words text-slate-500">
            {usage.quantity} {usage.unit} | {usage.sourceQuantityType ?? 'manual'}
          </div>
          <div className="mt-1 break-words text-slate-500">Formula: {usage.formula}</div>
          {usage.reviewReason ? (
            <div className="mt-1 break-words text-amber-700 dark:text-amber-300">{usage.reviewReason}</div>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2">
          {usage.destination === 'activity_line_item' && usage.enabled ? (
            usage.manualOverride ? (
              <div className="grid gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={usage.manualOverride?.manHoursPerUnit ?? ''}
                  onChange={(event) =>
                    onUsageChange((current) => withResolvedUsage({
                      ...current,
                      manualOverride: {
                        manHoursPerUnit: parseFloat(event.target.value),
                        reason: current.manualOverride?.reason ?? '',
                        sourceNote: current.manualOverride?.sourceNote ?? '',
                      },
                    }))
                  }
                  placeholder="MH / unit"
                  className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  value={usage.manualOverride?.reason ?? ''}
                  onChange={(event) =>
                    onUsageChange((current) => withResolvedUsage({
                      ...current,
                      manualOverride: {
                        manHoursPerUnit: current.manualOverride?.manHoursPerUnit ?? 0,
                        reason: event.target.value,
                        sourceNote: current.manualOverride?.sourceNote ?? '',
                      },
                    }))
                  }
                  placeholder="Reason required"
                  className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  value={usage.manualOverride?.sourceNote ?? ''}
                  onChange={(event) =>
                    onUsageChange((current) => withResolvedUsage({
                      ...current,
                      manualOverride: {
                        manHoursPerUnit: current.manualOverride?.manHoursPerUnit ?? 0,
                        reason: current.manualOverride?.reason ?? '',
                        sourceNote: event.target.value,
                      },
                    }))
                  }
                  placeholder="Source note required"
                  className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <ProductionRateCombobox
                  usageId={usage.id}
                  usageDescription={usage.description}
                  candidates={candidates}
                  selectedProductionRateId={usage.productionRateId ?? null}
                  onSelect={(candidate) => {
                    onUsageChange((current) => withResolvedUsage({
                      ...current,
                      productionRateId: candidate?.productionRateId ?? null,
                      matchConfidence: candidate?.confidence ?? null,
                      matchReason: candidate?.matchReason ?? null,
                      reviewReason: current.reviewReason,
                      candidates: candidate && !current.candidates?.some((item) => item.productionRateId === candidate.productionRateId)
                        ? [candidate, ...(current.candidates ?? [])]
                        : current.candidates,
                    }));
                  }}
                />
                {selectedCandidate ? (
                  <div className="text-slate-500">
                    {selectedCandidate.unit} | {selectedCandidate.manHoursPerUnit.toFixed(3)} MH/unit | {Math.round(selectedCandidate.confidence * 100)}%
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onUsageChange((current) => withResolvedUsage({
                      ...current,
                      productionRateId: null,
                      manualOverride: {
                        manHoursPerUnit: 0,
                        reason: '',
                        sourceNote: '',
                      },
                    }))
                  }
                  className="justify-self-start text-[11px] font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
                >
                  Use manual MH/unit override
                </button>
              </div>
            )
          ) : (
            <div className="rounded border border-slate-200 px-2 py-1 text-slate-500 dark:border-slate-700">
              {usage.destination === 'material_resource' || usage.destination === 'equipment_resource'
                ? 'Resource cost defaults to $0.00 in this import.'
                : destinationLabel(usage.destination)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductionRateCombobox({
  usageId,
  usageDescription,
  candidates,
  selectedProductionRateId,
  onSelect,
}: {
  usageId: string;
  usageDescription: string;
  candidates: ProductionRateCandidate[];
  selectedProductionRateId: string | null;
  onSelect: (candidate: ProductionRateCandidate | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useMemo(
    () => `production-rate-listbox-${usageId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    [usageId],
  );
  const selectedCandidate = candidates.find(
    (candidate) => candidate.productionRateId === selectedProductionRateId,
  );
  const selectedLabel = selectedCandidate ? formatRateOption(selectedCandidate) : '';
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedLabel);
    setHasTyped(false);
    setActiveIndex(0);
  }, [selectedLabel, selectedProductionRateId]);

  const filteredCandidates = useMemo(() => {
    const filterText = hasTyped ? query.trim().toLowerCase() : '';
    const filtered = filterText
      ? candidates.filter((candidate) =>
          searchableRateText(candidate).includes(filterText) ||
          formatRateOption(candidate).toLowerCase().includes(filterText),
        )
      : candidates;
    return filtered.slice(0, 80);
  }, [candidates, hasTyped, query]);

  function selectCandidate(candidate: ProductionRateCandidate | null) {
    onSelect(candidate);
    setQuery(candidate ? formatRateOption(candidate) : '');
    setHasTyped(false);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredCandidates.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      selectCandidate(filteredCandidates[activeIndex] ?? null);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setHasTyped(false);
      setQuery(selectedLabel);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOpen(false);
        setHasTyped(false);
        setQuery(selectedLabel);
      }}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-label={`Select work element for ${usageDescription}`}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        value={query}
        onFocus={() => {
          setOpen(true);
          setHasTyped(false);
          setActiveIndex(0);
        }}
        onClick={() => {
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHasTyped(true);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Select work element..."
        className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 pr-8 dark:border-slate-600 dark:bg-slate-800"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open work element options"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen(true);
          setHasTyped(false);
          inputRef.current?.focus();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-300 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800"
        >
          {selectedProductionRateId ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCandidate(null)}
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Clear selection
            </button>
          ) : null}
          {filteredCandidates.length > 0 ? (
            filteredCandidates.map((candidate, index) => {
              const selected = candidate.productionRateId === selectedProductionRateId;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={candidate.productionRateId}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCandidate(candidate)}
                  className={[
                    'block w-full px-3 py-1.5 text-left text-xs',
                    selected
                      ? 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950/70 dark:text-cyan-100'
                      : index === activeIndex
                        ? 'bg-slate-100 text-slate-950 dark:bg-slate-700 dark:text-slate-100'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {formatRateOption(candidate)}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-slate-500">No matching work elements.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AddUsagePanel({
  activity,
  previewLines,
  draft,
  onStart,
  onPatch,
  onCancel,
  onAdd,
}: {
  activity: DesignActivityDraft;
  previewLines: readonly DesignEstimatePreviewLine[];
  draft?: AddUsageDraft;
  onStart: () => void;
  onPatch: (patch: Partial<AddUsageDraft>) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  if (!draft) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Plus size={13} />
        Add Usage
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs dark:border-slate-600">
      <div className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Add Usage to {activity.title}</div>
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={draft.sourcePreviewLineId}
          onChange={(event) => onPatch({ sourcePreviewLineId: event.target.value })}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        >
          {previewLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.description} ({line.quantity} {line.unit})
            </option>
          ))}
        </select>
        <select
          value={draft.destination}
          onChange={(event) => onPatch({ destination: event.target.value as DesignQuantityUsageDestination })}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        >
          {(['activity_line_item', 'material_resource', 'equipment_resource', 'reference_only'] as const).map((destination) => (
            <option key={destination} value={destination}>{destinationLabel(destination)}</option>
          ))}
        </select>
        <input
          value={draft.description}
          onChange={(event) => onPatch({ description: event.target.value })}
          className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <input
            value={draft.quantity}
            onChange={(event) => onPatch({ quantity: event.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            value={draft.unit}
            onChange={(event) => onPatch({ unit: event.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
        <input
          value={draft.formula}
          onChange={(event) => onPatch({ formula: event.target.value })}
          className="w-full rounded border border-slate-300 px-2 py-1 md:col-span-2 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-3 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
        <button type="button" onClick={onAdd} className="rounded bg-cyan-600 px-3 py-1 font-medium text-white hover:bg-cyan-700">Add usage</button>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={[
          'text-lg font-semibold',
          tone === 'warn'
            ? 'text-amber-700 dark:text-amber-300'
            : tone === 'ok'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-900 dark:text-slate-100',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function roleForDestination(destination: DesignQuantityUsageDestination): DesignQuantityUsageRole {
  if (destination === 'activity_line_item') return 'primary_labor_driver';
  if (destination === 'material_resource') return 'material_takeoff';
  if (destination === 'equipment_resource') return 'equipment_takeoff';
  if (destination === 'excluded') return 'excluded';
  if (destination === 'rollup') return 'rollup';
  return 'reference';
}
