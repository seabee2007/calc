import Button from '../../../../../components/ui/Button';

const FULLSCREEN_TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

interface Props {
  exportReady: boolean;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onFitWidth: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onScrollToToday: () => void;
  isAtMinZoom: boolean;
  isAtMaxZoom: boolean;
  onExitFullscreen: () => void;
}

export default function LevelThreeGanttFullscreenToolbar({
  exportReady,
  onExportPdf,
  onExportExcel,
  onFitWidth,
  onZoomIn,
  onZoomOut,
  onScrollToToday,
  isAtMinZoom,
  isAtMaxZoom,
  onExitFullscreen,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-4 py-3 dark:border-slate-800">
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Level III Gantt</span>
      <div className="flex flex-wrap items-center gap-2">
        {/* Zoom controls */}
        <button
          type="button"
          className={FULLSCREEN_TOOLBAR_BUTTON_CLASS}
          onClick={onZoomOut}
          disabled={isAtMinZoom}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className={FULLSCREEN_TOOLBAR_BUTTON_CLASS}
          onClick={onZoomIn}
          disabled={isAtMaxZoom}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={FULLSCREEN_TOOLBAR_BUTTON_CLASS}
          onClick={onFitWidth}
          title="Fit full project duration into view"
        >
          Fit width
        </button>
        <button
          type="button"
          className={FULLSCREEN_TOOLBAR_BUTTON_CLASS}
          onClick={onScrollToToday}
          title="Scroll to today"
        >
          Today
        </button>

        <span className="w-px self-stretch bg-slate-300 dark:bg-slate-700" aria-hidden />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!exportReady}
          title={!exportReady ? 'Run CPM before exporting.' : undefined}
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={onExportPdf}
        >
          Export PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!exportReady}
          title={!exportReady ? 'Run CPM before exporting.' : undefined}
          className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={onExportExcel}
        >
          Export Excel
        </Button>
        <button
          type="button"
          className={FULLSCREEN_TOOLBAR_BUTTON_CLASS}
          onClick={onExitFullscreen}
        >
          Exit full screen
        </button>
      </div>
    </div>
  );
}
