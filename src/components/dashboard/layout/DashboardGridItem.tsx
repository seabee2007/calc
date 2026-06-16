import { useEffect, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import { widthLabel, type DashboardCardId } from '../../../lib/dashboardLayout';
import { DASHBOARD_CARD_REGISTRY } from './dashboardCardRegistry';
import type { DashboardCardContext } from './dashboardData';

interface SizeControlsProps {
  width: number;
  allowed: number[];
  onChange: (w: number) => void;
}

function SizeControls({ width, allowed, onChange }: SizeControlsProps) {
  if (allowed.length <= 1) return null;
  return (
    <div
      className="dashboard-no-drag flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/70"
      role="group"
      aria-label="Card width"
    >
      {allowed.map((w) => {
        const active = w === width;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(w)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
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
  );
}

interface DashboardGridItemProps {
  id: DashboardCardId;
  title: string;
  width: number;
  allowedWidths: number[];
  ctx: DashboardCardContext;
  customizing: boolean;
  onWidthChange: (id: DashboardCardId, w: number) => void;
  /** Reports the card's natural pixel height so the grid can size its row span. */
  onMeasure: (id: DashboardCardId, pxHeight: number) => void;
}

export default function DashboardGridItem({
  id,
  title,
  width,
  allowedWidths,
  ctx,
  customizing,
  onWidthChange,
  onMeasure,
}: DashboardGridItemProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const report = () => onMeasure(id, el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onMeasure]);

  return (
    <div
      ref={rootRef}
      className={
        customizing
          ? 'dashboard-grid-item-root cursor-grab select-none active:cursor-grabbing'
          : 'dashboard-grid-item-root'
      }
    >
      {customizing ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            aria-label="Move dashboard card"
            role="button"
            className="dashboard-drag-handle inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
            <span className="max-w-[10rem] truncate">{title}</span>
          </span>
          <SizeControls
            width={width}
            allowed={allowedWidths}
            onChange={(w) => onWidthChange(id, w)}
          />
        </div>
      ) : null}
      <div className={customizing ? 'pointer-events-none select-none' : undefined}>
        {DASHBOARD_CARD_REGISTRY[id].render(ctx)}
      </div>
    </div>
  );
}
