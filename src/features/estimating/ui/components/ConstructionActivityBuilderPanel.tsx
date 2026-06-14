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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, AlertTriangle, CheckCircle2, Sparkles, ClipboardList } from 'lucide-react';
import ConstructionActivityCard from './ConstructionActivityCard';
import EditConstructionActivityModal from './EditConstructionActivityModal';
import ActivitiesReadinessSummary from './ActivitiesReadinessSummary';
import { useConstructionActivities } from '../hooks/useConstructionActivities';
import type {
  AddFromProductionRateAssemblyParams,
  AddManualActivityParams,
} from '../hooks/useConstructionActivities';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import type { UpdateProjectActivityInput } from '../../application/constructionActivityService';
import type { ImportFromScopeProjectContext } from './ImportFromScopeModal';
import type { EstimateSelectedDivision } from '../../domain/estimateTypes';

const AssemblyPickerModal = lazy(() => import('./AssemblyPickerModal'));
const ImportFromScopeModal = lazy(() => import('./ImportFromScopeModal'));

interface Props {
  projectId: string;
  estimateId?: string;
  hasEstimateTypeSelected?: boolean;
  onChooseEstimateType?: () => void;
  projectContext?: ImportFromScopeProjectContext | null;
  acceptedDivisionCodes?: readonly string[];
  selectedDivisions?: readonly EstimateSelectedDivision[];
  importCollapseDivisionCodesKey?: string | null;
  onEnsureDivisionsSelected?: (divisionCodes: string[]) => Promise<void>;
  /** Called after any add/delete so the workspace can refresh its schedule source. */
  onActivitiesChanged?: () => void;
}

export type DivisionActivityGroup = {
  divisionCode: string;
  divisionName: string;
  items: ProjectConstructionActivity[];
};

/** Merge selected division shells with activity-backed divisions for the accordion. */
export function buildDivisionActivityGroups(
  selectedDivisions: readonly EstimateSelectedDivision[],
  activities: ProjectConstructionActivity[],
): DivisionActivityGroup[] {
  const map = new Map<string, { divisionName: string; items: ProjectConstructionActivity[] }>();

  for (const division of selectedDivisions) {
    if (!map.has(division.code)) {
      map.set(division.code, { divisionName: division.name, items: [] });
    }
  }

  for (const activity of activities) {
    const code = activity.divisionCode;
    if (!map.has(code)) {
      map.set(code, { divisionName: activity.divisionName, items: [] });
    }
    const group = map.get(code)!;
    if (!group.divisionName.trim()) {
      group.divisionName = activity.divisionName;
    }
    group.items.push(activity);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([divisionCode, value]) => ({ divisionCode, ...value }));
}

export default function ConstructionActivityBuilderPanel({
  projectId,
  estimateId,
  hasEstimateTypeSelected = true,
  onChooseEstimateType,
  projectContext = null,
  acceptedDivisionCodes = [],
  selectedDivisions = [],
  importCollapseDivisionCodesKey = null,
  onEnsureDivisionsSelected,
  onActivitiesChanged,
}: Props) {
  const {
    activities,
    lineItemsMap,
    loading,
    saving,
    error,
    reload,
    projectRates,
    addFromProductionRateAssembly,
    addManualActivity,
    updateActivity,
    remove,
  } = useConstructionActivities(projectId, estimateId);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerInitialDivisionCode, setPickerInitialDivisionCode] = useState<string | undefined>();
  const [showScopeImport, setShowScopeImport] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<{
    activity: ProjectConstructionActivity;
    lineItems: ProjectActivityLineItem[];
  } | null>(null);

  const groups = useMemo(
    () => buildDivisionActivityGroups(selectedDivisions, activities),
    [activities, selectedDivisions],
  );

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

  const closePicker = useCallback(() => {
    setShowPicker(false);
    setPickerInitialDivisionCode(undefined);
  }, []);

  const openPicker = useCallback((divisionCode?: string) => {
    setPickerInitialDivisionCode(divisionCode);
    setShowPicker(true);
  }, []);

  const handleAddProductionRate = useCallback(
    async (params: AddFromProductionRateAssemblyParams) => {
      await addFromProductionRateAssembly(params);
      closePicker();
      onActivitiesChanged?.();
    },
    [addFromProductionRateAssembly, closePicker, onActivitiesChanged],
  );

  const handleAddManual = useCallback(
    async (params: AddManualActivityParams) => {
      await addManualActivity(params);
      closePicker();
      onActivitiesChanged?.();
    },
    [addManualActivity, closePicker, onActivitiesChanged],
  );

  const handleAddSelectedDivisions = useCallback(
    async (divisionCodes: string[]) => {
      if (onEnsureDivisionsSelected) {
        await onEnsureDivisionsSelected(divisionCodes);
      }
      onActivitiesChanged?.();
    },
    [onActivitiesChanged, onEnsureDivisionsSelected],
  );

  const handleScopeImportClose = useCallback(() => {
    setShowScopeImport(false);
  }, []);

  const hasSelectedDivisions = selectedDivisions.length > 0;
  const hasActivities = activities.length > 0;

  const effectiveProjectContext = useMemo(
    () =>
      projectContext ?? {
        projectId,
        projectName: 'Project',
      },
    [projectContext, projectId],
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

  const [expandedDivisionCodes, setExpandedDivisionCodes] = useState<Set<string>>(
    () => new Set(),
  );
  const consumedImportCollapseKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      importCollapseDivisionCodesKey &&
      consumedImportCollapseKeyRef.current !== importCollapseDivisionCodesKey
    ) {
      consumedImportCollapseKeyRef.current = importCollapseDivisionCodesKey;
      setExpandedDivisionCodes(new Set());
    }
  }, [importCollapseDivisionCodesKey]);

  const toggleDivisionExpanded = useCallback((divisionCode: string) => {
    setExpandedDivisionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(divisionCode)) {
        next.delete(divisionCode);
      } else {
        next.add(divisionCode);
      }
      return next;
    });
  }, []);

  const showGenericEmptyState = !loading && !hasActivities && !hasSelectedDivisions && !error;
  const showDivisionShellsOnly = !loading && !hasActivities && hasSelectedDivisions && !error;

  if (!hasEstimateTypeSelected) {
    return (
      <ChooseEstimateTypeActivitiesEmptyState onChooseEstimateType={onChooseEstimateType} />
    );
  }

  return (
    <div className="space-y-4">
      {showGenericEmptyState ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-cyan-100 dark:bg-cyan-900/30 p-4">
            <Plus size={28} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
            No Construction Activities Yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            Add activities from the production-rate assembly library. Each activity includes
            pre-built line items (work elements).
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => openPicker()}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
            >
              <Plus size={16} />
              Add First Activity
            </button>
            <button
              type="button"
              onClick={() => setShowScopeImport(true)}
              className="flex items-center gap-2 rounded-lg border border-cyan-600 px-5 py-2.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 transition-colors dark:border-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
            >
              <Sparkles size={16} /> Import from Scope
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Construction Activities
              </h2>
              {hasActivities ? (
                <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {activities.length}
                </span>
              ) : null}
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
                onClick={() => setShowScopeImport(true)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md border border-cyan-600 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-60 transition-colors dark:border-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
              >
                <Sparkles size={13} /> Import from Scope
              </button>
              <button
                type="button"
                onClick={() => openPicker()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
              >
                <Plus size={13} /> Add Activity
              </button>
            </div>
          </div>

          {showDivisionShellsOnly ? (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">
              Divisions imported from scope. Add production-rate-backed activities from the library
              to begin pricing.
            </div>
          ) : null}

          {hasActivities ? (
            <ActivitiesReadinessSummary activities={activities} lineItemsMap={lineItemsMap} />
          ) : null}

          {hasActivities ? (
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
          ) : null}

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
                isExpanded={expandedDivisionCodes.has(group.divisionCode)}
                onToggleExpanded={() => toggleDivisionExpanded(group.divisionCode)}
                onDelete={handleDeleteRequest}
                onEdit={(activity, lineItems) => setEditingActivity({ activity, lineItems })}
                onAddActivity={() => openPicker(group.divisionCode)}
              />
            ))
          )}
        </>
      )}

      {showPicker ? (
        <Suspense fallback={null}>
          <AssemblyPickerModal
            projectId={projectId}
            onConfirmProductionRate={handleAddProductionRate}
            onConfirmManual={handleAddManual}
            onCancel={closePicker}
            saving={saving}
            existingActivities={activities}
            projectLaborRates={projectRates}
            initialDivisionCode={pickerInitialDivisionCode}
          />
        </Suspense>
      ) : null}

      {showScopeImport ? (
        <Suspense fallback={null}>
          <ImportFromScopeModal
            isOpen={showScopeImport}
            projectContext={effectiveProjectContext}
            existingDivisionCodes={acceptedDivisionCodes}
            onClose={handleScopeImportClose}
            onDivisionsAdded={onActivitiesChanged}
            onAddSelectedDivisions={handleAddSelectedDivisions}
            saving={saving}
          />
        </Suspense>
      ) : null}

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

function ChooseEstimateTypeActivitiesEmptyState({
  onChooseEstimateType,
}: {
  onChooseEstimateType?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="activities-choose-estimate-type-empty-state"
    >
      <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
        <ClipboardList size={28} className="text-slate-600 dark:text-slate-300" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        Choose an estimate type
      </h3>
      <p className="mb-6 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Select an estimate type before adding activities or importing scope. This sets the estimating
        workflow, pricing detail, and scheduling behavior for the project.
      </p>
      <button
        type="button"
        onClick={onChooseEstimateType}
        className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
      >
        Choose Estimate Type
      </button>
    </div>
  );
}

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
  isExpanded,
  onToggleExpanded,
  onDelete,
  onEdit,
  onAddActivity,
}: {
  divisionCode: string;
  divisionName: string;
  activities: ProjectConstructionActivity[];
  lineItemsMap: Map<string, ProjectActivityLineItem[]>;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDelete: (id: string) => void;
  onEdit: (activity: ProjectConstructionActivity, lineItems: ProjectActivityLineItem[]) => void;
  onAddActivity: () => void;
}) {
  const divMH = activities.reduce((s, a) => s + (a.calculatedManHours ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Division header */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 px-4 py-3 text-left hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="rounded bg-slate-700 dark:bg-slate-500 px-1.5 py-0.5 text-[11px] font-mono text-white">
          {divisionCode}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {divisionName}
        </span>
        <span className="text-xs text-slate-400">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
          {divMH.toFixed(1)} MH
        </span>
        <span className="text-[10px] text-slate-400">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Activity cards or empty division shell */}
      {isExpanded && (
        <div className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-2">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No activities added yet.</p>
              <button
                type="button"
                onClick={onAddActivity}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
              >
                <Plus size={14} />
                Add Activity from Production Rate Library
              </button>
            </div>
          ) : (
            activities.map((activity) => (
              <ConstructionActivityCard
                key={activity.id}
                activity={activity}
                lineItems={lineItemsMap.get(activity.id) ?? []}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))
          )}
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
