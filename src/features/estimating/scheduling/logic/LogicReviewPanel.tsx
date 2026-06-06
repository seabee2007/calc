import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';
import { checkLogicNetwork } from './checkLogicNetwork';
import {
  aiSuggestionsToWarnings,
  requestAiLogicReview,
  type AiLogicSuggestion,
} from './aiLogicReviewService';
import LogicReviewAcceptAllConfirmModal from './LogicReviewAcceptAllConfirmModal';
import LogicReviewWarningCard from './LogicReviewWarningCard';
import type { LogicReviewWarning, LogicWarningCategory, SuggestedLogicLink } from './logicTypes';
import { LOGIC_WARNING_CATEGORY_LABELS } from './logicTypes';
import { dedupeLogicWarnings } from './checkLogicNetwork';
import {
  applyLogicSuggestions,
  buildAcceptAllToastMessage,
  collectVisibleAutoFixLinks,
  filterResolvedAiWarnings,
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

  const handleAcceptAllConfirmed = async () => {
    if (!canAcceptAll || acceptingAll || busy) return;

    const preview = applyLogicSuggestions({
      suggestions: visibleAutoFixLinks,
      existingLinks: logicLinks,
      activities,
    });

    setAcceptingAll(true);
    try {
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

  const handleSuggestWithAi = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiRan(false);
    try {
      const input = {
        activities: activities.map((activity) => ({
          activityCode: activity.activityCode,
          title: activity.activityDescription,
          divisionCode: activity.divisionCode,
          divisionName: activity.divisionName,
          workPackageName: activity.workPackageName,
          durationDays: activity.durationDays,
          crewSize: activity.crewSize,
          laborHours: activity.laborHours,
          scheduleEnabled: true,
        })),
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
              {aiLoading ? 'Reviewing with AI…' : 'Suggest logic with AI'}
            </button>
            <button
              type="button"
              className="rounded-md border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900 disabled:opacity-60"
              disabled={!canAcceptAll || busy || acceptingAll}
              onClick={() => setAcceptAllConfirmOpen(true)}
            >
              {acceptingAll ? 'Accepting…' : 'Accept all'}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              onClick={() => setShowIgnored((value) => !value)}
            >
              {showIgnored ? 'Hide ignored' : 'Show ignored'}
            </button>
          </div>
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
    </div>,
    document.body,
  );
}
