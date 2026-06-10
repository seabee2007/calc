/**
 * Construction Activity Card — one expandable card per ProjectConstructionActivity.
 *
 * Header: activity code + title + rollup stats + schedule toggle + delete button.
 * Body (expanded): column header row + ActivityLineItemRow per child line item.
 *
 * Line items are NEVER schedule activities — only the parent card has a schedule toggle.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Trash2, AlertTriangle, ClipboardList, Pencil } from 'lucide-react';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { getConstructionActivityWarnings, hasConstructionActivityEstimateWarnings } from '../../domain/constructionActivityCalculations';
import ActivityLineItemRow from './ActivityLineItemRow';
import ActivityProgressSummary from './ActivityProgressSummary';
import ActivityProgressForm from './ActivityProgressForm';
import { useActivityProgress } from '../hooks/useActivityProgress';

interface Props {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  onDelete?: (id: string) => void;
  onEdit?: (activity: ProjectConstructionActivity, lineItems: ProjectActivityLineItem[]) => void;
  defaultExpanded?: boolean;
  currentProjectDay?: number;
}

function StatChip({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col items-center rounded bg-slate-100 dark:bg-slate-700/60 px-2 py-1 min-w-[56px]">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-none mb-0.5">
        {label}
      </span>
      <span className="tabular-nums text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">
        {value}
        {unit && <span className="text-[10px] font-normal ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function ConstructionActivityCard({
  activity,
  lineItems,
  onDelete,
  onEdit,
  defaultExpanded = false,
  currentProjectDay = 0,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'estimate' | 'field'>('estimate');
  const [showProgressForm, setShowProgressForm] = useState(false);

  const { rollup, baseline, saving, submitUpdate } = useActivityProgress(
    activity,
    currentProjectDay,
  );

  const mh = activity.calculatedManHours ?? 0;
  const dur = activity.effectiveDurationDays ?? activity.calculatedDurationDays ?? 0;
  const hasOverride = activity.durationDaysOverride != null;
  const hasWarnings = hasConstructionActivityEstimateWarnings(activity, lineItems);
  const warningMessages = getConstructionActivityWarnings(activity, lineItems);

  const totalCost = activity.totalCost ?? 0;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90 transition-shadow hover:shadow-md">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-3 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        aria-expanded={expanded}
      >
        {/* Expand chevron */}
        <span className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        {/* Division badge + code */}
        <span className="shrink-0 rounded bg-cyan-100 dark:bg-cyan-900/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-700 dark:text-cyan-300">
          {activity.divisionCode}
        </span>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {activity.title ?? activity.name}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {activity.activityCode ?? activity.code}
          </p>
          {(activity.instanceLabel || activity.location || activity.drawingReference) && (
            <p className="truncate text-[10px] text-slate-500">
              {[activity.instanceLabel, activity.location, activity.drawingReference].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>

        {hasWarnings && (
          <span className="shrink-0 text-amber-500" title={warningMessages.join(' ')}>
            <AlertTriangle size={14} />
          </span>
        )}

        {/* Schedule badge */}
        {activity.scheduleEnabled && (
          <span className="shrink-0 rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300 flex items-center gap-1">
            <Calendar size={10} />
            Scheduled
          </span>
        )}

        {/* Rollup chips */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <StatChip label="MH" value={mh.toFixed(1)} />
          <StatChip
            label="Duration"
            value={`${dur}`}
            unit={`d${hasOverride ? '*' : ''}`}
          />
          {lineItems.length > 0 && (
            <StatChip label="Items" value={`${lineItems.length}`} />
          )}
          {totalCost > 0 && (
            <StatChip label="Cost" value={`$${(totalCost / 1000).toFixed(1)}k`} />
          )}
        </div>

        {/* Mobile stats */}
        <div className="sm:hidden text-right shrink-0">
          <p className="tabular-nums text-xs font-bold text-cyan-700 dark:text-cyan-400">
            {mh.toFixed(1)} MH
          </p>
          <p className="text-[10px] text-slate-500">{dur}d • {lineItems.length} items</p>
        </div>

        {/* Field progress indicator */}
        {rollup && rollup.updateCount > 0 && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
            title="Field progress logged"
          >
            {rollup.percentComplete}%
          </span>
        )}

        {/* Edit */}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(activity, lineItems);
            }}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800 dark:hover:text-cyan-300 transition-colors"
            title="Edit activity"
          >
            <Pencil size={14} />
          </button>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(activity.id);
            }}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="Remove activity"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Expanded body ────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <button
              type="button"
              onClick={() => setActiveTab('estimate')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === 'estimate'
                  ? 'border-b-2 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Estimate
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('field')}
              className={`px-4 py-2 text-xs font-medium flex items-center gap-1 transition-colors ${
                activeTab === 'field'
                  ? 'border-b-2 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <ClipboardList size={11} />
              Field Control
              {rollup && rollup.updateCount > 0 && (
                <span className="ml-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 text-[9px] font-bold">
                  {rollup.updateCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'estimate' && (
            <>
              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Work Element
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Qty / Unit
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Rate
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Man-Hours
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Cost
                </span>
              </div>

              {lineItems.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-400 italic">
                  No line items. Delete and re-add with quantities.
                </div>
              ) : (
                lineItems.map((item, i) => (
                  <ActivityLineItemRow key={item.id} item={item} index={i} />
                ))
              )}

              {/* Footer: rollup summary */}
              <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-2">
                <span className="text-xs text-slate-500">
                  Crew: <strong>{activity.crewSize}</strong> &bull; {activity.hoursPerDay}h/day
                </span>
                <span className="text-xs text-slate-500">
                  Calc duration: <strong>{activity.calculatedDurationDays ?? 0}d</strong>
                  {hasOverride && (
                    <> → Override: <strong className="text-amber-600">{activity.durationDaysOverride}d</strong></>
                  )}
                </span>
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 ml-auto">
                  {mh.toFixed(2)} MH total
                </span>
              </div>
            </>
          )}

          {activeTab === 'field' && (
            <div className="p-3">
              {rollup ? (
                <ActivityProgressSummary
                  rollup={rollup}
                  baseline={baseline}
                  onLogProgress={() => setShowProgressForm(true)}
                />
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-sm text-slate-500">No field progress logged yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowProgressForm(true)}
                    className="rounded bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                  >
                    Log Today's Progress
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress form modal */}
      {showProgressForm && (
        <ActivityProgressForm
          projectActivityId={activity.id}
          projectId={activity.projectId}
          activityTitle={activity.title ?? activity.name ?? ''}
          unit="MH"
          originalQuantity={activity.calculatedManHours ?? 0}
          latestUpdate={rollup ? (rollup.updateCount > 0 ? null : null) : null}
          saving={saving}
          onSubmit={async (input) => {
            const ok = await submitUpdate(input);
            if (ok) setShowProgressForm(false);
          }}
          onCancel={() => setShowProgressForm(false)}
        />
      )}
    </div>
  );
}
