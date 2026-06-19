import type { BimModelUnit, BimSelectedObjectSnapshot } from '../../types';
import { getSuggestedTakeoffQuantity } from './BimTakeoffMappingPanel';

interface Props {
  selected: BimSelectedObjectSnapshot | null;
  modelUnit: BimModelUnit;
  isHidden?: boolean;
}

export default function BimObjectPropertiesPanel({ selected, modelUnit, isHidden = false }: Props) {
  if (!selected) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
        Select a model object to create a takeoff item.
      </div>
    );
  }

  const metrics = selected.geometryMetrics;
  const count = getSuggestedTakeoffQuantity(selected, 'count', modelUnit);
  const area = getSuggestedTakeoffQuantity(selected, 'area', modelUnit);
  const volume = getSuggestedTakeoffQuantity(selected, 'volume', modelUnit);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70" data-testid="bim-object-properties">
      <div>
        <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">Selected object</p>
        <div className="flex items-center gap-2">
          <p className="text-base font-medium text-slate-950 dark:text-white">{selected.name || 'Unnamed object'}</p>
          {isHidden ? (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Hidden
            </span>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Type</dt>
          <dd>{selected.objectType || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Category</dt>
          <dd>{selected.category || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Material</dt>
          <dd>{selected.material || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Level</dt>
          <dd>{selected.level || '—'}</dd>
        </div>
      </dl>
      {(metrics.width || metrics.approximateVolume) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          <p className="mb-2 font-medium text-slate-900 dark:text-slate-200">Approx. bounding box</p>
          <p>
            {metrics.width ?? '—'} × {metrics.height ?? '—'} × {metrics.depth ?? '—'} model units
          </p>
          <div className="mt-3 space-y-1 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900/70">
            <p>Count suggestion: {count.quantity} {count.unit}</p>
            {area.quantity > 0 ? <p>Area suggestion: {area.quantity} {area.unit}</p> : null}
            {volume.quantity > 0 ? (
              <p>Volume suggestion: {volume.quantity} {volume.unit}</p>
            ) : (
              <p className="text-amber-700 dark:text-amber-300">Volume unavailable for this object.</p>
            )}
          </div>
          <p className="mt-2 font-medium text-amber-800 dark:text-amber-300/90">
            Model scale not confirmed. Verify quantities before bidding.
          </p>
        </div>
      )}
    </div>
  );
}
