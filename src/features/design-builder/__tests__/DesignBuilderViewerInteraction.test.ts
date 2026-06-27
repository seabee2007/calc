import { describe, expect, it, vi } from 'vitest';
import type {
  DesignBuilderInteractionEvent,
  DesignBuilderToolMode,
  DesignObjectType,
  WallOpeningParameters,
} from '../types';
import {
  createDesignBuilderViewerInteractionController,
  type DesignBuilderManualMasonryPointerEvent,
  type DesignBuilderViewerSelectablePick,
  type DesignBuilderViewerWallPick,
} from '../ui/DesignBuilderViewerInteraction';

function pointerEvent(
  partial: Partial<Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>> = {},
): PointerEvent {
  return {
    button: partial.button ?? 0,
    clientX: partial.clientX ?? 10,
    clientY: partial.clientY ?? 20,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

function keyboardEvent(key: string): KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

function mouseEvent(): MouseEvent {
  return {
    preventDefault: vi.fn(),
  } as unknown as MouseEvent;
}

function createHarness() {
  let toolMode: DesignBuilderToolMode = 'select';
  let manualMasonryEnabled = false;
  let controlsEnabled = true;
  let hoveredOpeningId: string | null = null;
  let wallPick: DesignBuilderViewerWallPick | null = null;
  let selectablePick: DesignBuilderViewerSelectablePick | null = null;
  let manualPoint: { x: number; z: number } | null = null;
  const interactions: DesignBuilderInteractionEvent[] = [];
  const manualEvents: DesignBuilderManualMasonryPointerEvent[] = [];
  const selectedObjectTypes: DesignObjectType[] = [];
  const rebuildModel = vi.fn();
  const clearPlacementPreview = vi.fn();
  const controller = createDesignBuilderViewerInteractionController({
    clickDragThresholdPx: 5,
    getToolMode: () => toolMode,
    isManualMasonryEnabled: () => manualMasonryEnabled,
    pickManualBrushPoint: () => manualPoint,
    pickWall: () => wallPick,
    pickSelectable: () => selectablePick,
    emitInteraction: (event) => interactions.push(event),
    emitManualMasonryPointer: (event) => manualEvents.push(event),
    selectObjectType: (objectType) => selectedObjectTypes.push(objectType),
    setControlsEnabled: (enabled) => {
      controlsEnabled = enabled;
    },
    clearPlacementPreview,
    getOpeningType: (openingId): WallOpeningParameters['type'] | undefined =>
      openingId === 'door-1' ? 'door' : undefined,
    getHoveredOpeningId: () => hoveredOpeningId,
    setHoveredOpeningId: (openingId) => {
      hoveredOpeningId = openingId;
    },
    rebuildModel,
  });
  return {
    controller,
    interactions,
    manualEvents,
    selectedObjectTypes,
    rebuildModel,
    clearPlacementPreview,
    get controlsEnabled() {
      return controlsEnabled;
    },
    get hoveredOpeningId() {
      return hoveredOpeningId;
    },
    setToolMode: (mode: DesignBuilderToolMode) => {
      toolMode = mode;
    },
    setManualMasonryEnabled: (enabled: boolean) => {
      manualMasonryEnabled = enabled;
    },
    setWallPick: (pick: DesignBuilderViewerWallPick | null) => {
      wallPick = pick;
    },
    setSelectablePick: (pick: DesignBuilderViewerSelectablePick | null) => {
      selectablePick = pick;
    },
    setManualPoint: (point: { x: number; z: number } | null) => {
      manualPoint = point;
    },
  };
}

describe('DesignBuilderViewerInteraction', () => {
  it('emits wall preview and commit events for opening placement', () => {
    const harness = createHarness();
    harness.setToolMode('place_window');
    harness.setWallPick({
      wallFace: 'north',
      offsetMeters: 1.25,
      hitPoint: { x: 1, y: 0.5, z: -2 },
    });

    harness.controller.handlePointerMove(pointerEvent());
    harness.controller.handlePointerDown(pointerEvent({ clientX: 10, clientY: 10 }));
    harness.controller.handlePointerUp(pointerEvent({ clientX: 12, clientY: 10 }));

    expect(harness.interactions).toEqual([
      expect.objectContaining({
        kind: 'wall_pick',
        toolMode: 'place_window',
        wallFace: 'north',
        offsetMeters: 1.25,
        openingType: 'window',
        hitPointX: 1,
        hitPointY: 0.5,
        hitPointZ: -2,
      }),
      expect.objectContaining({
        kind: 'place_commit',
        toolMode: 'place_window',
        wallFace: 'north',
        offsetMeters: 1.25,
        openingType: 'window',
      }),
    ]);
  });

  it('drags an existing opening through preview and commit phases', () => {
    const harness = createHarness();
    harness.setToolMode('move_opening');
    harness.setSelectablePick({
      data: {
        designObjectType: 'door_opening',
        openingId: 'door-1',
      },
    });
    harness.setWallPick({
      wallSegmentId: 'segment-1',
      positionAlongSegment: 2.4,
      hitPoint: { x: 2, y: 0.2, z: 0 },
    });

    harness.controller.handlePointerDown(pointerEvent());
    expect(harness.controlsEnabled).toBe(false);
    expect(harness.controller.getState().dragOpeningId).toBe('door-1');

    harness.controller.handlePointerMove(pointerEvent());
    harness.controller.handlePointerUp(pointerEvent());

    expect(harness.interactions).toEqual([
      expect.objectContaining({
        kind: 'opening_move',
        phase: 'preview',
        openingId: 'door-1',
        wallSegmentId: 'segment-1',
        positionAlongSegment: 2.4,
      }),
      expect.objectContaining({
        kind: 'opening_move',
        phase: 'commit',
        openingId: 'door-1',
        wallSegmentId: 'segment-1',
        openingType: 'door',
      }),
    ]);
    expect(harness.controlsEnabled).toBe(true);
    expect(harness.controller.getState().dragOpeningId).toBeNull();
  });

  it('clears the ghost preview when an opening drag leaves wall pickables', () => {
    const harness = createHarness();
    harness.setToolMode('move_opening');
    harness.setSelectablePick({
      data: {
        designObjectType: 'window_opening',
        openingId: 'window-1',
      },
    });
    harness.controller.handlePointerDown(pointerEvent());
    harness.setWallPick(null);
    harness.controller.handlePointerMove(pointerEvent());

    expect(harness.clearPlacementPreview).toHaveBeenCalledTimes(1);
    expect(harness.interactions).toHaveLength(0);
  });

  it('updates opening hover state only when the hovered opening changes', () => {
    const harness = createHarness();
    harness.setToolMode('select');
    harness.setSelectablePick({
      data: {
        designObjectType: 'window_opening',
        openingId: 'window-1',
      },
    });

    harness.controller.handlePointerMove(pointerEvent());
    harness.controller.handlePointerMove(pointerEvent());
    expect(harness.hoveredOpeningId).toBe('window-1');
    expect(harness.rebuildModel).toHaveBeenCalledTimes(1);

    harness.setSelectablePick(null);
    harness.controller.handlePointerMove(pointerEvent());
    expect(harness.hoveredOpeningId).toBeNull();
    expect(harness.rebuildModel).toHaveBeenCalledTimes(2);
  });

  it('selects objects or clears selection on click', () => {
    const harness = createHarness();
    harness.setToolMode('select');
    harness.setSelectablePick({
      data: {
        designObjectType: 'cmu_wall_system',
      },
    });

    harness.controller.handlePointerDown(pointerEvent({ clientX: 1, clientY: 1 }));
    harness.controller.handlePointerUp(pointerEvent({ clientX: 1, clientY: 1 }));
    expect(harness.selectedObjectTypes).toEqual(['cmu_wall_system']);
    expect(harness.interactions.at(-1)).toMatchObject({
      kind: 'select_object',
      objectType: 'cmu_wall_system',
    });

    harness.setSelectablePick(null);
    harness.controller.handlePointerDown(pointerEvent({ clientX: 1, clientY: 1 }));
    harness.controller.handlePointerUp(pointerEvent({ clientX: 1, clientY: 1 }));
    expect(harness.interactions.at(-1)).toMatchObject({ kind: 'clear_selection' });
  });

  it('handles manual masonry brush start, preview, commit, undo, and cancel', () => {
    const harness = createHarness();
    harness.setManualMasonryEnabled(true);
    harness.setManualPoint({ x: 3, z: 4 });
    const down = pointerEvent();

    harness.controller.handlePointerDown(down);
    harness.controller.handlePointerMove(pointerEvent());
    harness.controller.handlePointerUp(pointerEvent());
    harness.controller.handleContextMenu(mouseEvent());
    harness.controller.handleKeyDown(keyboardEvent('Delete'));
    harness.controller.handleKeyDown(keyboardEvent('Escape'));

    expect(down.preventDefault).toHaveBeenCalled();
    expect(harness.controlsEnabled).toBe(true);
    expect(harness.manualEvents).toEqual([
      { kind: 'start', planX: 3, planZ: 4 },
      { kind: 'preview', planX: 3, planZ: 4 },
      { kind: 'commit', planX: 3, planZ: 4 },
      { kind: 'undo' },
      { kind: 'undo' },
      { kind: 'cancel_preview' },
    ]);
  });
});
