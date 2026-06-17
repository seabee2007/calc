import { useCallback, useMemo } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './dashboardGrid.css';
import {
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  type DashboardCardId,
  type DashboardLayoutItem,
  type DashboardLayoutItemConfig,
} from '../../../lib/dashboardLayout';
import { buildVisibleDashboardRenderLayout } from '../../../lib/dashboardGridRepair';
import { DASHBOARD_CARD_REGISTRY } from './dashboardCardRegistry';
import type { DashboardCardContext } from './dashboardData';
import type { DashboardItemPosition } from './useDashboardLayout';
import DashboardGridItem from './DashboardGridItem';
import { useIsNarrowViewport } from './useIsNarrowViewport';

const GridWithWidth = WidthProvider(GridLayout);

/** Row height in px — must be large enough that default h values fit real card content. */
const ROW_HEIGHT = 28;
const MARGIN: [number, number] = [20, 20];

function pxToRows(px: number): number {
  return Math.max(1, Math.ceil((px + MARGIN[1]) / (ROW_HEIGHT + MARGIN[1])));
}

interface DashboardGridProps {
  ctx: DashboardCardContext;
  /** Saved layout items (includes hidden/gated widgets). */
  items: DashboardLayoutItem[];
  customizing: boolean;
  onApplyPositions: (positions: DashboardItemPosition[]) => void;
  onWidthChange: (id: DashboardCardId, w: number) => void;
  onMeasureHeight: (id: DashboardCardId, rows: number) => void;
  /** Removes an optional widget from the dashboard (customize mode only). */
  onRemoveWidget: (id: DashboardCardId) => void;
  /** Persist per-widget config (e.g. weather location source). */
  onWidgetConfigChange?: (id: DashboardCardId, config: DashboardLayoutItemConfig) => void;
  /**
   * Bumped after layout hydration or explicit reset so RGL discards stale
   * internal position cache on route remount.
   */
  gridKey?: number;
}

export default function DashboardGrid({
  ctx,
  items,
  customizing,
  onApplyPositions,
  onWidthChange,
  onMeasureHeight,
  onRemoveWidget,
  onWidgetConfigChange,
  gridKey = 0,
}: DashboardGridProps) {
  const isNarrow = useIsNarrowViewport();

  const visibleIds = useMemo(() => {
    const ids = new Set<DashboardCardId>();
    for (const item of items) {
      if (DASHBOARD_CARD_REGISTRY[item.id].isVisible(ctx)) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [ctx, items]);

  /** Collision-free slice for render — saved layout is not mutated here. */
  const renderItems = useMemo(
    () => buildVisibleDashboardRenderLayout(items, visibleIds),
    [items, visibleIds],
  );

  const visibleIdsKey = useMemo(
    () => [...visibleIds].sort().join(','),
    [visibleIds],
  );

  const handleMeasure = useCallback(
    (id: DashboardCardId, pxHeight: number) => {
      onMeasureHeight(id, pxToRows(pxHeight));
    },
    [onMeasureHeight],
  );

  const handleStop = useCallback(
    (layout: Layout[]) => {
      onApplyPositions(
        layout.map((l) => ({
          id: l.i as DashboardCardId,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
        })),
      );
    },
    [onApplyPositions],
  );

  // Mobile: a clean single-column stack. No drag/resize, no horizontal overflow.
  if (isNarrow) {
    return (
      <div className="space-y-4" data-testid="dashboard-grid-mobile">
        {renderItems.map((item) => (
          <div key={item.id} data-testid={`dashboard-card-${item.id}`}>
            {DASHBOARD_CARD_REGISTRY[item.id].render(ctx, {
              isMobile: true,
              cardWidth: item.w,
              widgetConfig: item.config,
              onWidgetConfigChange: onWidgetConfigChange
                ? (config) => onWidgetConfigChange(item.id, config)
                : undefined,
            })}
          </div>
        ))}
      </div>
    );
  }

  const rglLayout: Layout[] = renderItems.map((item) => {
    const meta = DASHBOARD_CARD_META[item.id];
    const fixedWidth = meta.allowedWidths.length === 1;
    return {
      i: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: meta.minW,
      minH: meta.minH,
      maxW: DASHBOARD_GRID_COLS,
      isResizable: customizing && !fixedWidth,
    };
  });

  return (
    <GridWithWidth
      key={`dashboard-grid-${gridKey}-${visibleIdsKey}`}
      className={`dashboard-grid${customizing ? ' dashboard-grid--customizing' : ''}`}
      layout={rglLayout}
      cols={DASHBOARD_GRID_COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      isDraggable={customizing}
      isResizable={customizing}
      draggableCancel=".dashboard-no-drag"
      resizeHandles={['e']}
      compactType="vertical"
      preventCollision={false}
      onDragStop={handleStop}
      onResizeStop={handleStop}
      useCSSTransforms
    >
      {renderItems.map((item) => (
        <div key={item.id} data-testid={`dashboard-card-${item.id}`} className="dashboard-grid-cell">
          <DashboardGridItem
            id={item.id}
            width={item.w}
            ctx={ctx}
            customizing={customizing}
            widgetConfig={item.config}
            onWidgetConfigChange={
              onWidgetConfigChange
                ? (config) => onWidgetConfigChange(item.id, config)
                : undefined
            }
            onWidthChange={onWidthChange}
            onMeasure={handleMeasure}
            onRemove={DASHBOARD_CARD_META[item.id].defaultVisible ? undefined : onRemoveWidget}
          />
        </div>
      ))}
    </GridWithWidth>
  );
}
