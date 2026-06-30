/**
 * Construction Activity Card — one expandable card per ProjectConstructionActivity.
 *
 * Header: activity code + title + rollup stats + schedule toggle + delete button.
 * Body (expanded): column header row + ActivityLineItemRow per child line item.
 *
 * Line items are NEVER schedule activities — only the parent card has a schedule toggle.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Calendar, Trash2, AlertTriangle, ClipboardList, Pencil, Check, Circle } from 'lucide-react';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../../domain/constructionActivityTypes';
import { getConstructionActivityWarnings, hasConstructionActivityEstimateWarnings } from '../../domain/constructionActivityCalculations';
import { computeActivityReadiness } from '../../application/estimateActivityReadiness';
import ActivityLineItemRow from './ActivityLineItemRow';
import ActivityProgressSummary from './ActivityProgressSummary';
import ActivityProgressForm from './ActivityProgressForm';
import { useActivityProgress } from '../hooks/useActivityProgress';
import { useActivityResources } from '../hooks/useActivityResources';
import { ActivityMaterialsSection } from './ActivityMaterialsSection';
import { ActivityEquipmentSection } from './ActivityEquipmentSection';
import { ActivityResourcePickerModal } from './ActivityResourcePickerModal';

interface Props {
  activity: ProjectConstructionActivity;
  lineItems: ProjectActivityLineItem[];
  onDelete?: (id: string) => void;
  onEdit?: (activity: ProjectConstructionActivity, lineItems: ProjectActivityLineItem[]) => void;
  defaultExpanded?: boolean;
  currentProjectDay?: number;
}

function ReadinessChip({ score }: { score: number }) {
  const colorClass =
    score >= 80
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : score >= 50
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200';

  return (
    <div className={`flex flex-col items-center rounded px-2 py-1 min-w-[56px] ${colorClass}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide leading-none mb-0.5 opacity-80">
        Ready
      </span>
      <span className="tabular-nums text-sm font-bold leading-none">{score}%</span>
    </div>
  );
}

function ReadinessChecklist({
  readiness,
}: {
  readiness: ReturnType<typeof computeActivityReadiness>;
}) {
  const items = [
    { label: 'Confirmed in estimate', done: readiness.isConfirmed },
    { label: 'Quantity entered', done: readiness.hasQuantity },
    { label: 'Labor priced', done: readiness.hasLaborPriced },
    { label: 'Material or equipment', done: readiness.hasMaterialOrEquipment },
    { label: 'No open flags', done: readiness.hasNoWarnings },
  ];

  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          {item.done ? (
            <Check size={12} className="shrink-0 text-emerald-600" />
          ) : (
            <Circle size={12} className="shrink-0 text-slate-400" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
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

  // Resource sections — loaded for readiness chip and expanded estimate tab
  const resources = useActivityResources(activity.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'material' | 'equipment'>('material');
  const [editingMaterial, setEditingMaterial] = useState<ActivityMaterialResource | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<ActivityEquipmentResource | null>(null);

  const mh = activity.calculatedManHours ?? 0;
  const dur = activity.effectiveDurationDays ?? activity.calculatedDurationDays ?? 0;
  const hasOverride = activity.durationDaysOverride != null;
  const hasWarnings = hasConstructionActivityEstimateWarnings(activity, lineItems);
  const warningMessages = getConstructionActivityWarnings(activity, lineItems);

  const totalCost = activity.totalCost ?? 0;

  const readiness = useMemo(
    () =>
      computeActivityReadiness(
        activity,
        lineItems,
        resources.materials,
        resources.equipment,
      ),
    [activity, lineItems, resources.equipment, resources.materials],
  );

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
            <StatChip
              label="Labor"
              value={`$${(activity.totalLaborCost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
          )}
          {(activity.totalMaterialCost ?? 0) > 0 && (
            <StatChip
              label="Mat."
              value={`$${(activity.totalMaterialCost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
          )}
          {(activity.totalEquipmentCost ?? 0) > 0 && (
            <StatChip
              label="Equip."
              value={`$${(activity.totalEquipmentCost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
          )}
          <ReadinessChip score={readiness.score} />
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
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Estimate readiness — {readiness.score}%
                </p>
                <ReadinessChecklist readiness={readiness} />
              </div>

              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Work Element
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Qty / Unit
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  MH / Unit
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Man-Hours
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Labor Role
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Labor
                </span>
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Total
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

              {/* Materials & Equipment sections */}
              <div className="space-y-2 px-3 pb-3 pt-2">
                <ActivityMaterialsSection
                  activityId={activity.id}
                  projectId={activity.projectId}
                  resources={resources.materials}
                  error={resources.error}
                  onAdd={() => { setPickerType('material'); setPickerOpen(true); }}
                  onEdit={(r) => { setEditingMaterial(r); setPickerType('material'); setPickerOpen(true); }}
                  onRemove={resources.removeMaterial}
                />
                <ActivityEquipmentSection
                  activityId={activity.id}
                  projectId={activity.projectId}
                  resources={resources.equipment}
                  error={resources.error}
                  onAdd={() => { setPickerType('equipment'); setPickerOpen(true); }}
                  onEdit={(r) => { setEditingEquipment(r); setPickerType('equipment'); setPickerOpen(true); }}
                  onRemove={resources.removeEquipment}
                />
                {/* Cost breakdown footer when resources exist */}
                {(resources.totalMaterialCost > 0 || resources.totalEquipmentCost > 0) && (
                  <div className="flex flex-wrap gap-3 rounded-lg bg-slate-800/30 px-3 py-2 text-xs">
                    <span className="text-slate-400">
                      Labor: <strong className="text-slate-200">${(activity.totalLaborCost ?? 0).toLocaleString()}</strong>
                    </span>
                    {resources.totalMaterialCost > 0 && (
                      <span className="text-slate-400">
                        Materials: <strong className="text-slate-200">${resources.totalMaterialCost.toLocaleString()}</strong>
                      </span>
                    )}
                    {resources.totalEquipmentCost > 0 && (
                      <span className="text-slate-400">
                        Equipment: <strong className="text-slate-200">${resources.totalEquipmentCost.toLocaleString()}</strong>
                      </span>
                    )}
                    <span className="ml-auto font-semibold text-cyan-300">
                      Total: ${((activity.totalLaborCost ?? 0) + resources.totalMaterialCost + resources.totalEquipmentCost).toLocaleString()}
                    </span>
                  </div>
                )}
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

      {/* Resource picker modal */}
      <ActivityResourcePickerModal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setEditingMaterial(null);
          setEditingEquipment(null);
        }}
        resourceType={pickerType}
        activityId={activity.id}
        projectId={activity.projectId}
        existingResources={pickerType === 'material' ? resources.materials : resources.equipment}
        onSave={
          pickerType === 'material'
            ? editingMaterial
              ? (input) => resources.updateMaterial(editingMaterial.id, {
                  name: input.name,
                  description: input.description,
                  category: input.category,
                  subcategory: input.subcategory,
                  quantity: input.quantity,
                  unit: input.unit,
                  unitCost: input.unitCost,
                }, editingMaterial)
              : resources.addMaterial
            : editingEquipment
              ? (input) => resources.updateEquipment(editingEquipment.id, {
                  name: input.name,
                  description: input.description,
                  category: input.category,
                  subcategory: input.subcategory,
                  quantity: input.quantity,
                  unit: input.unit,
                  unitCost: input.unitCost,
                }, editingEquipment)
              : resources.addEquipment
        }
      />
    </div>
  );
}
