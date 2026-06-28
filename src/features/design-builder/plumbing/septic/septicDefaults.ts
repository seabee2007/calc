import type {
  CmuSepticTankConstruction,
  CmuSepticTankGeometry,
  SepticCodeProfileId,
  SepticTankDesignBasis,
} from './septicTypes';

export const SEPTIC_CONCEPTUAL_NOTE =
  'Conceptual septic tank preset. Capacity is based on a 2-bedroom assumed design flow, not final permit engineering. Verify with local septic requirements, public sewer availability, soil/percolation requirements, groundwater, setbacks, and licensed designer/engineer.';

export const SEPTIC_FIXTURE_CONTEXT_GUARDRAIL =
  '2 toilets / 2 sinks is stored as fixture context only; tank capacity uses the selected septic capacity profile.';

export const defaultSmallHouseCmuSepticTankPreset = {
  name: 'Small house CMU septic tank - 750 gal conceptual',
  houseLengthM: 18,
  houseWidthM: 7,
  houseAreaM2: 126,
  toilets: 2,
  sinks: 2,
  bedroomsAssumed: 2,
  designFlowGpd: 480,
  capacityGallons: 750,
  capacityM3: 2.84,
  insideLengthM: 1.8288,
  insideWidthM: 1.2192,
  insideTotalDepthM: 1.8288,
  liquidDepthM: 1.524,
  freeboardM: 0.3048,
  wallThicknessM: 0.2032,
  bottomSlabThicknessM: 0.1016,
  topSlabThicknessM: 0.1016,
  baffleWallThicknessM: 0.2032,
  firstCompartmentRatio: 0.67,
  inletPipeDiameterM: 0.1016,
  outletPipeDiameterM: 0.1016,
  inletInvertAboveOutletM: 0.0762,
  accessOpeningLengthM: 0.4572,
  accessOpeningWidthM: 0.4572,
} as const;

export const DEFAULT_SEPTIC_CONSTRUCTION: CmuSepticTankConstruction = {
  wallMaterial: 'cmu',
  cmuNominalSizeInches: '8x8x16',
  interiorPlasterThicknessM: 0.0127,
  reinforcedBlockSpacingInches: 32,
  concreteMinPsi: 3000,
  topType: 'monolithic_cast_in_place',
  bottomType: 'cast_in_place_slab',
};

export function defaultSepticDesignBasis(
  codeProfileId: SepticCodeProfileId = 'conceptual',
): SepticTankDesignBasis {
  return {
    houseLengthM: defaultSmallHouseCmuSepticTankPreset.houseLengthM,
    houseWidthM: defaultSmallHouseCmuSepticTankPreset.houseWidthM,
    houseAreaM2: defaultSmallHouseCmuSepticTankPreset.houseAreaM2,
    toilets: defaultSmallHouseCmuSepticTankPreset.toilets,
    sinks: defaultSmallHouseCmuSepticTankPreset.sinks,
    bedroomsAssumed: defaultSmallHouseCmuSepticTankPreset.bedroomsAssumed,
    designFlowGpd: defaultSmallHouseCmuSepticTankPreset.designFlowGpd,
    capacityGallons: defaultSmallHouseCmuSepticTankPreset.capacityGallons,
    capacityM3: defaultSmallHouseCmuSepticTankPreset.capacityM3,
    codeProfileId,
    designNote: SEPTIC_CONCEPTUAL_NOTE,
  };
}

export function defaultCmuSepticGeometry(): CmuSepticTankGeometry {
  return {
    insideLengthM: defaultSmallHouseCmuSepticTankPreset.insideLengthM,
    insideWidthM: defaultSmallHouseCmuSepticTankPreset.insideWidthM,
    insideTotalDepthM: defaultSmallHouseCmuSepticTankPreset.insideTotalDepthM,
    liquidDepthM: defaultSmallHouseCmuSepticTankPreset.liquidDepthM,
    freeboardM: defaultSmallHouseCmuSepticTankPreset.freeboardM,
    wallThicknessM: defaultSmallHouseCmuSepticTankPreset.wallThicknessM,
    bottomSlabThicknessM: defaultSmallHouseCmuSepticTankPreset.bottomSlabThicknessM,
    topSlabThicknessM: defaultSmallHouseCmuSepticTankPreset.topSlabThicknessM,
    baffleWallThicknessM: defaultSmallHouseCmuSepticTankPreset.baffleWallThicknessM,
    firstCompartmentRatio: defaultSmallHouseCmuSepticTankPreset.firstCompartmentRatio,
    inletPipeDiameterM: defaultSmallHouseCmuSepticTankPreset.inletPipeDiameterM,
    outletPipeDiameterM: defaultSmallHouseCmuSepticTankPreset.outletPipeDiameterM,
    inletInvertAboveOutletM: defaultSmallHouseCmuSepticTankPreset.inletInvertAboveOutletM,
    accessOpeningLengthM: defaultSmallHouseCmuSepticTankPreset.accessOpeningLengthM,
    accessOpeningWidthM: defaultSmallHouseCmuSepticTankPreset.accessOpeningWidthM,
  };
}

