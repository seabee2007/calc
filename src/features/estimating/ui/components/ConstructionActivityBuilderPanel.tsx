/**
 * Construction Activity Builder Panel (Milestone 4)
 *
 * Replaces the flat EstimateDomainTask model for the "Activities" tab.
 * Hierarchy: Division accordion → ConstructionActivityCard → ActivityLineItemRows.
 *
 * Guardrails:
 *  - ProjectActivityLineItem is NEVER schedule-enabled.
 *  - Only ProjectConstructionActivity can be schedule-enabled.
 *  - Does not modify CPM, Logic Network, or existing estimate tables.
 */
import { useCallback, useMemo, useState } from 'react';
import { Plus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ConstructionActivityCard from './ConstructionActivityCard';
import AssemblyPickerModal from './AssemblyPickerModal';
import EditConstructionActivityModal from './EditConstructionActivityModal';
import { useConstructionActivities } from '../hooks/useConstructionActivities';
import { useProjectLaborRates } from '../hooks/useProjectLaborRates';
import type { AddFromAssemblyParams } from '../hooks/useConstructionActivities';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import type { UpdateProjectActivityInput } from '../../application/constructionActivityService';

interface Props {
  projectId: string;
  estimateId?: string;
  /** Called after any add/delete so the workspace can refresh its schedule source. */
  onActivitiesChanged?: () => void;
}

/** Group activities by divisionCode for the accordion. */
function groupByDivision(
  activities: ProjectConstructionActivity[],
): Array<{ divisionCode: string; divisionName: string; items: ProjectConstructionActivity[] }> {
  const map = new Map<string, { divisionName: string; items: ProjectConstructionActivity[] }>();
  for (const a of activities) {
    const code = a.divisionCode;
    if (!map.has(code)) {
      map.set(code, { divisionName: a.divisionName, items: [] });
    }
    map.get(code)!.items.push(a);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([divisionCode, v]) => ({ divisionCode, ...v }));
}

export default function ConstructionActivityBuilderPanel({ projectId, estimateId, onActivitiesChanged }: Props) {
  const { activities, lineItemsMap, loading, saving, error, reload, addFromAssembly, updateActivity, remove } =
    useConstructionActivities(projectId, estimateId);
  const { defaultRate } = useProjectLaborRates(projectId);

  const [showPicker, setShowPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<{
    activity: ProjectConstructionActivity;
    lineItems: ProjectActivityLineItem[];
  } | null>(null);

  const groups = useMemo(() => groupByDivision(activities), [activities]);

  const totalMH = useMemo(
    () => activities.reduce((sum, a) => sum + (a.calculatedManHours ?? 0), 0),
    [activities],
  );

  const totalLaborCost = useMemo(
    () => activities.reduce((sum, a) => sum + (a.totalLaborCost ?? 0), 0),
    [activities],
  );

  const totalScheduled = useMemo(
    () => activities.filter((a) => a.scheduleEnabled).length,
    [activities],
  );

  const handleAdd = useCallback(
    async (params: AddFromAssemblyParams) => {
      await addFromAssembly(params);
      setShowPicker(false);
      onActivitiesChanged?.();
    },
    [addFromAssembly, onActivitiesChanged],
  );

  const handleEditSave = useCallback(
    async (params: UpdateProjectActivityInput) => {
      await updateActivity(params);
      setEditingActivity(null);
      onActivitiesChanged?.();
    },
    [onActivitiesChanged, updateActivity],
  );

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteConfirm(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirm) {
      await remove(deleteConfirm);
      setDeleteConfirm(null);
      onActivitiesChanged?.();
    }
  }, [deleteConfirm, remove, onActivitiesChanged]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!loading && activities.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-cyan-100 dark:bg-cyan-900/30 p-4">
          <Plus size={28} className="text-cyan-600 dark:text-cyan-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
          No Construction Activities Yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
          Add activities from the production-rate assembly library. Each activity includes
          pre-built line items (work elements)
        </p>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
        >
          <Plus size={16} /> Add First Activity
        </button>
        {showPicker && (
          <AssemblyPickerModal
            projectId={projectId}
            onConfirm={handleAdd}
            onCancel={() => setShowPicker(false)}
            saving={saving}
            existingActivities={activities}
            defaultLaborRate={defaultRate}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Construction Activities
          </h2>
          {activities.length > 0 && (
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
              {activities.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle size={13} /> {error}
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Refresh activities"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
          >
            <Plus size={13} /> Add Activity
          </button>
        </div>
      </div>

      {/* ── Summary bar ─────────────────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
          <SummaryChip label="Total Activities" value={`${activities.length}`} />
          <SummaryChip label="Total Man-Hours" value={`${totalMH.toFixed(1)} MH`} accent />
          <SummaryChip
            label="Total Labor Cost"
            value={`$${totalLaborCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <SummaryChip
            label="Scheduled"
            value={`${totalScheduled} / ${activities.length}`}
            icon={<CheckCircle2 size={12} className="text-blue-500" />}
          />
        </div>
      )}

      {/* ── Division groups ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <DivisionSection
            key={group.divisionCode}
            divisionCode={group.divisionCode}
            divisionName={group.divisionName}
            activities={group.items}
            lineItemsMap={lineItemsMap}
            onDelete={handleDeleteRequest}
            onEdit={(activity, lineItems) => setEditingActivity({ activity, lineItems })}
          />
        ))
      )}

      {/* ── Assembly picker modal ────────────────────────────────────────────── */}
        {showPicker && (
          <AssemblyPickerModal
            projectId={projectId}
            onConfirm={handleAdd}
            onCancel={() => setShowPicker(false)}
            saving={saving}
            existingActivities={[]}
            defaultLaborRate={defaultRate}
          />
        )}

      {/* ── Delete confirm dialog ────────────────────────────────────────────── */}
      {deleteConfirm && (
        <ConfirmDeleteDialog
          activity={activities.find((a) => a.id === deleteConfirm)}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          saving={saving}
        />
      )}

      {editingActivity && (
        <EditConstructionActivityModal
          activity={editingActivity.activity}
          lineItems={editingActivity.lineItems}
          onSave={handleEditSave}
          onCancel={() => setEditingActivity(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryChip({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}:</span>
      <span
        className={[
          'text-xs font-semibold',
          accent
            ? 'text-cyan-700 dark:text-cyan-400'
            : 'text-slate-800 dark:text-slate-100',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function DivisionSection({
  divisionCode,
  divisionName,
  activities,
  lineItemsMap,
  onDelete,
  onEdit,
}: {
  divisionCode: string;
  divisionName: string;
  activities: ProjectConstructionActivity[];
  lineItemsMap: Map<string, ProjectActivityLineItem[]>;
  onDelete: (id: string) => void;
  onEdit: (activity: ProjectConstructionActivity, lineItems: ProjectActivityLineItem[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const divMH = activities.reduce((s, a) => s + (a.calculatedManHours ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Division header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 px-4 py-3 text-left hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="rounded bg-slate-700 dark:bg-slate-500 px-1.5 py-0.5 text-[11px] font-mono text-white">
          {divisionCode}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {divisionName}
        </span>
        <span className="text-xs text-slate-400">{activities.length} activit{activities.length === 1 ? 'y' : 'ies'}</span>
        <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{divMH.toFixed(1)} MH</span>
        <span className="text-[10px] text-slate-400">{collapsed ? '▼' : '▲'}</span>
      </button>

      {/* Activity cards */}
      {!collapsed && (
        <div className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-2">
          {activities.map((activity) => (
            <ConstructionActivityCard
              key={activity.id}
              activity={activity}
              lineItems={lineItemsMap.get(activity.id) ?? []}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  activity,
  onConfirm,
  onCancel,
  saving,
}: {
  activity: ProjectConstructionActivity | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
          Remove Activity?
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          This will permanently delete{' '}
          <strong>{activity?.title ?? activity?.name ?? 'this activity'}</strong>{' '}
          and all its line items. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
