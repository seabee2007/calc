import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { BimModelObject, BimSelectedObjectSnapshot } from '../../types';

interface ObjectTreeItem {
  externalObjectId: string;
  name: string | null;
  objectType: string | null;
  material: string | null;
  takeoffStatus?: BimModelObject['takeoffStatus'];
}

interface Props {
  objects: readonly BimModelObject[];
  parsedObjects: readonly BimSelectedObjectSnapshot[];
  selectedExternalId: string | null;
  hiddenExternalIds: ReadonlySet<string>;
  onSelect: (externalObjectId: string) => void;
  onToggleVisibility: (externalObjectId: string) => void;
}

function displayObjectName(item: ObjectTreeItem): string {
  if (item.name?.trim()) {
    const type = item.objectType ? ` · ${item.objectType}` : '';
    return `${item.name}${type}`;
  }
  return item.objectType ? `Unnamed mesh · ${item.objectType}` : 'Unnamed mesh';
}

function normalizeObjects(
  objects: readonly BimModelObject[],
  parsedObjects: readonly BimSelectedObjectSnapshot[],
): ObjectTreeItem[] {
  const persistedByExternalId = new Map(objects.map((object) => [object.externalObjectId, object]));

  if (parsedObjects.length > 0) {
    return parsedObjects.map((object) => {
      const persisted = persistedByExternalId.get(object.externalObjectId);
      return {
        externalObjectId: object.externalObjectId,
        name: object.name,
        objectType: object.objectType,
        material: object.material,
        takeoffStatus: persisted?.takeoffStatus,
      };
    });
  }

  return objects.map((object) => ({
    externalObjectId: object.externalObjectId,
    name: object.name,
    objectType: object.objectType,
    material: object.material,
    takeoffStatus: object.takeoffStatus,
  }));
}

export default function BimObjectTreePanel({
  objects,
  parsedObjects,
  selectedExternalId,
  hiddenExternalIds,
  onSelect,
  onToggleVisibility,
}: Props) {
  const items = normalizeObjects(objects, parsedObjects);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70" data-testid="bim-object-tree">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Model object tree</p>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
          {items.length} objects
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-500">Load a model to inspect selectable objects.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-auto pr-1">
          {items.map((item) => {
            const selected = item.externalObjectId === selectedExternalId;
            const hidden = hiddenExternalIds.has(item.externalObjectId);
            const added = item.takeoffStatus === 'mapped';

            return (
              <li key={item.externalObjectId}>
                <div
                  className={`flex items-start gap-2 rounded-lg border px-2 py-2 text-xs ${
                    selected
                      ? 'border-cyan-300 bg-cyan-50 text-slate-950 dark:border-cyan-400/50 dark:bg-cyan-500/10 dark:text-cyan-50'
                      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-slate-500 transition hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-200"
                    onClick={() => onToggleVisibility(item.externalObjectId)}
                    aria-label={hidden ? 'Show object' : 'Hide object'}
                  >
                    {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(item.externalObjectId)}
                  >
                    <span className="block truncate font-medium">{displayObjectName(item)}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-500">
                      {item.material ? `Material: ${item.material}` : 'Material not provided'}
                    </span>
                  </button>
                  {added ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Added
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { displayObjectName, normalizeObjects };
