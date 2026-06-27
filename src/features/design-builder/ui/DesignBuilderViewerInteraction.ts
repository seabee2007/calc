import type {
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  DesignObjectType,
  WallOpeningParameters,
} from '../types';
import type {
  DesignBuilderViewerSelectablePick,
  DesignBuilderViewerWallPick,
} from './DesignBuilderViewerPicking';

export type {
  DesignBuilderViewerSelectablePick,
  DesignBuilderViewerWallPick,
} from './DesignBuilderViewerPicking';

export type DesignBuilderManualMasonryPointerEvent = {
  kind: 'preview' | 'start' | 'commit' | 'cancel_preview' | 'undo';
  planX?: number;
  planZ?: number;
};

export interface DesignBuilderViewerInteractionController {
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleContextMenu: (event: MouseEvent) => void;
  getState: () => {
    pointerDown: { x: number; y: number; button: number } | null;
    manualBrushActive: boolean;
    dragOpeningId: string | null;
  };
}

export function createDesignBuilderViewerInteractionController(params: {
  clickDragThresholdPx: number;
  getToolMode: () => DesignBuilderToolMode;
  isManualMasonryEnabled: () => boolean;
  pickManualBrushPoint: (event: PointerEvent) => { x: number; z: number } | null;
  pickWall: (event: PointerEvent) => DesignBuilderViewerWallPick | null;
  pickSelectable: (event: PointerEvent) => DesignBuilderViewerSelectablePick | null;
  emitInteraction: (event: DesignBuilderInteractionEvent) => void;
  emitManualMasonryPointer: (event: DesignBuilderManualMasonryPointerEvent) => void;
  selectObjectType: (objectType: DesignObjectType) => void;
  setControlsEnabled: (enabled: boolean) => void;
  clearPlacementPreview: () => void;
  getOpeningType: (openingId: string) => WallOpeningParameters['type'] | undefined;
  getHoveredOpeningId: () => string | null;
  setHoveredOpeningId: (openingId: string | null) => void;
  rebuildModel: () => void;
}): DesignBuilderViewerInteractionController {
  let pointerDown: { x: number; y: number; button: number } | null = null;
  let manualBrushActive = false;
  let dragOpeningId: string | null = null;

  const emitWallInteraction = (
    kind: 'wall_pick' | 'place_commit',
    toolMode: DesignBuilderToolMode,
    pick: DesignBuilderViewerWallPick,
  ) => {
    params.emitInteraction({
      kind,
      toolMode,
      wallFace: pick.wallFace,
      offsetMeters: pick.offsetMeters,
      wallSegmentId: pick.wallSegmentId,
      positionAlongSegment: pick.positionAlongSegment,
      hitPointX: pick.hitPoint?.x,
      hitPointY: pick.hitPoint?.y,
      hitPointZ: pick.hitPoint?.z,
      openingType: toolMode === 'place_door' ? 'door' : 'window',
    });
  };

  const emitOpeningMove = (
    phase: 'preview' | 'commit',
    toolMode: DesignBuilderToolMode,
    openingId: string,
    pick: DesignBuilderViewerWallPick,
  ) => {
    params.emitInteraction({
      kind: 'opening_move',
      toolMode,
      phase,
      openingId,
      wallFace: pick.wallFace,
      offsetMeters: pick.offsetMeters,
      wallSegmentId: pick.wallSegmentId,
      positionAlongSegment: pick.positionAlongSegment,
      hitPointX: pick.hitPoint?.x,
      hitPointY: pick.hitPoint?.y,
      hitPointZ: pick.hitPoint?.z,
      ...(phase === 'commit' ? { openingType: params.getOpeningType(openingId) } : {}),
    });
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button === 1) event.preventDefault();
    pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
    const mode = params.getToolMode();
    if (params.isManualMasonryEnabled() && event.button === 0) {
      const point = params.pickManualBrushPoint(event);
      if (!point) return;
      event.preventDefault();
      manualBrushActive = true;
      params.setControlsEnabled(false);
      params.emitManualMasonryPointer({ kind: 'start', planX: point.x, planZ: point.z });
      return;
    }
    if (mode === 'move_opening' && event.button === 0) {
      const hit = params.pickSelectable(event);
      const openingId = hit?.data.openingId;
      if (openingId) {
        dragOpeningId = openingId;
        params.setControlsEnabled(false);
      }
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    const mode = params.getToolMode();
    if (params.isManualMasonryEnabled()) {
      const point = params.pickManualBrushPoint(event);
      if (!point) return;
      params.emitManualMasonryPointer({ kind: 'preview', planX: point.x, planZ: point.z });
      return;
    }
    if (dragOpeningId) {
      const pick = params.pickWall(event);
      if (!pick) {
        params.clearPlacementPreview();
        return;
      }
      emitOpeningMove('preview', mode, dragOpeningId, pick);
      return;
    }
    if (mode === 'place_door' || mode === 'place_window') {
      const pick = params.pickWall(event);
      if (!pick) return;
      emitWallInteraction('wall_pick', mode, pick);
      return;
    }
    if (mode === 'select' && !dragOpeningId) {
      const hit = params.pickSelectable(event);
      const nextHoveredOpeningId = hit?.data.openingId ?? null;
      if (nextHoveredOpeningId !== params.getHoveredOpeningId()) {
        params.setHoveredOpeningId(nextHoveredOpeningId);
        params.rebuildModel();
      }
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (params.isManualMasonryEnabled() && manualBrushActive && event.button === 0) {
      const point = params.pickManualBrushPoint(event);
      manualBrushActive = false;
      params.setControlsEnabled(true);
      pointerDown = null;
      if (point) {
        params.emitManualMasonryPointer({ kind: 'commit', planX: point.x, planZ: point.z });
      }
      return;
    }
    if (event.button !== 0 || pointerDown?.button !== 0) {
      pointerDown = null;
      return;
    }
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    const mode = params.getToolMode();

    if (dragOpeningId) {
      const pick = params.pickWall(event);
      if (pick) {
        emitOpeningMove('commit', mode, dragOpeningId, pick);
      }
      dragOpeningId = null;
      params.setControlsEnabled(true);
      return;
    }

    if (moved > params.clickDragThresholdPx) return;

    if (mode === 'place_door' || mode === 'place_window') {
      const pick = params.pickWall(event);
      if (!pick) return;
      emitWallInteraction('place_commit', mode, pick);
      return;
    }

    const pick = params.pickSelectable(event);
    const openingId = pick?.data.openingId;
    if (openingId) {
      params.emitInteraction({
        kind: 'select_opening',
        toolMode: mode,
        openingId,
        openingType: pick.data.designObjectType === 'door_opening' ? 'door' : 'window',
      });
      return;
    }
    const objectType = pick?.data.designObjectType;
    if (objectType) {
      params.selectObjectType(objectType);
      params.emitInteraction({ kind: 'select_object', toolMode: mode, objectType });
      return;
    }
    params.emitInteraction({ kind: 'clear_selection', toolMode: mode });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (params.isManualMasonryEnabled() && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault();
      params.emitManualMasonryPointer({ kind: 'undo' });
      return;
    }
    if (event.key !== 'Escape') return;
    dragOpeningId = null;
    manualBrushActive = false;
    params.setControlsEnabled(true);
    if (params.isManualMasonryEnabled()) {
      params.emitManualMasonryPointer({ kind: 'cancel_preview' });
      return;
    }
    params.emitInteraction({ kind: 'cancel', toolMode: params.getToolMode() });
  };

  const handleContextMenu = (event: MouseEvent) => {
    if (!params.isManualMasonryEnabled()) return;
    event.preventDefault();
    params.emitManualMasonryPointer({ kind: 'undo' });
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleContextMenu,
    getState: () => ({ pointerDown, manualBrushActive, dragOpeningId }),
  };
}
