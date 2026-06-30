import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleSlash, Search } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import {
  commitDesignScopePackages,
  type CommitDesignScopePackagesResult,
} from '../application/designBuilderToEstimate';
import { buildDesignScopePackages } from '../application/designScopeCompiler';
import type {
  DesignQuantityDestination,
  DesignScopePackage,
  DesignScopePackageQuantity,
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
  onCommitted: (result: CommitDesignScopePackagesResult) => void;
}

type PackageStats = {
  labor: number;
  materials: number;
  references: number;
  excluded: number;
};

function statusLabel(status: DesignScopePackage['status']): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'excluded':
      return 'No activity';
    default:
      return 'Needs review';
  }
}

function statusClassName(status: DesignScopePackage['status']): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'excluded':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
}

function destinationLabel(destination: DesignQuantityDestination): string {
  switch (destination) {
    case 'activity_line_item':
      return 'Labor / production line';
    case 'material_resource':
      return 'Material resource';
    case 'equipment_resource':
      return 'Equipment resource';
    case 'reference_only':
      return 'Reference only';
    case 'quality_check':
      return 'Quality check';
    case 'rollup':
      return 'Rollup';
    case 'placeholder':
      return 'Placeholder';
    default:
      return 'Excluded';
  }
}

function formatRateOption(candidate: ProductionRateCandidate): string {
  return `${candidate.workElementName} - ${candidate.manHoursPerUnit.toFixed(3)} MH/${candidate.unit}`;
}

function candidateFromLibraryRate(
  line: DesignEstimatePreviewLine,
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
    matchReason: `Manual selection from approved Division ${line.divisionCode} production rates.`,
    unitCompatible: true,
  };
}

function isManualOverrideComplete(quantity: DesignScopePackageQuantity): boolean {
  const manual = quantity.manualOverride;
  return (
    quantity.assignmentStatus === 'manual_override' &&
    Boolean(manual) &&
    Number.isFinite(manual?.manHoursPerUnit) &&
    (manual?.manHoursPerUnit ?? 0) > 0 &&
    Boolean(manual?.reason.trim()) &&
    Boolean(manual?.sourceNote.trim())
  );
}

function isQuantityResolved(quantity: DesignScopePackageQuantity): boolean {
  if (
    quantity.classification.destination !== 'activity_line_item' ||
    !quantity.classification.includeByDefault
  ) {
    return true;
  }
  if (quantity.assignmentStatus === 'manual_override') return isManualOverrideComplete(quantity);
  return (
    (quantity.assignmentStatus === 'auto_matched' || quantity.assignmentStatus === 'verified_rate') &&
    Boolean(quantity.selectedProductionRateId)
  );
}

function packageStats(scopePackage: DesignScopePackage): PackageStats {
  return scopePackage.quantities.reduce<PackageStats>(
    (stats, quantity) => {
      switch (quantity.classification.destination) {
        case 'activity_line_item':
          stats.labor += 1;
          break;
        case 'material_resource':
        case 'equipment_resource':
          stats.materials += 1;
          break;
        case 'reference_only':
        case 'quality_check':
          stats.references += 1;
          break;
        default:
          stats.excluded += 1;
      }
      return stats;
    },
    { labor: 0, materials: 0, references: 0, excluded: 0 },
  );
}

function resolvePackageStatus(scopePackage: DesignScopePackage): DesignScopePackage['status'] {
  const activityRows = scopePackage.quantities.filter(
    (quantity) =>
      quantity.classification.destination === 'activity_line_item' &&
      quantity.classification.includeByDefault,
  );
  if (activityRows.length === 0) return 'excluded';
  return activityRows.every(isQuantityResolved) ? 'ready' : 'review_required';
}

function withResolvedPackageStatus(scopePackage: DesignScopePackage): DesignScopePackage {
  return {
    ...scopePackage,
    status: resolvePackageStatus(scopePackage),
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
  const [packages, setPackages] = useState<DesignScopePackage[]>([]);
  const [expandedPackageKeys, setExpandedPackageKeys] = useState<Set<string>>(new Set());
  const [searchByLineId, setSearchByLineId] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || library.loading) return;
    const compiled = buildDesignScopePackages({
      previewLines,
      persistedQuantityItems,
      productionRates: library.rates,
    });
    setPackages(compiled);
    setExpandedPackageKeys(new Set(compiled.filter((entry) => entry.status === 'review_required').map((entry) => entry.key)));
    setSearchByLineId({});
    setError(null);
  }, [isOpen, library.loading, library.rates, persistedQuantityItems, previewLines]);

  const counts = useMemo(
    () => ({
      packages: packages.length,
      ready: packages.filter((entry) => entry.status === 'ready').length,
      review: packages.filter((entry) => entry.status === 'review_required').length,
      excluded: packages.filter((entry) => entry.status === 'excluded').length,
    }),
    [packages],
  );

  const createDisabled =
    saving ||
    packages.length === 0 ||
    packages.some((scopePackage) =>
      scopePackage.quantities.some((quantity) => !isQuantityResolved(quantity)),
    );

  function updateQuantity(
    packageKey: string,
    previewLineId: string,
    update: (quantity: DesignScopePackageQuantity) => DesignScopePackageQuantity,
  ) {
    setPackages((current) =>
      current.map((scopePackage) => {
        if (scopePackage.key !== packageKey) return scopePackage;
        return withResolvedPackageStatus({
          ...scopePackage,
          quantities: scopePackage.quantities.map((quantity) =>
            quantity.line.id === previewLineId ? update(quantity) : quantity,
          ),
        });
      }),
    );
  }

  function setDestination(
    packageKey: string,
    quantity: DesignScopePackageQuantity,
    destination: DesignQuantityDestination,
  ) {
    updateQuantity(packageKey, quantity.line.id, (current) => ({
      ...current,
      classification: {
        ...current.classification,
        destination,
        includeByDefault: destination !== 'excluded' && destination !== 'rollup' && destination !== 'placeholder',
        role:
          destination === 'activity_line_item'
            ? 'primary_labor_driver'
            : destination === 'material_resource'
              ? 'material_takeoff'
              : destination === 'equipment_resource'
                ? 'equipment_takeoff'
                : destination === 'excluded'
                  ? 'excluded'
                  : 'reference',
        locked: false,
        reason:
          destination === 'excluded'
            ? 'User excluded from scope import.'
            : current.classification.reason,
      },
      assignmentStatus:
        destination === 'activity_line_item'
          ? current.selectedProductionRateId
            ? 'verified_rate'
            : 'review_required'
          : destination === 'excluded'
            ? 'excluded'
            : 'not_required',
    }));
  }

  function candidateRatesForQuantity(quantity: DesignScopePackageQuantity): ProductionRateCandidate[] {
    const text = (searchByLineId[quantity.line.id] ?? '').trim().toLowerCase();
    const candidateMatchesSearch = (candidate: ProductionRateCandidate) =>
      !text ||
      `${candidate.workElementName} ${candidate.unit} ${candidate.matchReason}`.toLowerCase().includes(text);
    const candidates = quantity.candidates.filter(candidateMatchesSearch);
    const candidateIds = new Set(quantity.candidates.map((candidate) => candidate.productionRateId));
    const approvedFallbacks = library.rates
      .filter((rate) => {
        if (candidateIds.has(rate.id)) return false;
        if (rate.divisionCode !== quantity.line.divisionCode) return false;
        if ((rate.manHoursPerUnit ?? 0) <= 0) return false;
        if (!areProductionRateUnitsCompatible(quantity.line.unit, rate.unitOfMeasure)) return false;
        const fallbackCandidate = candidateFromLibraryRate(quantity.line, rate);
        return candidateMatchesSearch(fallbackCandidate);
      })
      .map((rate) => candidateFromLibraryRate(quantity.line, rate));
    return [...candidates, ...approvedFallbacks].slice(0, 80);
  }

  async function handleCreateActivities() {
    if (createDisabled) return;
    setSaving(true);
    setError(null);
    try {
      const laborRates = projectRates.length > 0 ? projectRates : await ensureProjectLaborRatesReady();
      const result: RepositoryResult<CommitDesignScopePackagesResult> =
        await commitDesignScopePackages({
          projectId,
          estimateId: estimateId ?? null,
          designModelId,
          packages,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Review Design Builder Scope Packages" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <SummaryStat label="Scope packages" value={counts.packages} />
          <SummaryStat label="Ready" value={counts.ready} tone={counts.ready > 0 ? 'ok' : undefined} />
          <SummaryStat label="Need review" value={counts.review} tone={counts.review > 0 ? 'warn' : 'ok'} />
          <SummaryStat label="No activity" value={counts.excluded} />
        </div>

        {library.loading ? (
          <p className="text-sm text-slate-500">Loading approved production rates...</p>
        ) : library.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{library.error}</p>
        ) : packages.length === 0 ? (
          <p className="text-sm text-slate-500">No design quantities are ready for scope import.</p>
        ) : (
          <div className="max-h-[58vh] space-y-3 overflow-auto pr-1">
            {packages.map((scopePackage) => {
              const expanded = expandedPackageKeys.has(scopePackage.key);
              const stats = packageStats(scopePackage);
              const primaryDriver = scopePackage.quantities.find(
                (quantity) => quantity.classification.destination === 'activity_line_item',
              );
              return (
                <section
                  key={scopePackage.key}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedPackageKeys((current) => {
                        const next = new Set(current);
                        if (next.has(scopePackage.key)) next.delete(scopePackage.key);
                        else next.add(scopePackage.key);
                        return next;
                      })
                    }
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{scopePackage.title}</span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Schedule activity: {scopePackage.scheduleEnabled ? 'Yes' : 'No'}
                        {primaryDriver
                          ? ` | Primary driver: ${primaryDriver.line.description}, ${primaryDriver.line.quantity} ${primaryDriver.line.unit}`
                          : ''}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Line items: {stats.labor} | Materials: {stats.materials} | References: {stats.references} | Excluded/rollups: {stats.excluded}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClassName(scopePackage.status)}`}>
                      {statusLabel(scopePackage.status)}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                      {scopePackage.warnings.length > 0 ? (
                        <div className="space-y-1">
                          {scopePackage.warnings.map((warning) => (
                            <div key={warning} className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        {scopePackage.quantities.map((quantity) => (
                          <QuantityReviewRow
                            key={quantity.line.id}
                            packageKey={scopePackage.key}
                            quantity={quantity}
                            candidates={candidateRatesForQuantity(quantity)}
                            searchText={searchByLineId[quantity.line.id] ?? ''}
                            onSearchText={(value) =>
                              setSearchByLineId((current) => ({
                                ...current,
                                [quantity.line.id]: value,
                              }))
                            }
                            onDestinationChange={(destination) =>
                              setDestination(scopePackage.key, quantity, destination)
                            }
                            onQuantityChange={(updater) =>
                              updateQuantity(scopePackage.key, quantity.line.id, updater)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
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
            title={createDisabled ? 'Resolve activity line items before creating scope activities.' : undefined}
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

function QuantityReviewRow({
  quantity,
  candidates,
  searchText,
  onSearchText,
  onDestinationChange,
  onQuantityChange,
}: {
  packageKey: string;
  quantity: DesignScopePackageQuantity;
  candidates: ProductionRateCandidate[];
  searchText: string;
  onSearchText: (value: string) => void;
  onDestinationChange: (destination: DesignQuantityDestination) => void;
  onQuantityChange: (
    updater: (quantity: DesignScopePackageQuantity) => DesignScopePackageQuantity,
  ) => void;
}) {
  const selectedCandidate = candidates.find(
    (candidate) => candidate.productionRateId === quantity.selectedProductionRateId,
  );
  const unresolved = !isQuantityResolved(quantity);

  return (
    <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            {quantity.classification.destination === 'excluded' ||
            quantity.classification.destination === 'rollup' ||
            quantity.classification.destination === 'placeholder' ? (
              <CircleSlash size={14} className="mt-0.5 shrink-0 text-slate-400" />
            ) : unresolved ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <span className="min-w-0 break-words font-semibold leading-5 text-slate-900 dark:text-slate-100">
              {quantity.line.description}
            </span>
          </div>
          <div className="mt-1 break-words text-slate-500">
            {quantity.line.quantity} {quantity.line.unit} | {quantity.line.quantityType}
          </div>
          {quantity.classification.reason ? (
            <div className="mt-1 break-words text-amber-700 dark:text-amber-300">{quantity.classification.reason}</div>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2">
          <select
            value={quantity.classification.destination}
            disabled={quantity.classification.locked}
            onChange={(event) => onDestinationChange(event.target.value as DesignQuantityDestination)}
            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          >
            {(['activity_line_item', 'material_resource', 'reference_only', 'excluded'] as const).map((destination) => (
              <option key={destination} value={destination}>
                {destinationLabel(destination)}
              </option>
            ))}
            {quantity.classification.destination === 'rollup' ? <option value="rollup">Rollup</option> : null}
            {quantity.classification.destination === 'placeholder' ? <option value="placeholder">Placeholder</option> : null}
          </select>

          {quantity.classification.destination === 'activity_line_item' ? (
            quantity.assignmentStatus === 'manual_override' ? (
              <div className="grid gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity.manualOverride?.manHoursPerUnit ?? ''}
                  onChange={(event) =>
                    onQuantityChange((current) => ({
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
                  value={quantity.manualOverride?.reason ?? ''}
                  onChange={(event) =>
                    onQuantityChange((current) => ({
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
                  value={quantity.manualOverride?.sourceNote ?? ''}
                  onChange={(event) =>
                    onQuantityChange((current) => ({
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
                <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-600">
                  <Search size={13} className="text-slate-400" />
                  <input
                    value={searchText}
                    onChange={(event) => onSearchText(event.target.value)}
                    placeholder="Search suggested rates"
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  />
                </label>
                <select
                  value={quantity.selectedProductionRateId ?? ''}
                  onChange={(event) => {
                    const candidate = candidates.find((item) => item.productionRateId === event.target.value);
                    onQuantityChange((current) => ({
                      ...current,
                      selectedProductionRateId: event.target.value || null,
                      assignmentStatus: event.target.value ? 'verified_rate' : 'review_required',
                      candidates: candidate && !current.candidates.some((item) => item.productionRateId === candidate.productionRateId)
                        ? [candidate, ...current.candidates]
                        : current.candidates,
                    }));
                  }}
                  className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Select work element...</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.productionRateId} value={candidate.productionRateId}>
                      {formatRateOption(candidate)}
                    </option>
                  ))}
                </select>
                {selectedCandidate ? (
                  <div className="text-slate-500">
                    {selectedCandidate.unit} | {selectedCandidate.manHoursPerUnit.toFixed(3)} MH/unit | {Math.round(selectedCandidate.confidence * 100)}%
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onQuantityChange((current) => ({
                      ...current,
                      assignmentStatus: 'manual_override',
                      selectedProductionRateId: null,
                      manualOverride: current.manualOverride ?? {
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
            <div className="text-slate-500">{destinationLabel(quantity.classification.destination)}</div>
          )}
        </div>
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
