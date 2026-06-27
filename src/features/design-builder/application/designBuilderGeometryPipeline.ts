import type { CmuBuildingPreset } from '../domain/designBuilderPreset';
import { deriveDesignLayoutBounds, type DesignLayoutBounds } from '../domain/designLayoutBounds';
import { buildDesignRenderModel, type DesignRenderModel } from '../domain/designRenderModel';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  type DesignGeometryInput,
  type DesignGeometryResult,
} from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  MasonryCourseRun,
  PlacedDesignComponent,
  RoofSystemSettings,
} from '../types';

export interface ResolveDesignBuilderGeometryPipelineParams {
  wallLayout: DesignWallLayoutParameters;
  effectiveWall: CmuWallSystemParameters;
  resolvedPreset: CmuBuildingPreset;
  footprintClosed: boolean;
  activeRoofSystem: RoofSystemSettings;
  manualMasonryRuns?: readonly MasonryCourseRun[];
}

export interface DesignBuilderGeometryPipeline {
  designGeometryInput: DesignGeometryInput;
  designGeometryResult: DesignGeometryResult;
  designLayoutBounds: DesignLayoutBounds | null;
}

export function resolveDesignBuilderGeometryPipeline(
  params: ResolveDesignBuilderGeometryPipelineParams,
): DesignBuilderGeometryPipeline {
  const { activeRoofSystem, effectiveWall, footprintClosed, resolvedPreset, wallLayout } = params;
  const designGeometryInput = buildDesignGeometryInputFromLayout({
    wallLayout,
    cmuSettings: effectiveWall,
    openings: effectiveWall.openings,
    slabSettings: footprintClosed
      ? resolvedPreset.slab
      : { ...resolvedPreset.slab, lengthMeters: 0, widthMeters: 0 },
    roofSettings: footprintClosed
      ? resolvedPreset.roof
      : { ...resolvedPreset.roof, lengthMeters: 0, widthMeters: 0 },
    trussSettings: footprintClosed
      ? resolvedPreset.truss
      : { ...resolvedPreset.truss, buildingLengthMeters: 0 },
    buildingSystemMode: resolvedPreset.buildingSystemMode,
    frameSystem: resolvedPreset.frameSystem,
    foundationSettings: resolvedPreset.foundationSettings,
    infillSystem: resolvedPreset.infillSystem,
    gableEndSystem: resolvedPreset.gableEndSystem,
    roofSystem: activeRoofSystem,
  });
  const designGeometryResult = generateDesignGeometry(designGeometryInput);
  const designLayoutBounds = deriveDesignLayoutBounds({
    geometryResult: designGeometryResult,
    wallLayout,
    slab: footprintClosed ? resolvedPreset.slab : null,
    roof: footprintClosed ? resolvedPreset.roof : null,
    truss: footprintClosed ? resolvedPreset.truss : null,
    manualMasonryRuns: params.manualMasonryRuns ?? [],
  });
  return {
    designGeometryInput,
    designGeometryResult,
    designLayoutBounds,
  };
}

export function resolveDesignBuilderRenderModel(params: {
  placedComponents?: readonly PlacedDesignComponent[];
  layoutBounds?: DesignLayoutBounds | null;
}): DesignRenderModel {
  return buildDesignRenderModel({
    placedComponents: params.placedComponents ?? [],
    layoutBounds: params.layoutBounds ?? null,
  });
}
