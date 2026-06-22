export const DEBUG_OVERLAY_LAYOUT_VERSION = 2;
export const DEBUG_OVERLAY_INSET = 12;
export const DEBUG_OVERLAY_GAP = 8;
export const DEBUG_OVERLAY_STORAGE_PREFIX = `design-builder-debug-overlay:v${DEBUG_OVERLAY_LAYOUT_VERSION}:`;

export type DebugOverlayColumn = 'right-stack' | 'left-top-stack' | 'left-bottom' | 'bottom-center';

export type DebugOverlaySlotConfig = {
  column: DebugOverlayColumn;
  stackOrder: number;
};

/** Default panel arrangement around the 3D viewer (see debug overlay screenshot). */
export const DEBUG_OVERLAY_SLOT_BY_ID: Record<string, DebugOverlaySlotConfig> = {
  'roof-reference-perimeters': { column: 'right-stack', stackOrder: 0 },
  'truss-inspector': { column: 'right-stack', stackOrder: 1 },
  'roof-framing-guides': { column: 'right-stack', stackOrder: 2 },
  'gable-end-overhang': { column: 'right-stack', stackOrder: 3 },
  'design-persistence': { column: 'left-top-stack', stackOrder: 0 },
  'material-diagnostics': { column: 'left-top-stack', stackOrder: 1 },
  'texture-projection': { column: 'left-top-stack', stackOrder: 2 },
  'mortar-joints': { column: 'left-top-stack', stackOrder: 3 },
  'gable-rake-geometry': { column: 'left-bottom', stackOrder: 0 },
  'geometry-revision': { column: 'bottom-center', stackOrder: 0 },
};

export type DebugOverlayPosition = { left: number; top: number };

export type DebugOverlayMeasure = {
  id: string;
  width: number;
  height: number;
};

export function computeDebugOverlayLayout(params: {
  panels: readonly DebugOverlayMeasure[];
  containerWidth: number;
  containerHeight: number;
}): Record<string, DebugOverlayPosition> {
  const { panels, containerWidth, containerHeight } = params;
  const positions: Record<string, DebugOverlayPosition> = {};
  if (containerWidth <= 0 || containerHeight <= 0 || panels.length === 0) {
    return positions;
  }

  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const panelsInColumn = (column: DebugOverlayColumn) =>
    panels
      .filter((panel) => DEBUG_OVERLAY_SLOT_BY_ID[panel.id]?.column === column)
      .sort(
        (left, right) =>
          (DEBUG_OVERLAY_SLOT_BY_ID[left.id]?.stackOrder ?? 0) -
          (DEBUG_OVERLAY_SLOT_BY_ID[right.id]?.stackOrder ?? 0),
      );

  const geometryPanel = panelById.get('geometry-revision');
  const gableRakePanel = panelById.get('gable-rake-geometry');

  if (geometryPanel) {
    positions[geometryPanel.id] = {
      left: Math.max(DEBUG_OVERLAY_INSET, (containerWidth - geometryPanel.width) / 2),
      top: containerHeight - DEBUG_OVERLAY_INSET - geometryPanel.height,
    };
  }

  if (gableRakePanel) {
    positions[gableRakePanel.id] = {
      left: DEBUG_OVERLAY_INSET,
      top: containerHeight - DEBUG_OVERLAY_INSET - gableRakePanel.height,
    };
  }

  let rightY = DEBUG_OVERLAY_INSET;
  for (const panel of panelsInColumn('right-stack')) {
    positions[panel.id] = {
      left: Math.max(DEBUG_OVERLAY_INSET, containerWidth - DEBUG_OVERLAY_INSET - panel.width),
      top: rightY,
    };
    rightY += panel.height + DEBUG_OVERLAY_GAP;
  }

  const leftBottomTop =
    gableRakePanel != null
      ? positions[gableRakePanel.id]!.top
      : geometryPanel != null
        ? positions[geometryPanel.id]!.top
        : containerHeight - DEBUG_OVERLAY_INSET;

  let leftTopY = DEBUG_OVERLAY_INSET;
  for (const panel of panelsInColumn('left-top-stack')) {
    const nextBottom = leftTopY + panel.height;
    if (nextBottom > leftBottomTop - DEBUG_OVERLAY_GAP) {
      break;
    }
    positions[panel.id] = {
      left: DEBUG_OVERLAY_INSET,
      top: leftTopY,
    };
    leftTopY = nextBottom + DEBUG_OVERLAY_GAP;
  }

  return positions;
}
