import type {
  DesignObjectType,
  DesignWallSegment,
  WallOpeningParameters,
} from '../types';
import type { ObjectTreeExpansionState } from '../state/designBuilderStore';
import { OBJECT_TREE_GROUPS } from './DesignBuilderPageMappings';
import { Panel } from './DesignBuilderPageShell';

type DesignBuilderObjectTreePanelProps = {
  objectTreeExpanded: ObjectTreeExpansionState;
  modelLoaded: boolean;
  wallSegments: DesignWallSegment[];
  openings: WallOpeningParameters[];
  selectedObjectType: DesignObjectType | null;
  selectedOpeningId: string | null;
  selectedSegmentId: string | null;
  onToggleGroup: (groupId: string) => void;
  onSelectObjectType: (objectType: DesignObjectType) => void;
  onSelectSegment: (segmentId: string) => void;
  onSelectOpening: (openingId: string, objectType: 'door_opening' | 'window_opening') => void;
};

export function DesignBuilderObjectTreePanel({
  objectTreeExpanded,
  modelLoaded,
  wallSegments,
  openings,
  selectedObjectType,
  selectedOpeningId,
  selectedSegmentId,
  onToggleGroup,
  onSelectObjectType,
  onSelectSegment,
  onSelectOpening,
}: DesignBuilderObjectTreePanelProps) {
  return (
    <Panel title="Object Tree">
      {OBJECT_TREE_GROUPS.map((group) => {
        const expanded = objectTreeExpanded[group.id as keyof ObjectTreeExpansionState] ?? false;
        return (
          <div key={group.id} className="mb-2">
            <button
              type="button"
              onClick={() => onToggleGroup(group.id)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <span>{group.label}</span>
              <span>{expanded ? '-' : '+'}</span>
            </button>
            {expanded ? (
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectObjectType(item.objectType)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedObjectType === item.objectType && !selectedOpeningId
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {modelLoaded && wallSegments.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Wall segments</div>
          {wallSegments.map((segment, index) => (
            <button
              key={segment.id}
              type="button"
              onClick={() => onSelectSegment(segment.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedSegmentId === segment.id
                  ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              Segment {index + 1}
            </button>
          ))}
        </div>
      ) : null}
      {modelLoaded && openings.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Placed openings
          </div>
          {openings.map((opening) => (
            <button
              key={opening.id}
              type="button"
              onClick={() => onSelectOpening(opening.id, opening.type === 'door' ? 'door_opening' : 'window_opening')}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedOpeningId === opening.id
                  ? 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-medium capitalize">
                {opening.type}
                {opening.wallSegmentId ? ` - segment` : opening.wallFace ? ` - ${opening.wallFace}` : ''}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Offset {(opening.positionAlongSegment ?? opening.offsetMeters ?? 0).toFixed(2)}m
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
