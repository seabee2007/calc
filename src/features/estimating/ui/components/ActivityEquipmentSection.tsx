/**
 * Collapsible section listing equipment resources attached to a construction activity.
 * Mirrors ActivityMaterialsSection — same structure, different label and resource type.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { BORDER_DEFAULT, TEXT_BODY, TEXT_MUTED, TEXT_FOREGROUND, TEXT_SUBTLE } from '../../../../theme/appTheme';
import type {
  ActivityEquipmentResource,
  ActivityResourceProvider,
} from '../../domain/constructionActivityTypes';
import type { UseActivityResourcesReturn } from '../hooks/useActivityResources';

interface Props {
  activityId: string;
  projectId: string;
  resources: ActivityEquipmentResource[];
  error: string | null;
  onAdd: () => void;
  onEdit: (resource: ActivityEquipmentResource) => void;
  onRemove: UseActivityResourcesReturn['removeEquipment'];
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function SourceChip({ provider }: { provider: ActivityResourceProvider }) {
  const config = {
    manual: { label: 'Manual', cls: 'bg-slate-700 text-slate-200' },
    arden_starter: { label: 'Starter', cls: 'bg-cyan-900/60 text-cyan-300' },
    arden_design_builder: { label: 'Design Builder', cls: 'bg-emerald-900/60 text-emerald-300' },
    company_library: { label: 'My Library', cls: 'bg-violet-900/60 text-violet-300' },
  };
  const { label, cls } = config[provider] ?? config.manual;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function ActivityEquipmentSection({ resources, error, onAdd, onEdit, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const total = resources.reduce((s, r) => s + r.totalCost, 0);

  return (
    <div className={`rounded-lg border ${BORDER_DEFAULT} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className={`text-sm font-medium ${TEXT_FOREGROUND}`}>Equipment</span>
          {resources.length > 0 && (
            <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
              {resources.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className={`text-xs font-medium ${TEXT_BODY}`}>{formatMoney(total)}</span>
          )}
          <span
            role="button"
            aria-label="Add equipment"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="rounded p-0.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-700/50">
          {error && (
            <p className="px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          {resources.length === 0 && !error ? (
            <div className="px-4 py-3 text-center">
              <p className={`text-xs ${TEXT_SUBTLE}`}>No equipment yet.</p>
              <button
                type="button"
                onClick={onAdd}
                className="mt-1 text-xs text-cyan-400 hover:underline"
              >
                Add equipment
              </button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${BORDER_DEFAULT}`}>
                  <th className={`px-3 py-1.5 text-left font-medium ${TEXT_MUTED}`}>Resource</th>
                  <th className={`px-3 py-1.5 text-right font-medium ${TEXT_MUTED}`}>Qty / Unit</th>
                  <th className={`px-3 py-1.5 text-right font-medium ${TEXT_MUTED}`}>Unit Cost</th>
                  <th className={`px-3 py-1.5 text-center font-medium ${TEXT_MUTED}`}>Source</th>
                  <th className={`px-3 py-1.5 text-right font-medium ${TEXT_MUTED}`}>Total</th>
                  <th className="w-14" />
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    onEdit={() => onEdit(r)}
                    onRemove={() => void onRemove(r.id)}
                  />
                ))}
              </tbody>
              {resources.length > 0 && (
                <tfoot>
                  <tr className={`border-t ${BORDER_DEFAULT}`}>
                    <td colSpan={4} className={`px-3 py-1.5 text-right text-xs font-medium ${TEXT_MUTED}`}>
                      Equipment total
                    </td>
                    <td className={`px-3 py-1.5 text-right text-xs font-semibold ${TEXT_FOREGROUND}`}>
                      {formatMoney(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ResourceRow({
  resource,
  onEdit,
  onRemove,
}: {
  resource: ActivityEquipmentResource;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <tr className={`border-b last:border-b-0 ${BORDER_DEFAULT} hover:bg-slate-800/20`}>
      <td className={`px-3 py-1.5 ${TEXT_BODY} max-w-[160px] truncate`} title={resource.name}>
        {resource.name}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${TEXT_BODY}`}>
        {resource.quantity} {resource.unit}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${TEXT_BODY}`}>
        {formatMoney(resource.unitCost)}
      </td>
      <td className="px-3 py-1.5 text-center">
        <SourceChip provider={resource.sourceProvider} />
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${TEXT_FOREGROUND}`}>
        {formatMoney(resource.totalCost)}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-0.5 text-slate-500 hover:text-cyan-400 transition-colors"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {confirming ? (
            <button
              type="button"
              onClick={() => { setConfirming(false); onRemove(); }}
              className="rounded px-1.5 py-0.5 text-[10px] bg-red-900/60 text-red-300 hover:bg-red-800"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded p-0.5 text-slate-500 hover:text-red-400 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
