import { useEffect, useRef } from 'react';
import { DASHBOARD_CARD_META, type DashboardCardId, type DashboardLayoutItemConfig } from '../../../lib/dashboardLayout';
import { DASHBOARD_CARD_REGISTRY } from './dashboardCardRegistry';
import type { DashboardCardContext } from './dashboardData';
import DashboardCustomizeToolbar from './DashboardCustomizeToolbar';

interface DashboardGridItemProps {
  id: DashboardCardId;
  width: number;
  ctx: DashboardCardContext;
  customizing: boolean;
  widgetConfig?: DashboardLayoutItemConfig;
  onWidgetConfigChange?: (config: DashboardLayoutItemConfig) => void;
  onWidthChange: (id: DashboardCardId, w: number) => void;
  onMeasure: (id: DashboardCardId, pxHeight: number) => void;
  /** Removes this widget; only passed for optional (non-default) widgets. */
  onRemove?: (id: DashboardCardId) => void;
}

export default function DashboardGridItem({
  id,
  width,
  ctx,
  customizing,
  widgetConfig,
  onWidgetConfigChange,
  onWidthChange,
  onMeasure,
  onRemove,
}: DashboardGridItemProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = DASHBOARD_CARD_META[id];

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // scrollHeight reflects full content even when RGL assigns a shorter grid row.
    const report = () => onMeasure(id, el.scrollHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onMeasure, customizing, width]);

  return (
    <div
      ref={rootRef}
      className={`dashboard-grid-item-root relative ${customizing ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {customizing ? (
        <DashboardCustomizeToolbar
          width={width}
          allowedWidths={meta.allowedWidths}
          onWidthChange={(w) => onWidthChange(id, w)}
          onRemove={onRemove ? () => onRemove(id) : undefined}
        />
      ) : null}
      <div className={customizing ? 'pointer-events-none select-none' : undefined}>
        {DASHBOARD_CARD_REGISTRY[id].render(ctx, {
          cardWidth: width,
          widgetConfig,
          onWidgetConfigChange,
        })}
      </div>
    </div>
  );
}
