import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, X, ChevronRight } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import type { ScopeDivisionSuggestion } from '../../domain/aiActivitySuggestionTypes';
import { getCsiDivisionByCode } from '../../domain/csiDivisions';
import {
  suggestDivisionsFromScope,
  SUGGEST_DIVISIONS_ERROR_MESSAGE,
  type SuggestDivisionsFromScopeResponse,
} from '../../application/suggestEstimateActivitiesFromScope';
import { PLANNER_MUTED, TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';
import type { SuggestEstimateActivitiesFilterMode } from '../../domain/aiActivitySuggestionTypes';

export interface ImportFromScopeProjectContext {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  locationLabel?: string;
  estimateType?: string;
}

interface Props {
  isOpen: boolean;
  projectContext: ImportFromScopeProjectContext;
  /** Divisions already on the estimate — used for duplicate prevention. */
  existingDivisionCodes?: readonly string[];
  onClose: () => void;
  onDivisionsAdded?: () => void;
  onAddSelectedDivisions: (divisionCodes: string[]) => Promise<void>;
  saving?: boolean;
}

type WizardStep = 'input' | 'review' | 'summary';

type ReviewDivision = ScopeDivisionSuggestion & {
  selected: boolean;
  alreadyOnEstimate: boolean;
};

function formatConfidenceLabel(confidence: ScopeDivisionSuggestion['confidence']): string {
  if (confidence === 'high') return 'High';
  if (confidence === 'medium') return 'Medium';
  return 'Low';
}

function confidenceBadgeClass(confidence: ScopeDivisionSuggestion['confidence']): string {
  if (confidence === 'high') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (confidence === 'medium') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
}

export default function ImportFromScopeModal({
  isOpen,
  projectContext,
  existingDivisionCodes = [],
  onClose,
  onDivisionsAdded,
  onAddSelectedDivisions,
  saving = false,
}: Props) {
  const [step, setStep] = useState<WizardStep>('input');
  const [scopeText, setScopeText] = useState('');
  const [filterMode, setFilterMode] = useState<SuggestEstimateActivitiesFilterMode>('allFromScope');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestResult, setSuggestResult] = useState<SuggestDivisionsFromScopeResponse | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewDivision[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const existingDivisionSet = useMemo(
    () => new Set(existingDivisionCodes),
    [existingDivisionCodes],
  );

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setScopeText('');
      setSuggesting(false);
      setSuggestError(null);
      setSuggestResult(null);
      setReviewItems([]);
      setAdding(false);
      setAddError(null);
      setAddedCount(0);
      setFilterMode('allFromScope');
      return;
    }
    if (projectContext.projectDescription?.trim()) {
      setScopeText(projectContext.projectDescription.trim());
    }
  }, [isOpen, projectContext.projectDescription]);

  const acceptedDivisions = useMemo(
    () => reviewItems.filter((item) => item.selected && !item.alreadyOnEstimate),
    [reviewItems],
  );

  const buildReviewItems = useCallback(
    (divisions: ScopeDivisionSuggestion[]): ReviewDivision[] =>
      divisions.map((division) => ({
        ...division,
        selected:
          !existingDivisionSet.has(division.divisionCode) && division.confidence !== 'low',
        alreadyOnEstimate: existingDivisionSet.has(division.divisionCode),
        status: existingDivisionSet.has(division.divisionCode) ? 'suggested' : 'suggested',
      })),
    [existingDivisionSet],
  );

  const handleSuggest = async () => {
    if (!scopeText.trim() || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);

    try {
      const result = await suggestDivisionsFromScope({
        projectId: projectContext.projectId,
        scopeText: scopeText.trim(),
        acceptedDivisions:
          existingDivisionCodes.length > 0 ? [...existingDivisionCodes] : undefined,
        filterMode,
        projectName: projectContext.projectName,
        location: projectContext.locationLabel,
        estimateType: projectContext.estimateType,
      });

      setSuggestResult(result);
      setReviewItems(buildReviewItems(result.divisions));
      setStep('review');
    } catch {
      setSuggestError(SUGGEST_DIVISIONS_ERROR_MESSAGE);
    } finally {
      setSuggesting(false);
    }
  };

  const updateItem = useCallback((id: string, patch: Partial<ReviewDivision>) => {
    setReviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const handleAccept = (id: string) => {
    const item = reviewItems.find((row) => row.id === id);
    if (!item || item.alreadyOnEstimate) return;
    updateItem(id, { selected: true, status: 'accepted' });
  };

  const handleReject = (id: string) => {
    updateItem(id, { selected: false, status: 'rejected' });
  };

  const handleAcceptAll = () => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.alreadyOnEstimate
          ? item
          : { ...item, selected: true, status: 'accepted' as const },
      ),
    );
  };

  const handleAcceptHighConfidence = () => {
    setReviewItems((prev) =>
      prev.map((item) => {
        if (item.alreadyOnEstimate || item.status === 'rejected') return item;
        return {
          ...item,
          selected: item.confidence === 'high',
          status: item.confidence === 'high' ? ('accepted' as const) : item.status,
        };
      }),
    );
  };

  const handleDeselectAll = () => {
    setReviewItems((prev) =>
      prev.map((item) => ({ ...item, selected: false, status: 'suggested' as const })),
    );
  };

  const handleAddSelectedDivisions = async () => {
    if (acceptedDivisions.length === 0 || adding) return;
    setAdding(true);
    setAddError(null);

    try {
      const divisionCodes = acceptedDivisions.map((item) => item.divisionCode);
      await onAddSelectedDivisions(divisionCodes);
      setAddedCount(divisionCodes.length);
      onDivisionsAdded?.();
      setStep('summary');
    } catch {
      setAddError('Could not add selected divisions. Try again.');
    } finally {
      setAdding(false);
    }
  };

  const modalTitle =
    step === 'input'
      ? 'Import from Scope'
      : step === 'review'
        ? 'Review Suggested Divisions'
        : 'Divisions Added';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-4">
        {step === 'input' && (
          <>
            <p className={`text-sm ${PLANNER_MUTED}`}>
              AI will suggest applicable CSI divisions from the scope. No activities or line items
              are created — add production-rate-backed activities manually afterward.
            </p>

            <label className={`block text-sm font-medium ${TEXT_FOREGROUND}`}>
              Scope text
              <textarea
                value={scopeText}
                onChange={(event) => setScopeText(event.target.value)}
                rows={8}
                placeholder="Paste scope of work, proposal request, or project description…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className={`block text-sm font-medium ${TEXT_FOREGROUND}`}>
              Division filter
              <select
                value={filterMode}
                onChange={(event) =>
                  setFilterMode(event.target.value as SuggestEstimateActivitiesFilterMode)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="allFromScope">All applicable divisions from scope</option>
                <option value="selectedDivisionsOnly">
                  Only currently selected divisions
                  {existingDivisionCodes.length > 0 ? ` (${existingDivisionCodes.length})` : ''}
                </option>
              </select>
            </label>

            {filterMode === 'selectedDivisionsOnly' && existingDivisionCodes.length === 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                No divisions are selected on this estimate yet. Choose “All applicable divisions
                from scope” or select divisions on the estimate first.
              </p>
            ) : null}

            {suggestError ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">{suggestError}</p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                disabled={
                  !scopeText.trim() ||
                  suggesting ||
                  (filterMode === 'selectedDivisionsOnly' && existingDivisionCodes.length === 0)
                }
                onClick={handleSuggest}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                {suggesting ? 'Analyzing scope…' : 'Suggest Divisions'}
              </Button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            {(suggestResult?.fallbackUsed ||
              (suggestResult?.notes?.length ?? 0) > 0 ||
              (suggestResult?.warnings?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-amber-300/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                {suggestResult?.fallbackUsed ? (
                  <p>Keyword-based fallback was used — review suggestions carefully.</p>
                ) : null}
                {suggestResult?.notes?.map((note) => (
                  <p key={note}>{note}</p>
                ))}
                {suggestResult?.warnings?.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAcceptAll}>
                Accept all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleAcceptHighConfidence}>
                Accept high confidence
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
                Deselect all
              </Button>
            </div>

            {reviewItems.length === 0 ? (
              <p className={`text-sm ${PLANNER_MUTED}`}>
                No divisions matched this scope. Try adding more detail to the scope text.
              </p>
            ) : (
              <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto">
                {reviewItems.map((item) => {
                  const divisionLabel =
                    getCsiDivisionByCode(item.divisionCode)?.label ??
                    `${item.divisionCode} — ${item.divisionName}`;
                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700 ${
                        item.status === 'rejected' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
                          checked={item.selected}
                          disabled={item.alreadyOnEstimate || item.status === 'rejected'}
                          onChange={(event) =>
                            updateItem(item.id, {
                              selected: event.target.checked,
                              status: event.target.checked ? 'accepted' : 'suggested',
                            })
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-medium ${TEXT_FOREGROUND}`}>
                              {divisionLabel}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(item.confidence)}`}
                            >
                              {formatConfidenceLabel(item.confidence)}
                            </span>
                            {item.alreadyOnEstimate ? (
                              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                Already on estimate
                              </span>
                            ) : null}
                            {item.status === 'rejected' ? (
                              <span className="text-[10px] uppercase tracking-wide text-red-600">
                                Rejected
                              </span>
                            ) : null}
                          </div>
                          <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>{item.reason}</p>
                          {item.sourceExcerpt ? (
                            <p className={`mt-1 text-xs italic ${TEXT_BODY}`}>
                              “{item.sourceExcerpt}”
                            </p>
                          ) : null}
                          {item.suggestedWorkAreas && item.suggestedWorkAreas.length > 0 ? (
                            <p className={`mt-1.5 text-xs ${PLANNER_MUTED}`}>
                              Work areas: {item.suggestedWorkAreas.join(', ')}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAccept(item.id)}
                            disabled={item.alreadyOnEstimate}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/40"
                            title="Accept"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(item.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Reject"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  disabled={acceptedDivisions.length === 0 || adding || saving}
                  onClick={handleAddSelectedDivisions}
                >
                  {adding ? 'Adding divisions…' : `Add Selected Divisions (${acceptedDivisions.length})`}
                  {!adding ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
                </Button>
              </div>
            </div>

            {addError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
            ) : null}
          </>
        )}

        {step === 'summary' && (
          <>
            <p className={`text-sm ${TEXT_BODY}`}>
              Added {addedCount} division{addedCount === 1 ? '' : 's'} to this estimate. No
              activities were created — add production-rate-backed activities from the library to
              begin pricing.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="accent" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
