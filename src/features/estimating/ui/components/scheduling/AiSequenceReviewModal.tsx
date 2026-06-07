import { AlertTriangle, CheckCircle, Cpu, Info, Sparkles, XCircle } from 'lucide-react';
import Modal from '../../../../../components/ui/Modal';
import type {
  AiSequenceMissingActivity,
  AiSequenceRejectedSuggestion,
  AiSequenceValidationResult,
} from '../../../scheduling/logic/aiSequenceService';
import { filterSuggestionsByConfidence } from '../../../scheduling/logic/aiSequenceService';
import type { DeterministicSuggestion } from '../../../scheduling/logic/deterministicSequenceBuilder';
import type { SuggestedLogicLink } from '../../../scheduling/logic/logicTypes';

export interface CpmPreviewSummary {
  criticalCount: number;
  projectDurationDays: number;
  overloadedDays: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activityCount: number;
  validationResult: AiSequenceValidationResult;
  onApplySuggested: (links: SuggestedLogicLink[]) => Promise<void>;
  onApplyHighConfidence: (links: SuggestedLogicLink[]) => Promise<void>;
  applying: boolean;
  previewCpmSummary?: CpmPreviewSummary;
}

function sourceBadge(source: DeterministicSuggestion['source']) {
  if (source === 'deterministic') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
        <Cpu size={9} />
        Rule
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
      <Sparkles size={9} />
      AI
    </span>
  );
}

function confidencePill(
  confidence: DeterministicSuggestion['confidence'],
  source: DeterministicSuggestion['source'],
) {
  if (source === 'deterministic') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <CheckCircle size={10} />
        Rule-based
      </span>
    );
  }
  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <CheckCircle size={10} />
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <Info size={10} />
      Medium
    </span>
  );
}

function rejectionBadge(reason: AiSequenceRejectedSuggestion['reason']) {
  const labels: Record<AiSequenceRejectedSuggestion['reason'], string> = {
    'self-link': 'Self-link',
    circular: 'Circular',
    'missing-activity': 'Missing',
    duplicate: 'Duplicate',
    'invalid-type': 'Invalid type',
    'negative-lag': 'Negative lag',
  };
  return (
    <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
      {labels[reason]}
    </span>
  );
}

function suggestionToLink(suggestion: DeterministicSuggestion): SuggestedLogicLink {
  return {
    predecessorActivityCode: suggestion.predecessorActivityCode,
    successorActivityCode: suggestion.successorActivityCode,
    relationshipType: suggestion.relationshipType,
    lagDays: suggestion.lagDays,
    reason: suggestion.reason,
  };
}

export default function AiSequenceReviewModal({
  isOpen,
  onClose,
  activityCount,
  validationResult,
  onApplySuggested,
  onApplyHighConfidence,
  applying,
  previewCpmSummary,
}: Props) {
  const {
    valid,
    rejected,
    missingActivities,
    concreteCureLagCount,
    deterministicCount,
    aiAddedCount,
    matchedActivityCount,
    unmatchedActivityCount,
    unmatchedActivities,
    deterministicWarnings,
    isForcedChainWarning,
    longestChainLength,
    compoundCardAlerts,
  } = validationResult;

  const highCount = valid.filter(
    (s) => s.source === 'deterministic' || s.confidence === 'high',
  ).length;
  const applySuggestedBlocked = isForcedChainWarning;

  const handleApplySuggested = () => {
    if (applySuggestedBlocked) return;
    void onApplySuggested(filterSuggestionsByConfidence(valid, 'all-valid').map(suggestionToLink));
  };

  const handleApplyHighConfidence = () => {
    void onApplyHighConfidence(
      filterSuggestionsByConfidence(valid, 'high-only').map(suggestionToLink),
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Suggested Logic Sequence" size="xl" stackAboveDrawer>
      <div className="space-y-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <SummaryTile label="Activities" value={activityCount} />
          <SummaryTile label="Matched" value={matchedActivityCount} accent="green" />
          <SummaryTile
            label="Unmatched"
            value={unmatchedActivityCount}
            accent={unmatchedActivityCount > 0 ? 'amber' : undefined}
          />
          <SummaryTile label="Rule links" value={deterministicCount} />
          <SummaryTile label="AI links" value={aiAddedCount} />
          <SummaryTile label="Valid total" value={valid.length} accent="green" />
          <SummaryTile
            label="Rejected"
            value={rejected.length}
            accent={rejected.length > 0 ? 'red' : undefined}
          />
          <SummaryTile label="Cure lags" value={concreteCureLagCount} />
        </div>

        {/* CPM Preview summary (shown after CPM has been calculated) */}
        {previewCpmSummary ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
            <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              CPM Preview (deterministic draft)
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-emerald-800 dark:text-emerald-200">
              <span>
                <strong>{previewCpmSummary.criticalCount}</strong> critical activities
              </span>
              <span>
                <strong>{previewCpmSummary.projectDurationDays}</strong> day project duration
              </span>
              {previewCpmSummary.overloadedDays > 0 ? (
                <span className="text-amber-700 dark:text-amber-300">
                  <strong>{previewCpmSummary.overloadedDays}</strong> overloaded crew days (RCS)
                </span>
              ) : (
                <span>No crew overload detected</span>
              )}
            </div>
          </div>
        ) : null}

        {/* Forced-chain warning */}
        {isForcedChainWarning ? (
          <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-4 dark:border-red-600 dark:bg-red-950/50">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Forced straight-line chain detected
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {longestChainLength} of {activityCount} activities (
                  {Math.round((longestChainLength / activityCount) * 100)}%) form a single
                  continuous path. This looks like a forced chain, not a realistic construction
                  network.
                </p>
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  <strong>"Apply Suggested Logic"</strong> is blocked. Use{' '}
                  <strong>"Apply High Confidence Rule Links"</strong> to apply only the strongest
                  dependencies, then wire the rest manually.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Compound card alerts — AI classifier flags messy combined titles */}
        {compoundCardAlerts.length > 0 ? (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
              <Sparkles size={14} />
              Compound card alerts ({compoundCardAlerts.length}) — review titles before applying
            </h3>
            <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-violet-200 dark:border-violet-800">
                    <th className="px-3 py-2 text-left font-medium text-violet-800 dark:text-violet-300">
                      Activity
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-violet-800 dark:text-violet-300">
                      Issue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compoundCardAlerts.map((alert, i) => (
                    <tr
                      key={`${alert.activityCode}-${i}`}
                      className="border-b border-violet-100 last:border-0 dark:border-violet-900"
                    >
                      <td className="px-3 py-1.5 font-mono text-violet-900 dark:text-violet-200">
                        {alert.activityCode}
                      </td>
                      <td className="px-3 py-1.5 text-violet-800 dark:text-violet-300">{alert.issue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              These are informational only. Split compound cards in your estimate to improve rule matching.
            </p>
          </section>
        ) : null}

        {/* Sequencing notes (non-chain warnings) */}
        {deterministicWarnings && deterministicWarnings.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
              Sequencing notes
            </p>
            <ul className="space-y-0.5">
              {deterministicWarnings
                .filter((w) => !w.startsWith('Warning: '))
                .map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {/* Rejected links */}
        {rejected.length > 0 ? (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle size={14} />
              Rejected links ({rejected.length})
            </h3>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-800">
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Predecessor</th>
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Successor</th>
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Reason</th>
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.map((item, i) => (
                    <tr key={i} className="border-b border-amber-100 last:border-0 dark:border-amber-900">
                      <td className="px-3 py-1.5 font-mono text-amber-900 dark:text-amber-200">
                        {item.suggestion.predecessorActivityCode}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-amber-900 dark:text-amber-200">
                        {item.suggestion.successorActivityCode}
                      </td>
                      <td className="px-3 py-1.5">{rejectionBadge(item.reason)}</td>
                      <td className="px-3 py-1.5 text-amber-700 dark:text-amber-400">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Proposed logic links */}
        {valid.length > 0 ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Proposed logic links ({valid.length})
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                {deterministicCount} rule-based · {aiAddedCount} AI-added
              </span>
            </h3>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Successor</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Predecessor</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Lag</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Source</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Confidence</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {valid.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                        {s.successorActivityCode}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                        {s.predecessorActivityCode}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {s.relationshipType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                        {s.lagDays > 0 ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            +{s.lagDays}d
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{sourceBadge(s.source)}</td>
                      <td className="px-3 py-1.5">{confidencePill(s.confidence, s.source)}</td>
                      <td className="max-w-xs px-3 py-1.5 text-slate-600 dark:text-slate-400">
                        {s.reason || s.issue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              "Apply Suggested Logic" applies rule-based + medium/high-confidence AI links.
              "Apply High Confidence Rule Links" applies rule-based + high-confidence AI only.
            </p>
          </section>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <XCircle size={24} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No valid logic links were suggested for the current activity set.
            </p>
          </div>
        )}

        {/* Unmatched activities */}
        {unmatchedActivities && unmatchedActivities.length > 0 ? (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle size={14} />
              Needs Review — unmatched activities ({unmatchedActivities.length})
            </h3>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-800">
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Activity</th>
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-amber-800 dark:text-amber-300">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedActivities.map((a, i) => (
                    <tr key={i} className="border-b border-amber-100 last:border-0 dark:border-amber-900">
                      <td className="px-3 py-1.5 font-mono text-amber-900 dark:text-amber-200">{a.activityCode}</td>
                      <td className="px-3 py-1.5 text-amber-900 dark:text-amber-200">{a.title}</td>
                      <td className="px-3 py-1.5 text-amber-700 dark:text-amber-400">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Recommended missing activities */}
        {missingActivities && missingActivities.length > 0 ? (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Info size={14} className="text-slate-500" />
              Recommended missing activities ({missingActivities.length}) — informational only
            </h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Activity</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Phase</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Reason</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Insert after</th>
                  </tr>
                </thead>
                <tbody>
                  {missingActivities.map((activity: AiSequenceMissingActivity, i: number) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{activity.activityName}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{activity.phase}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{activity.reason}</td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{activity.suggestedInsertionPoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          {applySuggestedBlocked ? (
            <p className="mr-auto text-xs text-red-600 dark:text-red-400">
              Forced chain detected — full apply is blocked. Use High Confidence Rule Links or Cancel.
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
            disabled={applying}
          >
            Cancel
          </button>
          {valid.length > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={handleApplyHighConfidence}
              disabled={applying}
            >
              {applying ? 'Applying…' : `Apply High Confidence Rule Links (${highCount})`}
            </button>
          ) : null}
          {valid.length > 0 ? (
            <button
              type="button"
              title={
                applySuggestedBlocked
                  ? 'Blocked: forced straight-line chain detected. Use High Confidence Rule Links instead.'
                  : undefined
              }
              className={
                applySuggestedBlocked
                  ? 'cursor-not-allowed rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500'
                  : 'rounded-lg border border-cyan-600 bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-700'
              }
              onClick={handleApplySuggested}
              disabled={applying || applySuggestedBlocked}
            >
              {applying ? 'Applying…' : `Apply Suggested Logic (${valid.length})`}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface SummaryTileProps {
  label: string;
  value: number;
  accent?: 'green' | 'red' | 'amber';
}

function SummaryTile({ label, value, accent }: SummaryTileProps) {
  const valueClass =
    accent === 'green'
      ? 'text-emerald-700 dark:text-emerald-300'
      : accent === 'red'
        ? 'text-red-700 dark:text-red-300'
        : accent === 'amber'
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-slate-800 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
