import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, Search } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';
import {
  commitDesignEstimatePreview,
  type CommitDesignEstimatePreviewResult,
  type DesignBuilderImportCommitAssignment,
} from '../application/designBuilderToEstimate';
import {
  resolveDesignBuilderImportRule,
  type DesignBuilderScheduleGroupRule,
} from '../application/designBuilderImportRules';
import {
  areProductionRateUnitsCompatible,
  matchQuantityToProductionRates,
  type ProductionRateCandidate,
} from '../../estimating/application/matchQuantityToProductionRates';
import type { RepositoryResult } from '../../estimating/infrastructure/estimateDbTypes';
import { useProductionRateLibrary } from '../../estimating/ui/hooks/useProductionRateLibrary';
import { useProjectLaborRates } from '../../estimating/ui/hooks/useProjectLaborRates';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import {
  OBJECT_TREE_ITEMS,
  objectTypeForPreviewLine,
} from './DesignBuilderPageMappings';

type ReviewRowStatus =
  | 'auto_matched'
  | 'verified_rate'
  | 'manual_override'
  | 'review_required'
  | 'excluded';

interface ReviewRow {
  line: DesignEstimatePreviewLine;
  include: boolean;
  lockedExcluded: boolean;
  status: ReviewRowStatus;
  scheduleGroup: DesignBuilderScheduleGroupRule;
  productionRateId: string | null;
  candidates: ProductionRateCandidate[];
  issue: string | null;
  matchConfidence: number | null;
  matchReason: string | null;
  manualManHoursPerUnit: string;
  manualReason: string;
  manualSourceNote: string;
  searchText: string;
}

interface Props {
  isOpen: boolean;
  projectId: string;
  estimateId?: string | null;
  designModelId: string;
  previewLines: readonly DesignEstimatePreviewLine[];
  persistedQuantityItems: readonly DesignQuantityItem[];
  onClose: () => void;
  onCommitted: (result: CommitDesignEstimatePreviewResult) => void;
}

function sourceObjectLabel(line: DesignEstimatePreviewLine): string {
  const objectType = objectTypeForPreviewLine(line);
  return OBJECT_TREE_ITEMS.find((item) => item.objectType === objectType)?.label ?? objectType;
}

function statusLabel(status: ReviewRowStatus): string {
  switch (status) {
    case 'auto_matched':
      return 'Auto-matched';
    case 'verified_rate':
      return 'Verified';
    case 'manual_override':
      return 'Manual override';
    case 'excluded':
      return 'Excluded';
    default:
      return 'Review needed';
  }
}

function statusClassName(status: ReviewRowStatus): string {
  switch (status) {
    case 'auto_matched':
    case 'verified_rate':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'manual_override':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200';
    case 'excluded':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
}

function buildInitialRows(
  lines: readonly DesignEstimatePreviewLine[],
  rates: readonly ProductionRateLibraryEntry[],
): ReviewRow[] {
  return lines.map((line) => {
    const rule = resolveDesignBuilderImportRule(line, lines);
    if (rule.policy === 'exclude') {
      return {
        line,
        include: false,
        lockedExcluded: true,
        status: 'excluded',
        scheduleGroup: rule.scheduleGroup,
        productionRateId: null,
        candidates: [],
        issue: rule.reason,
        matchConfidence: null,
        matchReason: null,
        manualManHoursPerUnit: '',
        manualReason: '',
        manualSourceNote: '',
        searchText: '',
      };
    }

    const match = matchQuantityToProductionRates(
      {
        divisionCode: line.divisionCode,
        divisionName: line.divisionName,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        quantityType: line.quantityType,
        sourceObjectLabel: sourceObjectLabel(line),
        formula: line.formula,
        parameterSnapshot: line.parameterSnapshot,
        keywords: rule.keywords,
      },
      rates,
    );

    if (match.status === 'excluded') {
      return {
        line,
        include: false,
        lockedExcluded: true,
        status: 'excluded',
        scheduleGroup: rule.scheduleGroup,
        productionRateId: null,
        candidates: [],
        issue: match.reason,
        matchConfidence: null,
        matchReason: null,
        manualManHoursPerUnit: '',
        manualReason: '',
        manualSourceNote: '',
        searchText: '',
      };
    }

    if (match.status === 'auto_matched' && rule.policy !== 'review_required') {
      return {
        line,
        include: true,
        lockedExcluded: false,
        status: 'auto_matched',
        scheduleGroup: rule.scheduleGroup,
        productionRateId: match.productionRateId,
        candidates: match.candidates,
        issue: null,
        matchConfidence: match.confidence,
        matchReason: match.matchReason,
        manualManHoursPerUnit: '',
        manualReason: '',
        manualSourceNote: '',
        searchText: '',
      };
    }

    return {
      line,
      include: true,
      lockedExcluded: false,
      status: 'review_required',
      scheduleGroup: rule.scheduleGroup,
      productionRateId: null,
      candidates: match.candidates,
      issue: rule.reason ?? (match.status === 'review_required' ? match.issue : 'Review required.'),
      matchConfidence: null,
      matchReason: null,
      manualManHoursPerUnit: '',
      manualReason: '',
      manualSourceNote: '',
      searchText: '',
    };
  });
}

function isManualOverrideComplete(row: ReviewRow): boolean {
  const mh = parseFloat(row.manualManHoursPerUnit);
  return (
    row.status === 'manual_override' &&
    Number.isFinite(mh) &&
    mh > 0 &&
    row.manualReason.trim().length > 0 &&
    row.manualSourceNote.trim().length > 0
  );
}

function isResolved(row: ReviewRow): boolean {
  if (!row.include || row.status === 'excluded') return true;
  if (row.status === 'manual_override') return isManualOverrideComplete(row);
  return (
    (row.status === 'auto_matched' || row.status === 'verified_rate') &&
    Boolean(row.productionRateId)
  );
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

function rowToAssignment(row: ReviewRow): DesignBuilderImportCommitAssignment {
  if (!row.include || row.status === 'excluded') {
    return {
      previewLineId: row.line.id,
      status: 'excluded',
      scheduleGroup: row.scheduleGroup,
      matchReason: row.issue ?? 'Excluded from Design Builder import.',
    };
  }

  if (row.status === 'manual_override') {
    return {
      previewLineId: row.line.id,
      status: 'manual_override',
      scheduleGroup: row.scheduleGroup,
      matchReason: 'Manual Design Builder production-rate override.',
      manualOverride: {
        manHoursPerUnit: parseFloat(row.manualManHoursPerUnit),
        reason: row.manualReason.trim(),
        sourceNote: row.manualSourceNote.trim(),
      },
    };
  }

  const status = row.status === 'auto_matched' ? 'auto_matched' : 'verified_rate';
  return {
    previewLineId: row.line.id,
    status,
    productionRateId: row.productionRateId,
    scheduleGroup: row.scheduleGroup,
    matchConfidence: row.matchConfidence,
    matchReason: row.matchReason,
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
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || library.loading) return;
    setRows(buildInitialRows(previewLines, library.rates));
    setError(null);
  }, [isOpen, library.loading, library.rates, previewLines]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      verified: rows.filter((row) => row.include && isResolved(row)).length,
      review: rows.filter((row) => row.include && !isResolved(row)).length,
      excluded: rows.filter((row) => !row.include || row.status === 'excluded').length,
    }),
    [rows],
  );

  const createDisabled = saving || rows.length === 0 || rows.some((row) => row.include && !isResolved(row));

  function updateRow(lineId: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => (row.line.id === lineId ? { ...row, ...patch } : row)));
  }

  function candidateRatesForRow(row: ReviewRow): ProductionRateCandidate[] {
    const text = row.searchText.trim().toLowerCase();
    const candidateMatchesSearch = (candidate: ProductionRateCandidate) =>
      !text ||
      `${candidate.workElementName} ${candidate.unit} ${candidate.matchReason}`.toLowerCase().includes(text);
    const candidates = row.candidates.filter(candidateMatchesSearch);
    const candidateIds = new Set(row.candidates.map((candidate) => candidate.productionRateId));
    const approvedFallbacks = library.rates
      .filter((rate) => {
        if (candidateIds.has(rate.id)) return false;
        if (rate.divisionCode !== row.line.divisionCode) return false;
        if ((rate.manHoursPerUnit ?? 0) <= 0) return false;
        if (!areProductionRateUnitsCompatible(row.line.unit, rate.unitOfMeasure)) return false;
        const fallbackCandidate = candidateFromLibraryRate(row.line, rate);
        return candidateMatchesSearch(fallbackCandidate);
      })
      .map((rate) => candidateFromLibraryRate(row.line, rate));
    return [...candidates, ...approvedFallbacks].slice(0, 80);
  }

  async function handleCreateActivities() {
    if (createDisabled) return;
    setSaving(true);
    setError(null);
    try {
      const laborRates = projectRates.length > 0 ? projectRates : await ensureProjectLaborRatesReady();
      const result: RepositoryResult<CommitDesignEstimatePreviewResult> =
        await commitDesignEstimatePreview({
          projectId,
          estimateId: estimateId ?? null,
          designModelId,
          previewLines,
          persistedQuantityItems,
          existingActivities: [],
          projectLaborRates: laborRates,
          productionRates: library.rates,
          assignments: rows.map(rowToAssignment),
        });
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not create Design Builder estimate activities.');
        return;
      }
      onCommitted(result.data);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Design Builder Estimate Import" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <SummaryStat label="Design quantities" value={counts.total} />
          <SummaryStat label="Verified" value={counts.verified} />
          <SummaryStat label="Need review" value={counts.review} tone={counts.review > 0 ? 'warn' : 'ok'} />
          <SummaryStat label="Excluded" value={counts.excluded} />
        </div>

        {library.loading ? (
          <p className="text-sm text-slate-500">Loading approved production rates...</p>
        ) : library.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{library.error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No design quantities are ready for import.</p>
        ) : (
          <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-[1180px] w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Include</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2">Source Object</th>
                  <th className="px-3 py-2">Design Quantity</th>
                  <th className="px-3 py-2">Qty / Unit</th>
                  <th className="px-3 py-2">Schedule Group</th>
                  <th className="px-3 py-2">Assigned Work Element</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const candidates = candidateRatesForRow(row);
                  const selectedCandidate = candidates.find(
                    (candidate) => candidate.productionRateId === row.productionRateId,
                  );
                  return (
                    <tr key={row.line.id} className={!row.include ? 'opacity-70' : ''}>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={row.lockedExcluded}
                          onChange={(event) => {
                            const include = event.target.checked;
                            updateRow(row.line.id, {
                              include,
                              status: include ? 'review_required' : 'excluded',
                              issue: include ? row.issue : 'User excluded from import.',
                            });
                          }}
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${statusClassName(row.status)}`}>
                          {row.status === 'excluded' ? <CircleSlash size={12} /> : isResolved(row) ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          Div {row.line.divisionCode}
                        </div>
                        <div className="text-slate-500">{row.line.divisionName}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600 dark:text-slate-300">
                        {sourceObjectLabel(row.line)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{row.line.description}</div>
                        <div className="mt-1 text-slate-500">{row.line.quantityType}</div>
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-slate-700 dark:text-slate-200">
                        {row.line.quantity} {row.line.unit}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                        {row.scheduleGroup.title}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {row.status === 'manual_override' ? (
                          <div className="grid min-w-[220px] gap-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.manualManHoursPerUnit}
                              onChange={(event) => updateRow(row.line.id, { manualManHoursPerUnit: event.target.value })}
                              placeholder="MH / unit"
                              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            />
                            <input
                              value={row.manualReason}
                              onChange={(event) => updateRow(row.line.id, { manualReason: event.target.value })}
                              placeholder="Reason required"
                              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            />
                            <input
                              value={row.manualSourceNote}
                              onChange={(event) => updateRow(row.line.id, { manualSourceNote: event.target.value })}
                              placeholder="Source note required"
                              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            />
                          </div>
                        ) : row.include ? (
                          <div className="min-w-[260px] space-y-2">
                            <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-600">
                              <Search size={13} className="text-slate-400" />
                              <input
                                value={row.searchText}
                                onChange={(event) => updateRow(row.line.id, { searchText: event.target.value })}
                                placeholder="Search suggested rates"
                                className="min-w-0 flex-1 bg-transparent outline-none"
                              />
                            </label>
                            <select
                              value={row.productionRateId ?? ''}
                              onChange={(event) => {
                                const candidate = candidates.find((item) => item.productionRateId === event.target.value);
                                updateRow(row.line.id, {
                                  productionRateId: event.target.value || null,
                                  status: event.target.value ? 'verified_rate' : 'review_required',
                                  matchConfidence: candidate?.confidence ?? null,
                                  matchReason: candidate?.matchReason ?? null,
                                  issue: event.target.value ? null : row.issue,
                                });
                              }}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            >
                              <option value="">Select work element...</option>
                              {candidates.map((candidate) => (
                                <option key={candidate.productionRateId} value={candidate.productionRateId}>
                                  {formatRateOption(candidate)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.line.id, {
                                  status: 'manual_override',
                                  productionRateId: null,
                                  matchConfidence: null,
                                  matchReason: null,
                                })
                              }
                              className="text-[11px] font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
                            >
                              Use manual MH/unit override
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500">Excluded</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {selectedCandidate ? (
                          <div>
                            <div>{selectedCandidate.unit}</div>
                            <div>{selectedCandidate.manHoursPerUnit.toFixed(3)} MH/unit</div>
                            <div className="text-slate-500">{Math.round(selectedCandidate.confidence * 100)}% confidence</div>
                          </div>
                        ) : row.status === 'manual_override' ? (
                          <div>{row.manualManHoursPerUnit || '--'} MH/{row.line.unit}</div>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600 dark:text-slate-300">
                        {row.issue ?? row.matchReason ?? '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

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
            title={createDisabled ? 'Resolve or exclude every included quantity before creating estimate activities.' : undefined}
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
