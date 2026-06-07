import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import type { EstimateType } from '../../domain/estimateTypes';
import {
  getScopeModalDescription,
  getScopeModalSubmitLabel,
  getScopeModalTitle,
  type ScopeModalMode,
} from '../../application/estimateStartFlow';
import {
  getCsiDivisionDescription,
  getCsiDivisionByCode,
  getCsiDivisionOptions,
} from '../../domain/csiDivisions';
import { normalizeSelectedDivisionCodes } from '../../application/estimateWorkBreakdown';
import {
  mergeRecommendedDivisionCodes,
  recommendEstimateDivisions,
  RECOMMEND_DIVISIONS_ERROR_MESSAGE,
  type RecommendEstimateDivisionsResponse,
} from '../../application/recommendEstimateDivisions';
import type { EstimateSelectedDivision } from '../../domain/estimateTypes';
import { PLANNER_MUTED, TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

export interface EstimateStartScopeProjectContext {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  locationLabel?: string;
}

interface Props {
  isOpen: boolean;
  estimateType: EstimateType;
  mode?: ScopeModalMode;
  existingDivisionCodes?: readonly string[];
  projectContext?: EstimateStartScopeProjectContext | null;
  onClose: () => void;
  onCreate: (divisions: EstimateSelectedDivision[]) => void;
  onNoNewDivisionsSelected?: () => void;
}

function formatConfidence(value: number): string {
  const percent = Math.round(value * 100);
  if (percent >= 90) return `High confidence: ${percent}%`;
  if (percent >= 75) return `Medium confidence: ${percent}%`;
  return `Low confidence: ${percent}%`;
}

export default function EstimateStartScopeModal({
  isOpen,
  estimateType,
  mode = 'create',
  existingDivisionCodes = [],
  projectContext = null,
  onClose,
  onCreate,
  onNoNewDivisionsSelected,
}: Props) {
  const divisionOptions = useMemo(() => getCsiDivisionOptions(), []);
  const existingCodeSet = useMemo(
    () => new Set(existingDivisionCodes),
    [existingDivisionCodes],
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [recommending, setRecommending] = useState(false);
  const [recommendationResult, setRecommendationResult] =
    useState<RecommendEstimateDivisionsResponse | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const modalTitle = getScopeModalTitle(mode, estimateType);
  const modalDescription = getScopeModalDescription(mode, estimateType);
  const submitLabel = getScopeModalSubmitLabel(mode);

  const newlySelectedCodes = useMemo(
    () =>
      mode === 'add'
        ? selectedCodes.filter((code) => !existingCodeSet.has(code))
        : selectedCodes,
    [existingCodeSet, mode, selectedCodes],
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedCodes([]);
      setRecommending(false);
      setRecommendationResult(null);
      setRecommendationError(null);
    }
  }, [isOpen]);

  const toggleDivision = (code: string) => {
    if (mode === 'add' && existingCodeSet.has(code)) return;
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((value) => value !== code) : [...prev, code],
    );
  };

  const handleCreate = () => {
    const normalized =
      mode === 'add'
        ? normalizeSelectedDivisionCodes(newlySelectedCodes)
        : normalizeSelectedDivisionCodes(selectedCodes);

    if (normalized.length === 0) {
      if (mode === 'add') {
        onNoNewDivisionsSelected?.();
      }
      return;
    }

    const now = new Date().toISOString();
    const recommendationsByCode = new Map(
      recommendationResult?.recommendations.map((item) => [item.code, item]) ?? [],
    );
    const selectedDivisions = normalized.map((code) => {
      const recommendation = recommendationsByCode.get(code);
      const division = getCsiDivisionByCode(code);
      return {
        code,
        name: division?.name ?? recommendation?.name ?? code,
        source: recommendation ? 'ai' : 'manual',
        confidence: recommendation?.confidence,
        reason: recommendation?.reason,
        createdAt: now,
      } satisfies EstimateSelectedDivision;
    });
    onCreate(selectedDivisions);
    onClose();
  };

  const handleRecommendFromScope = async () => {
    if (!projectContext?.projectId || recommending) return;

    setRecommending(true);
    setRecommendationError(null);

    try {
      const result = await recommendEstimateDivisions({
        projectId: projectContext.projectId,
        projectName: projectContext.projectName,
        projectScope: projectContext.projectDescription,
        projectDescription: projectContext.projectDescription,
        location: projectContext.locationLabel,
      });

      setRecommendationResult(result);
      const recommendedCodes =
        mode === 'add'
          ? result.recommendedDivisionCodes.filter((code) => !existingCodeSet.has(code))
          : result.recommendedDivisionCodes;

      setSelectedCodes((prev) => mergeRecommendedDivisionCodes(prev, recommendedCodes));
    } catch {
      setRecommendationError(RECOMMEND_DIVISIONS_ERROR_MESSAGE);
    } finally {
      setRecommending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-4">
        <p className={`text-sm ${PLANNER_MUTED}`}>{modalDescription}</p>

        <div className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          {divisionOptions.map((division) => {
            const alreadyAdded = mode === 'add' && existingCodeSet.has(division.code);
            const checked = alreadyAdded || selectedCodes.includes(division.code);
            const description = getCsiDivisionDescription(division.code);

            return (
              <label
                key={division.code}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  alreadyAdded
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-80 dark:border-slate-700 dark:bg-slate-900/40'
                    : checked
                      ? 'cursor-pointer border-cyan-500/60 bg-cyan-50/70 dark:border-cyan-500/40 dark:bg-cyan-950/30'
                      : 'cursor-pointer border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600"
                  checked={checked}
                  disabled={alreadyAdded}
                  onChange={() => toggleDivision(division.code)}
                />
                <span className="min-w-0 flex-1">
                  <span className={`flex flex-wrap items-center gap-2 text-sm font-medium ${TEXT_FOREGROUND}`}>
                    <span>{division.label}</span>
                    {alreadyAdded ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Already added
                      </span>
                    ) : null}
                  </span>
                  {description ? (
                    <span className={`mt-0.5 block text-xs ${PLANNER_MUTED}`}>{description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <div
          className={`rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/40 ${TEXT_BODY}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              disabled={!projectContext?.projectId || recommending}
              isLoading={recommending}
              onClick={() => void handleRecommendFromScope()}
            >
              {recommending ? 'Reading scope…' : 'Recommend from project scope'}
            </Button>
            <span className={PLANNER_MUTED}>
              AI reads the saved project scope and suggests likely CSI divisions of work.
            </span>
          </div>

          {recommendationError ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{recommendationError}</p>
          ) : null}

          {recommendationResult ? (
            <div className="mt-3 space-y-2">
              <p className={`text-sm font-medium ${TEXT_FOREGROUND}`}>
                Recommended {recommendationResult.recommendedDivisionCodes.length} divisions from
                project scope
              </p>

              {recommendationResult.warnings?.map((warning) => (
                <p key={warning} className="text-sm text-amber-800 dark:text-amber-200">
                  {warning}
                </p>
              ))}

              <ul className={`space-y-2 text-sm ${PLANNER_MUTED}`}>
                {recommendationResult.recommendations.map((item) => {
                  const alreadyAdded = mode === 'add' && existingCodeSet.has(item.code);
                  return (
                    <li key={item.code}>
                      <span className={`font-medium ${TEXT_FOREGROUND}`}>
                        {item.code} - {item.name}
                      </span>
                      {alreadyAdded ? (
                        <span className="ml-1 text-xs uppercase tracking-wide text-slate-500">
                          (already added)
                        </span>
                      ) : (
                        <span className="ml-1">({formatConfidence(item.confidence)})</span>
                      )}
                      <span className="mt-0.5 block">{item.reason}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={newlySelectedCodes.length === 0}
            onClick={handleCreate}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
