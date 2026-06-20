import type {
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  GableRoofSystemParameters,
  RectangleFootprintParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  UpsertDesignModelObjectInput,
  WallOpeningParameters,
} from '../types';
import { METRIC_CMU_400X200_MODULE } from './cmuModuleRules';
import { createBlankWallLayout, createOutsideFaceRectangleLayout } from './wallLayoutRules';

export const DESIGN_BUILDER_EXAMPLE_MODEL_ID = '11111111-1111-4111-8111-111111111111';
export const DESIGN_BUILDER_EXAMPLE_FOOTPRINT_OBJECT_ID = '22222222-2222-4222-8222-222222222222';
export const DESIGN_BUILDER_EXAMPLE_SLAB_OBJECT_ID = '33333333-3333-4333-8333-333333333333';
export const DESIGN_BUILDER_EXAMPLE_WALL_OBJECT_ID = '44444444-4444-4444-8444-444444444444';
export const DESIGN_BUILDER_EXAMPLE_ROOF_OBJECT_ID = '55555555-5555-4555-8555-555555555555';
export const DESIGN_BUILDER_EXAMPLE_TRUSS_OBJECT_ID = '66666666-6666-4666-8666-666666666666';

export const DESIGN_BUILDER_EXAMPLE_LAYOUT_OBJECT_ID = '77777777-7777-4777-8777-777777777777';

export interface CmuBuildingPreset {
  name: string;
  wallLayout: DesignWallLayoutParameters;
  footprint: RectangleFootprintParameters;
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
}

export function createFiveBySixCmuBuildingPreset(): CmuBuildingPreset {
  const lengthMeters = 6;
  const widthMeters = 5;
  const wallLayout = createOutsideFaceRectangleLayout({
    lengthMeters,
    widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.19,
  });
  const southSegment = wallLayout.segments[0]?.id;
  const eastSegment = wallLayout.segments[1]?.id;
  const openings: WallOpeningParameters[] = [
    {
      id: 'door-west-01',
      type: 'door',
      wallSegmentId: southSegment,
      positionAlongSegment: 2.4,
      wallFace: 'south',
      offsetMeters: 2.4,
      widthMeters: 0.9,
      heightMeters: 2.1,
      roughOpeningAllowanceMeters: 0.05,
      lintelType: 'bond_beam',
      lintelBearingMeters: 0.2,
      lintelCourseCount: 1,
      jambGroutEnabled: true,
      jambRebarEnabled: true,
      groutCellsEachSide: 1,
      openingFrameMaterial: 'hollow_metal',
    },
    {
      id: 'window-east-01',
      type: 'window',
      wallSegmentId: eastSegment,
      positionAlongSegment: 2.1,
      wallFace: 'east',
      offsetMeters: 2.1,
      widthMeters: 1.2,
      heightMeters: 0.9,
      sillHeightMeters: 1,
      roughOpeningAllowanceMeters: 0.05,
      lintelType: 'bond_beam',
      lintelBearingMeters: 0.2,
      lintelCourseCount: 1,
      jambGroutEnabled: true,
      jambRebarEnabled: true,
      groutCellsEachSide: 1,
      groutCellsBelowWindow: 1,
      openingFrameMaterial: 'vinyl',
    },
  ];
  return {
    name: '5m x 6m CMU Building Example',
    wallLayout,
    footprint: {
      kind: 'rectangle',
      lengthMeters,
      widthMeters,
    },
    slab: {
      kind: 'thickened_edge_slab',
      lengthMeters,
      widthMeters,
      slabThicknessMeters: 0.125,
      edgeWidthMeters: 0.45,
      edgeDepthMeters: 0.35,
      edgeMode: 'adds_below_slab',
    },
    wall: {
      kind: 'cmu_wall_system',
      lengthMeters,
      widthMeters,
      heightMeters: 2.8,
      wallThicknessMeters: 0.19,
      blockLengthMeters: 0.4,
      blockHeightMeters: 0.2,
      blockDepthMeters: 0.19,
      mortarJointMeters: 0.01,
      blockModule: METRIC_CMU_400X200_MODULE,
      snapToModule: true,
      bondPattern: 'running_bond',
      cornerCondition: 'interlocked',
      endCondition: 'return_corner',
      lintelType: 'bond_beam',
      lintelBearingMeters: 0.2,
      lintelCourseCount: 1,
      bondBeamEnabled: true,
      lintelBondBeamEnabled: true,
      coreFillFactor: 0.5,
      groutWastePercent: 0.1,
      jambCellsEachSide: 1,
      verticalReinforcementSpacingMeters: 1.2,
      groutedCellSpacingMeters: 1.2,
      pilasterEnabled: true,
      wasteFactor: 0.05,
      showIndividualBlocks: true,
      openings,
    },
    roof: {
      kind: 'gable_roof_system',
      lengthMeters,
      widthMeters,
      pitchRisePerRun: 0.25,
      overhangMeters: 0.3,
      ridgeDirection: 'length',
    },
    truss: {
      kind: 'steel_truss_system',
      buildingLengthMeters: lengthMeters,
      spacingMeters: 0.6,
    },
  };
}

export function createBlankCmuBuildingPreset(
  defaults: Partial<Pick<CmuBuildingPreset, 'wall' | 'slab' | 'roof' | 'truss'>> = {},
): CmuBuildingPreset {
  const source = createFiveBySixCmuBuildingPreset();
  const wallHeightMeters = defaults.wall?.heightMeters ?? source.wall.heightMeters;
  const wallThicknessMeters = defaults.wall?.wallThicknessMeters ?? source.wall.wallThicknessMeters;
  const wallLayout = createBlankWallLayout({
    defaultWallHeightMeters: wallHeightMeters,
    defaultWallThicknessMeters: wallThicknessMeters,
    dimensionBasis: 'outside_face',
  });
  return {
    name: 'Blank CMU Layout',
    wallLayout,
    footprint: {
      kind: 'rectangle',
      lengthMeters: 0,
      widthMeters: 0,
    },
    slab: {
      ...source.slab,
      ...defaults.slab,
      lengthMeters: 0,
      widthMeters: 0,
    },
    wall: {
      ...source.wall,
      ...defaults.wall,
      lengthMeters: 0,
      widthMeters: 0,
      heightMeters: wallHeightMeters,
      wallThicknessMeters,
      openings: [],
    },
    roof: {
      ...source.roof,
      ...defaults.roof,
      lengthMeters: 0,
      widthMeters: 0,
    },
    truss: {
      ...source.truss,
      ...defaults.truss,
      buildingLengthMeters: 0,
    },
  };
}

export function buildPresetObjects(params: {
  designModelId: string;
  projectId: string;
  preset?: CmuBuildingPreset;
  includeStableIds?: boolean;
}): UpsertDesignModelObjectInput[] {
  const preset = params.preset ?? createFiveBySixCmuBuildingPreset();
  const withId = (id: string) => (params.includeStableIds === false ? {} : { id });
  return [
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_FOOTPRINT_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'building_footprint',
      name: 'Rectangle Footprint',
      parameters: preset.footprint,
    },
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_LAYOUT_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'building_footprint',
      name: 'Wall Layout',
      parameters: preset.wallLayout,
    },
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_SLAB_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'thickened_edge_slab',
      name: 'Thickened Edge Slab',
      parameters: preset.slab,
    },
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_WALL_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'cmu_wall_system',
      name: 'CMU Wall System',
      parameters: preset.wall,
    },
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_ROOF_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'gable_roof_system',
      name: 'Gable Roof System',
      parameters: preset.roof,
    },
    {
      ...withId(DESIGN_BUILDER_EXAMPLE_TRUSS_OBJECT_ID),
      designModelId: params.designModelId,
      projectId: params.projectId,
      objectType: 'steel_truss_system',
      name: 'Steel Truss System',
      parameters: preset.truss,
    },
  ];
}
