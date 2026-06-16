import { GripVertical, Trash2 } from 'lucide-react';
import { widthLabel } from '../../../lib/dashboardLayout';

interface DashboardCustomizeToolbarProps {
  width: number;
  allowedWidths: number[];
  onWidthChange: (w: number) => void;
  /** When provided, shows a remove control (optional/non-default widgets only). */
  onRemove?: () => void;
}

/** Slim customize-only toolbar — sits inside the card top edge, not a card wrapper. */
export default function DashboardCustomizeToolbar({
  width,
  allowedWidths,
  onWidthChange,
  onRemove,
}: DashboardCustomizeToolbarProps) {
  return (
    <div
      className="dashboard-no-drag absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95"
      role="toolbar"
      aria-label="Customize card"
    >
      <button
        type="button"
        aria-label="Move dashboard card"
        className="dashboard-drag-handle inline-flex touch-none rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:cursor-grabbing dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      {allowedWidths.length > 1 ? (
        <div
          className="flex items-center gap-0.5 rounded-md border border-slate-200/80 bg-white/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/70"
          role="group"
          aria-label="Card width"
        >
          {allowedWidths.map((w) => {
            const active = w === width;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                onClick={() => onWidthChange(w)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {widthLabel(w)}
              </button>
            );
          })}
        </div>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove widget"
          onClick={onRemove}
          className="inline-flex rounded-md p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
