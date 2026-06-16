import { useCallback } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './dashboardGrid.css';
import {
  DASHBOARD_CARD_META,
  DASHBOARD_GRID_COLS,
  type DashboardCardId,
  type DashboardLayoutItem,
} from '../../../lib/dashboardLayout';
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
  /** Items in reading order; hidden/gated cards are filtered here at render. */
  items: DashboardLayoutItem[];
  customizing: boolean;
  onApplyPositions: (positions: DashboardItemPosition[]) => void;
  onWidthChange: (id: DashboardCardId, w: number) => void;
  onMeasureHeight: (id: DashboardCardId, rows: number) => void;
}

export default function DashboardGrid({
  ctx,
  items,
  customizing,
  onApplyPositions,
  onWidthChange,
  onMeasureHeight,
}: DashboardGridProps) {
  const isNarrow = useIsNarrowViewport();

  // Hidden/gated cards are filtered at render only; they remain in the layout.
  const visibleItems = items.filter((item) => DASHBOARD_CARD_REGISTRY[item.id].isVisible(ctx));

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
        {visibleItems.map((item) => (
          <div key={item.id} data-testid={`dashboard-card-${item.id}`}>
            {DASHBOARD_CARD_REGISTRY[item.id].render(ctx, { isMobile: true, cardWidth: item.w })}
          </div>
        ))}
      </div>
    );
  }

  const layout: Layout[] = visibleItems.map((item) => {
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
      className="dashboard-grid"
      layout={layout}
      cols={DASHBOARD_GRID_COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      isDraggable={customizing}
      isResizable={customizing}
      draggableCancel=".dashboard-no-drag"
      resizeHandles={['e']}
      compactType="vertical"
      onDragStop={handleStop}
      onResizeStop={handleStop}
      useCSSTransforms
    >
      {visibleItems.map((item) => (
          <div key={item.id} data-testid={`dashboard-card-${item.id}`} className="dashboard-grid-cell">
            <DashboardGridItem
              id={item.id}
              width={item.w}
              ctx={ctx}
              customizing={customizing}
              onWidthChange={onWidthChange}
              onMeasure={handleMeasure}
            />
          </div>
      ))}
    </GridWithWidth>
  );
}
