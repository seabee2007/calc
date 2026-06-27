import type { CmuBuildingPreset } from './designBuilderPreset';
import { createBlankCmuBuildingPreset } from './designBuilderPreset';
import { normalizeOpeningsHeadAlignment } from './openingDefaults';
import { normalizeRcFrameFoundationSettings } from './rcFrameFoundationMigration';
import {
  normalizeRoofSystemSettings,
  createDefaultRoofSystemSettings,
  syncRoofSystemTrussSpacing,
} from './roofSystemDefaults';
import { normalizeCmuInfillSystem } from './infillPlaster';
import type {
  BuildingSystemMode,
  DesignBuilderElevationViewState,
  DesignBuilderStoredViewMode,
  DesignModel,
  DesignModelObject,
  DesignWallLayoutParameters,
  PlacedDesignComponent,
  RcFrameFoundationSettings,
  RoofSystemSettings,
  WallOpeningParameters,
} from '../types';

export const PERSISTED_DESIGN_BUILDER_SCHEMA_VERSION = 2;

export type DesignBuilderPersistenceMode = 'project_bound' | 'standalone_demo';

export type DesignBuilderPersistenceContext = {
  projectId: string | null;
  estimateId: string | null;
  userId: string | null;
  workspaceId: string | null;
  canPersist: boolean;
  mode: DesignBuilderPersistenceMode;
};

export type PersistedDesignBuilderState = {
  schemaVersion: number;
  buildingSystemMode: BuildingSystemMode;
  rcFrameFoundation: RcFrameFoundationSettings;
  roofSystem: RoofSystemSettings;
  wallLayout: DesignWallLayoutParameters;
  openings: WallOpeningParameters[];
  displayPreferences?: {
    activeView?: DesignBuilderStoredViewMode;
    elevationView?: DesignBuilderElevationViewState;
    roofDisplayMode?: string;
    foundationViewMode?: string;
    visualStyle?: string;
      materialSelections?: {
      cmuMaterialId?: string;
      mortarMaterialId?: string;
        castConcreteMaterialId?: string;
        roofSheetMaterialId?: string;
      fasciaMaterialId?: string;
        soffitMaterialId?: string;
        plasterMaterialId?: string;
        structuralSteelMaterialId?: string;
        siteGroundMaterialId?: string;
      mortarTintId?: string;
      roofSheetTintId?: string;
      fasciaTintId?: string;
        soffitTintId?: string;
        plasterTintId?: string;
        structuralSteelTintId?: string;
      };
  };
  placedComponents: PlacedDesignComponent[];
  updatedAt: string;
};

export type DesignBuilderSaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

export function resolveDesignBuilderPersistenceContext(params: {
  projectId: string;
  estimateId: string | null;
  userId: string | null | undefined;
  workspaceId?: string | null;
}): DesignBuilderPersistenceContext {
  const canPersist = Boolean(params.userId && params.projectId && params.estimateId);
  return {
    projectId: params.projectId,
    estimateId: params.estimateId,
    userId: params.userId ?? null,
    workspaceId: params.workspaceId ?? null,
    canPersist,
    mode: canPersist ? 'project_bound' : 'standalone_demo',
  };
}

export function serializePersistedDesignBuilderState(
  preset: CmuBuildingPreset,
  displayPreferences?: PersistedDesignBuilderState['displayPreferences'],
  placedComponents: PlacedDesignComponent[] = [],
): PersistedDesignBuilderState {
  return {
    schemaVersion: PERSISTED_DESIGN_BUILDER_SCHEMA_VERSION,
    buildingSystemMode: preset.buildingSystemMode,
    rcFrameFoundation: normalizeRcFrameFoundationSettings(preset.foundationSettings),
    roofSystem: normalizeRoofSystemSettings(preset.roofSystem ?? createDefaultRoofSystemSettings()),
    wallLayout: structuredClone(preset.wallLayout),
    openings: structuredClone(preset.wall.openings),
    displayPreferences,
    placedComponents: structuredClone(placedComponents),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStoredViewMode(value: unknown): DesignBuilderStoredViewMode | undefined {
  if (value === '2d') return 'plan';
  if (value === 'plan' || value === 'elevation' || value === '3d') return value;
  return undefined;
}

function normalizeElevationView(value: unknown): DesignBuilderElevationViewState {
  if (!value || typeof value !== 'object') return { face: 'north' };
  const raw = value as Partial<DesignBuilderElevationViewState>;
  const face = raw.face === 'east' || raw.face === 'south' || raw.face === 'west' ? raw.face : 'north';
  return {
    face,
    cursorX: typeof raw.cursorX === 'number' ? raw.cursorX : undefined,
    cursorZ: typeof raw.cursorZ === 'number' ? raw.cursorZ : undefined,
  };
}

function normalizePlacedComponents(value: unknown): PlacedDesignComponent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlacedDesignComponent => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<PlacedDesignComponent>;
    return Boolean(candidate.id && candidate.type && candidate.parameters && candidate.viewPlacement);
  });
}

export function migratePersistedDesignBuilderState(
  raw: Partial<PersistedDesignBuilderState> | null | undefined,
): PersistedDesignBuilderState | null {
  if (!raw || typeof raw !== 'object') return null;
  const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (schemaVersion > PERSISTED_DESIGN_BUILDER_SCHEMA_VERSION) return null;
  if (!raw.rcFrameFoundation || !raw.roofSystem) return null;
  return {
    schemaVersion: PERSISTED_DESIGN_BUILDER_SCHEMA_VERSION,
    buildingSystemMode:
      raw.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'
        ? 'reinforced_concrete_frame_with_cmu_infill'
        : 'cmu_bearing_wall',
    rcFrameFoundation: normalizeRcFrameFoundationSettings(raw.rcFrameFoundation),
    roofSystem: normalizeRoofSystemSettings(raw.roofSystem),
    wallLayout: structuredClone(raw.wallLayout ?? createBlankCmuBuildingPreset().wallLayout),
    openings: normalizeOpeningsHeadAlignment(structuredClone(raw.openings ?? [])),
    displayPreferences: raw.displayPreferences
      ? {
          ...raw.displayPreferences,
          activeView: normalizeStoredViewMode(raw.displayPreferences.activeView),
          elevationView: normalizeElevationView(raw.displayPreferences.elevationView),
        }
      : {
          elevationView: { face: 'north' },
        },
    placedComponents: normalizePlacedComponents(raw.placedComponents),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function readPersistedDesignBuilderState(model: DesignModel): PersistedDesignBuilderState | null {
  const metadata = model.metadata ?? {};
  const nested = metadata.designBuilderState;
  if (nested && typeof nested === 'object') {
    return migratePersistedDesignBuilderState(nested as Partial<PersistedDesignBuilderState>);
  }
  return null;
}

function parametersFor<T>(objects: DesignModelObject[], objectType: DesignModelObject['objectType']): T | undefined {
  const match = objects.find((object) => object.objectType === objectType);
  return match?.parameters as T | undefined;
}

export function presetFromStoredDesign(params: {
  objects: DesignModelObject[];
  persistedState?: PersistedDesignBuilderState | null;
  fallbackName?: string;
}): CmuBuildingPreset {
  const base = createBlankCmuBuildingPreset();
  const footprint = parametersFor<CmuBuildingPreset['footprint']>(params.objects, 'building_footprint');
  const wallLayout = parametersFor<DesignWallLayoutParameters>(params.objects, 'wall_layout');
  const slab = parametersFor<CmuBuildingPreset['slab']>(params.objects, 'thickened_edge_slab');
  const wall = parametersFor<CmuBuildingPreset['wall']>(params.objects, 'cmu_wall_system');
  const roof = parametersFor<CmuBuildingPreset['roof']>(params.objects, 'gable_roof_system');
  const truss = parametersFor<CmuBuildingPreset['truss']>(params.objects, 'steel_truss_system');
  const frameSystem = parametersFor<CmuBuildingPreset['frameSystem']>(params.objects, 'structural_frame_system');
  const infillSystem = parametersFor<CmuBuildingPreset['infillSystem']>(params.objects, 'cmu_infill_system');
  const gableEndSystem = parametersFor<CmuBuildingPreset['gableEndSystem']>(params.objects, 'gable_end_system');
  const persisted = params.persistedState;

  const resolvedWallLayout = wallLayout ?? persisted?.wallLayout ?? base.wallLayout;
  const resolvedWall = wall ?? base.wall;
  const resolvedOpenings = normalizeOpeningsHeadAlignment(persisted?.openings ?? resolvedWall.openings);
  const resolvedTruss = truss ?? base.truss;
  const resolvedRoofSystem = truss
    ? syncRoofSystemTrussSpacing(
        normalizeRoofSystemSettings(persisted?.roofSystem ?? base.roofSystem),
        truss.spacingMeters,
      )
    : (persisted?.roofSystem ?? normalizeRoofSystemSettings(base.roofSystem));

  return {
    name: params.fallbackName ?? base.name,
    buildingSystemMode: persisted?.buildingSystemMode ?? base.buildingSystemMode,
    footprint: footprint ?? base.footprint,
    wallLayout: resolvedWallLayout,
    slab: slab ?? base.slab,
    wall: { ...resolvedWall, openings: resolvedOpenings },
    roof: roof ?? base.roof,
    truss: resolvedTruss,
    frameSystem: frameSystem ?? base.frameSystem,
    foundationSettings: persisted?.rcFrameFoundation ?? normalizeRcFrameFoundationSettings(base.foundationSettings),
    infillSystem: normalizeCmuInfillSystem(infillSystem ?? base.infillSystem),
    gableEndSystem: gableEndSystem ?? base.gableEndSystem,
    roofSystem: resolvedRoofSystem,
  };
}

export function designModelMetadataWithPersistedState(
  model: DesignModel,
  preset: CmuBuildingPreset,
  displayPreferences?: PersistedDesignBuilderState['displayPreferences'],
  placedComponents: PlacedDesignComponent[] = [],
): Record<string, unknown> {
  return {
    ...model.metadata,
    source: 'parametric_design_builder',
    designBuilderState: serializePersistedDesignBuilderState(preset, displayPreferences, placedComponents),
  };
}

export function saveStateLabel(state: DesignBuilderSaveState): string {
  switch (state) {
    case 'saved':
      return 'Saved';
    case 'unsaved':
      return 'Unsaved changes';
    case 'saving':
      return 'Saving…';
    case 'failed':
      return 'Save failed';
    default:
      return '';
  }
}

export function persistenceStatusMessage(mode: DesignBuilderPersistenceMode): string {
  return mode === 'project_bound'
    ? 'Design is linked to this Detailed Estimate.'
    : 'Open this tool from a saved Detailed Estimate to store the design with your project.';
}

export function validateDesignBuilderPersistenceContext(context: DesignBuilderPersistenceContext): void {
  if (!context.estimateId || !context.projectId || !context.userId) {
    throw new Error('Design Builder must be opened from a saved project estimate.');
  }
}
