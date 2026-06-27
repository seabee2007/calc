import type {
  CmuBuildingPreset,
} from './designBuilderPreset';
import type { DesignWallLayoutParameters } from '../types';
import {
  autoFrameLayout,
  createCornerColumnsForLayout,
  createPerimeterBeamsForLayout,
  reconcileStructuralFrameWithFoundation,
} from './structuralFrameLayout';
import { createDefaultFoundationSettings, resolveEffectiveWallHeightMeters } from './foundationElevations';
import { applyProjectMasonryDefaultsToLayout } from './masonrySettings';
import { syncPresetFromLayout } from './layoutWallAdapter';
import { deriveInfillPanelsForLayout } from './cmuInfillPanelSolver';
import { createDefaultGableEnd } from '../geometry/structuralFrameGeometry';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import type { BuildingSystemMode, RcFrameFoundationSettings, RoofSystemSettings } from '../types';
import { normalizeRcFrameFoundationSettings } from './rcFrameFoundationMigration';
import { normalizeRoofSystemSettings } from './roofSystemDefaults';
import { normalizeCmuInfillSystem } from './infillPlaster';

export function resolveFoundationSettings(preset: CmuBuildingPreset): RcFrameFoundationSettings {
  return normalizeRcFrameFoundationSettings(preset.foundationSettings);
}

export function setBuildingSystemMode(
  preset: CmuBuildingPreset,
  mode: BuildingSystemMode,
): CmuBuildingPreset {
  return {
    ...preset,
    buildingSystemMode: mode,
    frameSystem: {
      ...preset.frameSystem,
      buildingSystemMode: mode,
    },
  };
}

export function applyCornerColumns(preset: CmuBuildingPreset): CmuBuildingPreset {
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const foundation = resolveFoundationSettings(preset);
  const wallHeightMeters = preset.wallLayout.defaultWallHeightMeters || preset.wall.heightMeters;
  const columns = createCornerColumnsForLayout({
    layout: preset.wallLayout,
    segmentFrames,
    frameSystem: preset.frameSystem,
    wallHeightMeters,
    foundation,
  });
  return {
    ...preset,
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    foundationSettings: foundation,
    frameSystem: {
      ...preset.frameSystem,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      columns,
    },
  };
}

export function applyAutoFrameLayout(preset: CmuBuildingPreset): CmuBuildingPreset {
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const foundation = resolveFoundationSettings(preset);
  const { frameSystem } = autoFrameLayout({
    layout: preset.wallLayout,
    segmentFrames,
    frameSystem: preset.frameSystem,
    foundation,
  });
  const panels = deriveInfillPanelsForLayout({
    layout: preset.wallLayout,
    segmentFrames,
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    wall: preset.wall,
    foundation,
  });
  return {
    ...preset,
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    foundationSettings: foundation,
    frameSystem,
    infillSystem: { ...normalizeCmuInfillSystem(preset.infillSystem), panels },
  };
}

export function applyPerimeterBeams(preset: CmuBuildingPreset): CmuBuildingPreset {
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const foundation = resolveFoundationSettings(preset);
  const wallHeightMeters = preset.wallLayout.defaultWallHeightMeters || preset.wall.heightMeters;
  const columns =
    preset.frameSystem.columns.length > 0
      ? preset.frameSystem.columns
      : createCornerColumnsForLayout({
          layout: preset.wallLayout,
          segmentFrames,
          frameSystem: preset.frameSystem,
          wallHeightMeters,
          foundation,
        });
  const beams = createPerimeterBeamsForLayout({
    layout: preset.wallLayout,
    segmentFrames,
    columns,
    frameSystem: preset.frameSystem,
    foundation,
    wallHeightMeters,
  });
  return {
    ...preset,
    foundationSettings: foundation,
    frameSystem: {
      ...preset.frameSystem,
      columns,
      beams,
    },
  };
}

export function addGableEndToPreset(
  preset: CmuBuildingPreset,
  hostSegmentId: string,
): CmuBuildingPreset {
  const eave = preset.wallLayout.defaultWallHeightMeters || preset.wall.heightMeters;
  const gable = createDefaultGableEnd(hostSegmentId, eave);
  const existing = preset.gableEndSystem.gableEnds.filter((g) => g.hostWallSegmentId !== hostSegmentId);
  return {
    ...preset,
    gableEndSystem: {
      kind: 'gable_end_system',
      gableEnds: [...existing, gable],
    },
  };
}

export function objectSaveKey(objectType: string, parameters?: { kind?: string } | null): string {
  return `${objectType}:${parameters?.kind ?? ''}`;
}

export type FrameFoundationDimensionsApplyPayload = {
  foundation: RcFrameFoundationSettings;
  roofSystem: RoofSystemSettings;
  autoGenerateFrameLayout: boolean;
};

export function previewFrameLayoutCounts(params: {
  preset: CmuBuildingPreset;
  foundation: RcFrameFoundationSettings;
  autoGenerateFrameLayout: boolean;
}): { columnCount: number; frameSegmentCount: number } {
  const foundation = normalizeRcFrameFoundationSettings(params.foundation);
  const wallHeightMeters = resolveEffectiveWallHeightMeters({
    foundation,
    wallHeightMeters: params.preset.wallLayout.defaultWallHeightMeters || params.preset.wall.heightMeters,
  });
  const segmentFrames = getSegmentFramesForWallLayout(params.preset.wallLayout, params.preset.wall);
  const frameSystem =
    params.autoGenerateFrameLayout && params.foundation.columns.placementMode !== 'manual'
      ? {
          ...params.preset.frameSystem,
          columns: [],
          beams: [],
        }
      : params.preset.frameSystem;
  const { frameSystem: resolved } = reconcileStructuralFrameWithFoundation({
    layout: params.preset.wallLayout,
    segmentFrames,
    frameSystem,
    foundation,
    wallHeightMeters,
  });
  return {
    columnCount: resolved.columns.length,
    frameSegmentCount: resolved.beams.length,
  };
}

export function applyFrameFoundationDimensions(
  preset: CmuBuildingPreset,
  payload: FrameFoundationDimensionsApplyPayload,
): CmuBuildingPreset {
  const foundation = normalizeRcFrameFoundationSettings(payload.foundation);
  const roofSystem = normalizeRoofSystemSettings(payload.roofSystem);
  const layoutWallHeight =
    preset.wallLayout.defaultWallHeightMeters || preset.wall.heightMeters;
  const effectiveWallHeight = resolveEffectiveWallHeightMeters({
    foundation,
    wallHeightMeters: layoutWallHeight,
  });
  const syncedLayout = applyProjectMasonryDefaultsToLayout(preset.wallLayout, {
    heightMeters: effectiveWallHeight,
  });
  let next: CmuBuildingPreset = syncPresetFromLayout(
    {
      ...preset,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      foundationSettings: foundation,
      roofSystem,
      truss: {
        ...preset.truss,
        spacingMeters: roofSystem.steelTrusses.maxSpacingMeters,
      },
      wallLayout: syncedLayout,
      wall: { ...preset.wall, heightMeters: effectiveWallHeight },
      frameSystem: {
        ...preset.frameSystem,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      },
    },
    syncedLayout,
  );

  if (payload.autoGenerateFrameLayout) {
    if (payload.foundation.columns.placementMode !== 'manual') {
      next = {
        ...next,
        frameSystem: {
          ...next.frameSystem,
          columns: [],
          beams: [],
        },
      };
    }
    next = applyAutoFrameLayout(next);
    return next;
  }

  const segmentFrames = getSegmentFramesForWallLayout(next.wallLayout, next.wall);
  const wallHeightMeters = resolveEffectiveWallHeightMeters({
    foundation,
    wallHeightMeters: next.wallLayout.defaultWallHeightMeters || next.wall.heightMeters,
  });
  const { frameSystem } = reconcileStructuralFrameWithFoundation({
    layout: next.wallLayout,
    segmentFrames,
    frameSystem: next.frameSystem,
    foundation,
    wallHeightMeters,
  });
  const panels = deriveInfillPanelsForLayout({
    layout: next.wallLayout,
    segmentFrames,
    columns: frameSystem.columns,
    beams: frameSystem.beams,
    wall: next.wall,
    foundation,
  });
  return {
    ...next,
    frameSystem,
    infillSystem: { ...normalizeCmuInfillSystem(next.infillSystem), panels },
  };
}
