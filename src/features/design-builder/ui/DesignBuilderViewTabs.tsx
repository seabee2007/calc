import type {
  Design2DViewType,
  DesignBuilderViewMode,
} from '../types';

const VIEW_MODE_OPTIONS: Array<[DesignBuilderViewMode, string]> = [
  ['2d', '2D'],
  ['3d', '3D'],
];

const TWO_D_VIEW_OPTIONS: Array<[Design2DViewType, string]> = [
  ['foundation-plan', 'Foundation'],
  ['roof-plan', 'Roof'],
  ['electrical-plan', 'Electrical'],
  ['plumbing-plan', 'Plumbing'],
  ['elevation-view', 'Elevation'],
];

export function DesignBuilderViewModeTabs({
  viewMode,
  onViewModeChange,
}: {
  viewMode: DesignBuilderViewMode;
  onViewModeChange: (mode: DesignBuilderViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Switch Design Builder view"
      className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
    >
      {VIEW_MODE_OPTIONS.map(([mode, label], index) => (
        <button
          key={mode}
          type="button"
          aria-label={`Switch to ${label} view`}
          aria-pressed={viewMode === mode}
          onClick={() => onViewModeChange(mode)}
          className={`${index === 0 ? '' : 'border-l border-slate-200 dark:border-slate-700'} px-3 text-xs font-semibold transition ${
            viewMode === mode
              ? 'bg-cyan-600 text-white'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DesignBuilder2DViewTabs({
  active2DView,
  onActive2DViewChange,
}: {
  active2DView: Design2DViewType;
  onActive2DViewChange: (view: Design2DViewType) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Switch 2D drawing view"
      className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
    >
      {TWO_D_VIEW_OPTIONS.map(([drawingView, label], index) => (
        <button
          key={drawingView}
          type="button"
          aria-label={`Switch to ${label} drawing`}
          aria-pressed={active2DView === drawingView}
          onClick={() => onActive2DViewChange(drawingView)}
          className={`${index === 0 ? '' : 'border-l border-slate-200 dark:border-slate-700'} px-3 text-xs font-semibold transition ${
            active2DView === drawingView
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
