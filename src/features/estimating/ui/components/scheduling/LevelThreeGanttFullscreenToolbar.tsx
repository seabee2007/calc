import Button from '../../../../../components/ui/Button';

const FULLSCREEN_TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm hover:bg-slate-700';

interface Props {
  exportReady: boolean;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onFitWidth: () => void;
  onExitFullscreen: () => void;
}

export default function LevelThreeGanttFullscreenToolbar({
  exportReady,
  onExportPdf,
  onExportExcel,
  onFitWidth,
  onExitFullscreen,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
      <span className="text-sm font-semibold text-slate-100">Level III Gantt</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!exportReady}
          title={!exportReady ? 'Run CPM before exporting.' : undefined}
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
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
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          onClick={onExportExcel}
        >
          Export Excel
        </Button>
        <button type="button" className={FULLSCREEN_TOOLBAR_BUTTON_CLASS} onClick={onFitWidth}>
          Fit width
        </button>
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
