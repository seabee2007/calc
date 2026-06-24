export const DEBUG_OVERLAY_LAYOUT_VERSION = 2;
export const DEBUG_OVERLAY_INSET = 12;
export const DEBUG_OVERLAY_GAP = 8;
export const DEBUG_OVERLAY_STORAGE_PREFIX = `design-builder-debug-overlay:v${DEBUG_OVERLAY_LAYOUT_VERSION}:`;

export type DebugOverlayColumn = 'right-stack';

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

  const panelsInColumn = () =>
    panels
      .filter((panel) => DEBUG_OVERLAY_SLOT_BY_ID[panel.id]?.column === 'right-stack')
      .sort(
        (left, right) =>
          (DEBUG_OVERLAY_SLOT_BY_ID[left.id]?.stackOrder ?? 0) -
          (DEBUG_OVERLAY_SLOT_BY_ID[right.id]?.stackOrder ?? 0),
      );

  let rightY = DEBUG_OVERLAY_INSET;
  for (const panel of panelsInColumn()) {
    positions[panel.id] = {
      left: Math.max(DEBUG_OVERLAY_INSET, containerWidth - DEBUG_OVERLAY_INSET - panel.width),
      top: rightY,
    };
    rightY += panel.height + DEBUG_OVERLAY_GAP;
  }

  return positions;
}
