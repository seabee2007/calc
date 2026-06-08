import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { getMasterActivityCsiContext } from '../../data/masterActivityIndex';
import type { CpmLogicLink } from '../cpmTypes';
import { checkLogicNetwork } from './checkLogicNetwork';
import {
  aiSuggestionsToWarnings,
  requestAiLogicReview,
  type AiLogicSuggestion,
} from './aiLogicReviewService';
import LogicReviewAcceptAllConfirmModal from './LogicReviewAcceptAllConfirmModal';
import LogicReviewClearAllConfirmModal from './LogicReviewClearAllConfirmModal';
import LogicReviewRevertBatchConfirmModal from './LogicReviewRevertBatchConfirmModal';
import LogicReviewWarningCard from './LogicReviewWarningCard';
import type { LogicReviewWarning, LogicWarningCategory, SuggestedLogicLink } from './logicTypes';
import { LOGIC_WARNING_CATEGORY_LABELS } from './logicTypes';
import { dedupeLogicWarnings } from './checkLogicNetwork';
import {
  applyLogicSuggestions,
  buildAcceptAllToastMessage,
  collectUnsafeLogicLinkIssues,
  collectVisibleAutoFixLinks,
  filterResolvedAiWarnings,
  summarizeSkippedLogicSuggestions,
  summarizeUnsafeLogicLinkIssues,
  type ApplyLogicSuggestionSkip,
} from './logicReviewUtils';

const CATEGORY_ORDER: LogicWarningCategory[] = [
  'missingLikelyPredecessor',
  'outOfSequence',
  'duplicateActivityCode',
  'circularDependency',
  'missingPredecessorReference',
  'noPredecessor',
  'noSuccessor',
  'missingDuration',
  'missingCrewData',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  ignoredWarningIds: string[];
  onAddSuggestedLinks: (links: SuggestedLogicLink[]) => Promise<void>;
  onIgnoreWarning: (warningId: string) => Promise<void>;
  onRevertLastBatch?: () => Promise<void>;
  onClearAllLogicLinks?: () => Promise<void>;
  onRemoveLogicLink?: (link: CpmLogicLink) => Promise<void>;
  hasLogicBatch?: boolean;
  logicBatchAddedCount?: number;
  onNotify?: (message: string, variant?: 'success' | 'error') => void;
  busy?: boolean;
}

export default function LogicReviewPanel({
  isOpen,
  onClose,
  activities,
  logicLinks,
  ignoredWarningIds,
  onAddSuggestedLinks,
  onIgnoreWarning,
  onRevertLastBatch,
  onClearAllLogicLinks,
  onRemoveLogicLink,
  hasLogicBatch = false,
  logicBatchAddedCount = 0,
  onNotify,
  busy = false,
}: Props) {
  const [showIgnored, setShowIgnored] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<LogicReviewWarning[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRan, setAiRan] = useState(false);
  const [acceptAllConfirmOpen, setAcceptAllConfirmOpen] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [revertingBatch, setRevertingBatch] = useState(false);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [repairExpanded, setRepairExpanded] = useState(false);
  const [repairToolsExpanded, setRepairToolsExpanded] = useState(false);
  const [lastSkipped, setLastSkipped] = useState<ApplyLogicSuggestionSkip[]>([]);

  const reviewInput = useMemo(
    () => ({
      activities: activities.map((activity) => ({
        activityCode: activity.activityCode,
        activityDescription: activity.activityDescription,
        divisionCode: activity.divisionCode,
        workPackageName: activity.workPackageName,
        durationDays: activity.durationDays,
        crewSize: activity.crewSize,
        predecessorActivityCode: activity.predecessorActivityCode,
      })),
      logicLinks,
      ignoredWarningIds,
      showIgnored,
    }),
    [activities, ignoredWarningIds, logicLinks, showIgnored],
  );

  const deterministicResult = useMemo(() => checkLogicNetwork(reviewInput), [reviewInput]);
  const allWarnings = useMemo(
    () => dedupeLogicWarnings([...deterministicResult.warnings, ...aiWarnings]),
    [aiWarnings, deterministicResult.warnings],
  );

  const groupedWarnings = useMemo(() => {
    const groups = new Map<LogicWarningCategory, LogicReviewWarning[]>();
    for (const category of CATEGORY_ORDER) {
      groups.set(category, []);
    }
    for (const warning of allWarnings) {
      const bucket = groups.get(warning.category) ?? [];
      bucket.push(warning);
      groups.set(warning.category, bucket);
    }
    return groups;
  }, [allWarnings]);

  const visibleAutoFixLinks = useMemo(
    () => collectVisibleAutoFixLinks(allWarnings),
    [allWarnings],
  );
  const canAcceptAll = visibleAutoFixLinks.length > 0;

  const unsafeIssues = useMemo(
    () => collectUnsafeLogicLinkIssues({ logicLinks, activities }),
    [activities, logicLinks],
  );
  const unsafeIssueSummary = useMemo(
    () => summarizeUnsafeLogicLinkIssues(unsafeIssues),
    [unsafeIssues],
  );
  const skippedSummary = useMemo(
    () => summarizeSkippedLogicSuggestions(lastSkipped),
    [lastSkipped],
  );

  const handleAcceptAllConfirmed = async () => {
    if (!canAcceptAll || acceptingAll || busy) return;

    const preview = applyLogicSuggestions({
      suggestions: visibleAutoFixLinks,
      existingLinks: logicLinks,
      activities,
    });

    setAcceptingAll(true);
    try {
      setLastSkipped(preview.skipped);

      if (preview.added.length === 0) {
        const toast = buildAcceptAllToastMessage(0, preview.skipped.length);
        onNotify?.(toast.message, toast.variant);
        setAcceptAllConfirmOpen(false);
        return;
      }

      await onAddSuggestedLinks(preview.added);
      setAiWarnings((current) => filterResolvedAiWarnings(current, logicLinks, preview.added));
      const toast = buildAcceptAllToastMessage(preview.added.length, preview.skipped.length);
      onNotify?.(toast.message, toast.variant);
      setAcceptAllConfirmOpen(false);
    } catch {
      onNotify?.('Could not accept logic suggestions', 'error');
    } finally {
      setAcceptingAll(false);
    }
  };

  const handleRevertConfirmed = async () => {
    if (!onRevertLastBatch || revertingBatch || busy) return;
    setRevertingBatch(true);
    try {
      await onRevertLastBatch();
      onNotify?.('Reverted last AI logic changes', 'success');
      setRevertConfirmOpen(false);
    } catch {
      onNotify?.('Could not revert last AI logic changes', 'error');
    } finally {
      setRevertingBatch(false);
    }
  };

  const handleClearAllConfirmed = async () => {
    if (!onClearAllLogicLinks || clearingAll || busy) return;
    setClearingAll(true);
    try {
      await onClearAllLogicLinks();
      onNotify?.('Cleared all logic links', 'success');
      setClearAllConfirmOpen(false);
    } catch {
      onNotify?.('Could not clear logic links', 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleSuggestWithAi = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiRan(false);
    try {
      const input = {
        activities: activities.map((activity) => {
          const masterCsi = getMasterActivityCsiContext(
            activity.masterActivityCode ?? activity.activityCode,
          );
          return {
            activityCode: activity.activityCode,
            title: activity.activityDescription,
            divisionCode: activity.divisionCode,
            divisionName: activity.divisionName,
            workPackageName: activity.workPackageName,
            durationDays: activity.durationDays,
            crewSize: activity.crewSize,
            laborHours: activity.laborHours,
            scheduleEnabled: true,
            csiDivisionCode: masterCsi.csiDivisionCode,
            csiSectionCode: masterCsi.csiSectionCode,
          };
        }),
        logicLinks,
      };
      const suggestions: AiLogicSuggestion[] = await requestAiLogicReview(input);
      setAiWarnings(aiSuggestionsToWarnings(suggestions));
      setAiRan(true);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Could not run AI logic review.');
    } finally {
      setAiLoading(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const criticalCount = allWarnings.filter((warning) => warning.severity === 'critical').length;
  const warningCount = allWarnings.filter((warning) => warning.severity === 'warning').length;
  const infoCount = allWarnings.filter((warning) => warning.severity === 'info').length;

  return createPortal(
    <div className="fixed inset-0 z-[10080] flex justify-end bg-black/50">
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-labelledby="logic-review-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 id="logic-review-title" className="text-lg font-semibold text-white">
              Logic Review
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Review likely missing construction sequence links. Nothing changes until you approve a
              link.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close logic review"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-800 px-5 py-3 text-sm text-slate-300">
          <div className="flex flex-wrap gap-4">
            <span>
              Critical issues: <strong className="text-rose-300">{criticalCount}</strong>
            </span>
            <span>
              Warnings: <strong className="text-amber-300">{warningCount}</strong>
            </span>
            <span>
              Info: <strong className="text-slate-200">{infoCount}</strong>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-cyan-700 bg-cyan-950 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-900 disabled:opacity-60"
              disabled={aiLoading || busy || acceptingAll}
              onClick={() => void handleSuggestWithAi()}
            >
              {aiLoading ? 'Reviewing with AI…' : 'Suggest precedence links'}
            </button>
            <button
              type="button"
              className="rounded-md border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900 disabled:opacity-60"
              disabled={!canAcceptAll || busy || acceptingAll}
              onClick={() => setAcceptAllConfirmOpen(true)}
            >
              {acceptingAll ? 'Accepting…' : 'Accept all'}
            </button>
            {hasLogicBatch ? (
              <button
                type="button"
                className="rounded-md border border-amber-700 bg-amber-950 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900 disabled:opacity-60"
                disabled={busy || acceptingAll || revertingBatch}
                onClick={() => setRevertConfirmOpen(true)}
              >
                {revertingBatch ? 'Reverting…' : 'Revert last AI changes'}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              onClick={() => setShowIgnored((value) => !value)}
            >
              {showIgnored ? 'Hide ignored' : 'Show ignored'}
            </button>
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
              onClick={() => setRepairToolsExpanded((value) => !value)}
            >
              {repairToolsExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Repair unsafe logic
            </button>
            {repairToolsExpanded ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                  disabled={busy || clearingAll}
                  onClick={() => setClearAllConfirmOpen(true)}
                >
                  Clear all logic links
                </button>
              </div>
            ) : null}
          </div>

          {skippedSummary.length > 0 ? (
            <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
              <p className="font-medium text-slate-200">Skipped:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {skippedSummary.map((entry) => (
                  <li key={entry.reason}>
                    {entry.count} {entry.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {aiError ? (
            <p className="mt-2 rounded-md bg-rose-950/60 px-3 py-2 text-xs text-rose-300">
              {aiError.toLowerCase().includes('openai_api_key') ||
              aiError.toLowerCase().includes('not configured')
                ? 'AI logic review is not available — OPENAI_API_KEY is not set on the server. Run: supabase secrets set OPENAI_API_KEY=your_key_here, then redeploy.'
                : aiError}
            </p>
          ) : null}
          {!aiError && aiRan && aiWarnings.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-cyan-900 px-3 py-2 text-xs text-cyan-400">
              AI found no additional logic suggestions. For better results, use specific activity
              titles like &ldquo;Pull wire circuits 1A&rdquo; rather than &ldquo;Electrical
              work.&rdquo;
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {unsafeIssues.length > 0 ? (
            <section className="mb-6 rounded-lg border border-rose-900/70 bg-rose-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-rose-200">Repair unsafe logic</h3>
                  <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
                    {unsafeIssueSummary.map((entry) => (
                      <li key={entry.type}>
                        {entry.count} {entry.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-rose-800 px-2 py-1 text-xs text-rose-100 hover:bg-rose-900/40"
                  onClick={() => setRepairExpanded((value) => !value)}
                >
                  {repairExpanded ? 'Hide details' : 'Review and fix'}
                </button>
              </div>
              {repairExpanded ? (
                <ul className="mt-3 space-y-2">
                  {unsafeIssues.map((issue, index) => (
                    <li
                      key={`${issue.type}-${issue.link.predecessorActivityCode}-${issue.link.successorActivityCode}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-rose-900/50 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                    >
                      <span>{issue.message}</span>
                      {onRemoveLogicLink ? (
                        <button
                          type="button"
                          className="shrink-0 rounded border border-rose-800 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-900/40 disabled:opacity-60"
                          disabled={busy}
                          onClick={() => void onRemoveLogicLink(issue.link)}
                        >
                          Remove link
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {allWarnings.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              {aiRan
                ? 'No logic review issues found. Your schedule looks well-sequenced.'
                : 'No logic review issues found for the current activity list.'}
            </p>
          ) : (
            <div className="space-y-6">
              {CATEGORY_ORDER.map((category) => {
                const warnings = groupedWarnings.get(category) ?? [];
                if (warnings.length === 0) return null;
                return (
                  <section key={category}>
                    <h3 className="text-sm font-semibold text-slate-200">
                      {LOGIC_WARNING_CATEGORY_LABELS[category]} ({warnings.length})
                    </h3>
                    <div className="mt-3 space-y-3">
                      {warnings.map((warning) => (
                        <LogicReviewWarningCard
                          key={warning.id}
                          warning={warning}
                          busy={busy || acceptingAll}
                          onAddSuggestedLink={(link) => void onAddSuggestedLinks([link])}
                          onAddAllSuggestedLinks={(links) => void onAddSuggestedLinks(links)}
                          onIgnore={(warningId) => void onIgnoreWarning(warningId)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <LogicReviewAcceptAllConfirmModal
        isOpen={acceptAllConfirmOpen}
        suggestionCount={visibleAutoFixLinks.length}
        accepting={acceptingAll}
        onClose={() => {
          if (!acceptingAll) setAcceptAllConfirmOpen(false);
        }}
        onConfirm={() => void handleAcceptAllConfirmed()}
      />
      <LogicReviewRevertBatchConfirmModal
        isOpen={revertConfirmOpen}
        addedLinkCount={logicBatchAddedCount}
        reverting={revertingBatch}
        onClose={() => {
          if (!revertingBatch) setRevertConfirmOpen(false);
        }}
        onConfirm={() => void handleRevertConfirmed()}
      />
      <LogicReviewClearAllConfirmModal
        isOpen={clearAllConfirmOpen}
        linkCount={logicLinks.length}
        clearing={clearingAll}
        onClose={() => {
          if (!clearingAll) setClearAllConfirmOpen(false);
        }}
        onConfirm={() => void handleClearAllConfirmed()}
      />
    </div>,
    document.body,
  );
}
