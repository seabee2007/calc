export type SepticCodeProfileId =
  | 'conceptual'
  | 'guam_22_gar_ch12'
  | 'custom';

export type SepticTankKind = 'cmu_septic_tank';

export type SepticTankSide = 'north' | 'east' | 'south' | 'west';

export type SepticTankPlacement = {
  centerX: number;
  centerZ: number;
  rotationRad: number;
  gradeElevationM: number;
  topSlabTopElevationM: number;
  burialDepthBelowGradeM: number;
};

export type SepticTankDesignBasis = {
  houseLengthM: number;
  houseWidthM: number;
  houseAreaM2: number;
  toilets: number;
  sinks: number;
  bedroomsAssumed: number;
  designFlowGpd: number;
  capacityGallons: number;
  capacityM3: number;
  codeProfileId: SepticCodeProfileId;
  designNote: string;
};

export type CmuSepticTankGeometry = {
  insideLengthM: number;
  insideWidthM: number;
  insideTotalDepthM: number;
  liquidDepthM: number;
  freeboardM: number;
  wallThicknessM: number;
  bottomSlabThicknessM: number;
  topSlabThicknessM: number;
  baffleWallThicknessM: number;
  firstCompartmentRatio: number;
  inletPipeDiameterM: number;
  outletPipeDiameterM: number;
  inletInvertAboveOutletM: number;
  accessOpeningLengthM: number;
  accessOpeningWidthM: number;
};

export type CmuSepticTankConstruction = {
  wallMaterial: 'cmu';
  cmuNominalSizeInches: '8x8x16';
  interiorPlasterThicknessM: number;
  reinforcedBlockSpacingInches: number;
  concreteMinPsi: number;
  topType: 'monolithic_cast_in_place';
  bottomType: 'cast_in_place_slab';
};

export type SepticTankConnectionNodes = {
  inletNodeId: string;
  outletNodeId: string;
  cleanoutNodeIds: string[];
};

export type SepticTankModel = {
  id: string;
  kind: SepticTankKind;
  name: string;
  mark: string;
  placement: SepticTankPlacement;
  designBasis: SepticTankDesignBasis;
  geometry: CmuSepticTankGeometry;
  construction: CmuSepticTankConstruction;
  connectionNodes: SepticTankConnectionNodes;
  inletSide: SepticTankSide;
  outletSide: SepticTankSide;
  labelVisible: boolean;
  showCutaway3d: boolean;
  createdAt: string;
  updatedAt: string;
};

