import type { CmuBuildingPreset } from './designBuilderPreset';
import type { DesignWallLayoutParameters } from '../types';
import {
  autoFrameLayout,
  createCornerColumnsForLayout,
  createPerimeterBeamsForLayout,
} from './structuralFrameLayout';
import { createDefaultFoundationSettings } from './foundationElevations';
import { deriveInfillPanelsForLayout } from './cmuInfillPanelSolver';
import { createDefaultGableEnd } from '../geometry/structuralFrameGeometry';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import type { BuildingSystemMode, StructuralFoundationSettings } from '../types';

export function resolveFoundationSettings(preset: CmuBuildingPreset): StructuralFoundationSettings {
  return preset.foundationSettings ?? createDefaultFoundationSettings();
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
  });
  return {
    ...preset,
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    foundationSettings: foundation,
    frameSystem,
    infillSystem: { kind: 'cmu_infill_system', panels },
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
