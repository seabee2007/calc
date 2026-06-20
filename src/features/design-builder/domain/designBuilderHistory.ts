import type { CmuBuildingPreset } from './designBuilderPreset';
import { resolveDesignMasonrySettings } from './masonrySettings';
import {
  createDefaultStructuralFrameSystem,
  createEmptyCmuInfillSystem,
  createEmptyGableEndSystem,
} from './structuralFrameDefaults';
import type {
  CmuWallSystemParameters,
  DesignBuilderLayoutMode,
  DesignModelObject,
  DesignObjectType,
  DesignWallLayoutParameters,
  FoundationSetout,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';

export type DesignHistoryCommandKind =
  | 'wall_add'
  | 'wall_delete'
  | 'wall_move'
  | 'close_footprint'
  | 'opening_add'
  | 'opening_move'
  | 'opening_delete'
  | 'opening_edit'
  | 'masonry_settings_update'
  | 'module_fit_apply'
  | 'layout_reset'
  | 'footprint_update'
  | 'structure_update';

export type DesignBuilderSnapshot = {
  wallLayout: DesignWallLayoutParameters;
  openings: WallOpeningParameters[];
  masonrySettings: ReturnType<typeof resolveDesignMasonrySettings>;
  masonryWall: CmuWallSystemParameters;
  footprint: CmuBuildingPreset['footprint'];
  foundationSettings: FoundationSetout;
  slab: ThickenedEdgeSlabParameters;
  roof: CmuBuildingPreset['roof'];
  truss: CmuBuildingPreset['truss'];
  buildingSystemMode: CmuBuildingPreset['buildingSystemMode'];
  frameSystem: CmuBuildingPreset['frameSystem'];
  infillSystem: CmuBuildingPreset['infillSystem'];
  gableEndSystem: CmuBuildingPreset['gableEndSystem'];
  designObjects: DesignModelObject[];
  layoutState: DesignBuilderLayoutMode;
  selectedOpeningId: string | null;
  selectedSegmentId: string | null;
  selectedNodeId: string | null;
  selectedObjectType: DesignObjectType | null;
};

export type DesignHistoryCommand = {
  id: string;
  label: string;
  kind: DesignHistoryCommandKind;
  before: DesignBuilderSnapshot;
  after: DesignBuilderSnapshot;
};

export type DesignHistoryState = {
  undoStack: DesignHistoryCommand[];
  redoStack: DesignHistoryCommand[];
};

export function createDesignHistoryState(): DesignHistoryState {
  return { undoStack: [], redoStack: [] };
}

function foundationFromSlab(slab: ThickenedEdgeSlabParameters): FoundationSetout {
  return {
    slabEdgeOffsetMeters: 0,
    thickenedEdgeWidthMeters: slab.edgeWidthMeters,
    thickenedEdgeDepthMeters: slab.edgeDepthMeters,
    wallBearingOffsetMeters: 0,
  };
}

export function createDesignSnapshot(params: {
  preset: CmuBuildingPreset;
  objects: DesignModelObject[];
  layoutState: DesignBuilderLayoutMode;
  selectedOpeningId?: string | null;
  selectedSegmentId?: string | null;
  selectedNodeId?: string | null;
  selectedObjectType?: DesignObjectType | null;
}): DesignBuilderSnapshot {
  const wall = params.preset.wall;
  return {
    wallLayout: structuredClone(params.preset.wallLayout),
    openings: structuredClone(wall.openings),
    masonrySettings: resolveDesignMasonrySettings(wall),
    masonryWall: structuredClone(wall),
    footprint: structuredClone(params.preset.footprint),
    foundationSettings: foundationFromSlab(params.preset.slab),
    slab: structuredClone(params.preset.slab),
    roof: structuredClone(params.preset.roof),
    truss: structuredClone(params.preset.truss),
    frameSystem: structuredClone(params.preset.frameSystem ?? createDefaultStructuralFrameSystem()),
    infillSystem: structuredClone(params.preset.infillSystem ?? createEmptyCmuInfillSystem()),
    gableEndSystem: structuredClone(params.preset.gableEndSystem ?? createEmptyGableEndSystem()),
    buildingSystemMode: params.preset.buildingSystemMode ?? 'cmu_bearing_wall',
    designObjects: structuredClone(params.objects),
    layoutState: params.layoutState,
    selectedOpeningId: params.selectedOpeningId ?? null,
    selectedSegmentId: params.selectedSegmentId ?? null,
    selectedNodeId: params.selectedNodeId ?? null,
    selectedObjectType: params.selectedObjectType ?? null,
  };
}

export function snapshotToPreset(snapshot: DesignBuilderSnapshot, name: string): CmuBuildingPreset {
  return {
    name,
    buildingSystemMode: snapshot.buildingSystemMode ?? 'cmu_bearing_wall',
    wallLayout: structuredClone(snapshot.wallLayout),
    footprint: structuredClone(snapshot.footprint),
    slab: structuredClone(snapshot.slab),
    roof: structuredClone(snapshot.roof),
    truss: structuredClone(snapshot.truss),
    frameSystem: structuredClone(snapshot.frameSystem ?? createDefaultStructuralFrameSystem()),
    infillSystem: structuredClone(snapshot.infillSystem ?? createEmptyCmuInfillSystem()),
    gableEndSystem: structuredClone(snapshot.gableEndSystem ?? createEmptyGableEndSystem()),
    wall: {
      ...structuredClone(snapshot.masonryWall),
      openings: structuredClone(snapshot.openings),
      lengthMeters: snapshot.footprint.lengthMeters,
      widthMeters: snapshot.footprint.widthMeters,
    },
  };
}

export function snapshotsEqual(left: DesignBuilderSnapshot, right: DesignBuilderSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pushDesignHistoryCommand(
  state: DesignHistoryState,
  command: DesignHistoryCommand,
): DesignHistoryState {
  return {
    undoStack: [...state.undoStack, command],
    redoStack: [],
  };
}

export function undoDesignHistoryCommand(state: DesignHistoryState): {
  state: DesignHistoryState;
  command: DesignHistoryCommand | null;
} {
  if (state.undoStack.length === 0) {
    return { state, command: null };
  }
  const command = state.undoStack[state.undoStack.length - 1]!;
  return {
    command,
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command],
    },
  };
}

export function redoDesignHistoryCommand(state: DesignHistoryState): {
  state: DesignHistoryState;
  command: DesignHistoryCommand | null;
} {
  if (state.redoStack.length === 0) {
    return { state, command: null };
  }
  const command = state.redoStack[state.redoStack.length - 1]!;
  return {
    command,
    state: {
      undoStack: [...state.undoStack, command],
      redoStack: state.redoStack.slice(0, -1),
    },
  };
}

export function canUndoDesignHistory(state: DesignHistoryState): boolean {
  return state.undoStack.length > 0;
}

export function canRedoDesignHistory(state: DesignHistoryState): boolean {
  return state.redoStack.length > 0;
}

export function peekUndoDesignCommand(state: DesignHistoryState): DesignHistoryCommand | null {
  return state.undoStack[state.undoStack.length - 1] ?? null;
}

export function peekRedoDesignCommand(state: DesignHistoryState): DesignHistoryCommand | null {
  return state.redoStack[state.redoStack.length - 1] ?? null;
}

export function createDesignHistoryCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `design-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function patchDesignSnapshot(
  before: DesignBuilderSnapshot,
  presetName: string,
  patch: (preset: CmuBuildingPreset) => CmuBuildingPreset,
  options: {
    designObjects?: DesignModelObject[];
    layoutState?: DesignBuilderLayoutMode;
    selectedOpeningId?: string | null;
    selectedSegmentId?: string | null;
    selectedNodeId?: string | null;
    selectedObjectType?: DesignObjectType | null;
  } = {},
): DesignBuilderSnapshot {
  const nextPreset = patch(snapshotToPreset(before, presetName));
  return createDesignSnapshot({
    preset: nextPreset,
    objects: options.designObjects ?? before.designObjects,
    layoutState:
      options.layoutState ??
      (nextPreset.wallLayout.segments.length > 0 ? 'editing' : before.layoutState),
    selectedOpeningId: options.selectedOpeningId ?? before.selectedOpeningId,
    selectedSegmentId: options.selectedSegmentId ?? before.selectedSegmentId,
    selectedNodeId: options.selectedNodeId ?? before.selectedNodeId,
    selectedObjectType: options.selectedObjectType ?? before.selectedObjectType,
  });
}
