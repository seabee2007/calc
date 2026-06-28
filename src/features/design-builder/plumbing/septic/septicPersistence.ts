import {
  DEFAULT_SEPTIC_CONSTRUCTION,
  defaultCmuSepticGeometry,
  defaultSepticDesignBasis,
} from './septicDefaults';
import type { SepticCodeProfileId, SepticTankModel, SepticTankSide } from './septicTypes';

const SEPTIC_CODE_PROFILE_IDS: SepticCodeProfileId[] = ['conceptual', 'guam_22_gar_ch12', 'custom'];
const SEPTIC_SIDES: SepticTankSide[] = ['north', 'east', 'south', 'west'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function profileOr(value: unknown): SepticCodeProfileId {
  return SEPTIC_CODE_PROFILE_IDS.includes(value as SepticCodeProfileId)
    ? value as SepticCodeProfileId
    : 'conceptual';
}

function sideOr(value: unknown, fallback: SepticTankSide): SepticTankSide {
  return SEPTIC_SIDES.includes(value as SepticTankSide) ? value as SepticTankSide : fallback;
}

export function normalizeSepticTank(raw: unknown): SepticTankModel | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.length === 0) return null;
  const fallbackGeometry = defaultCmuSepticGeometry();
  const rawPlacement = isRecord(raw.placement) ? raw.placement : {};
  const rawDesignBasis = isRecord(raw.designBasis) ? raw.designBasis : {};
  const rawGeometry = isRecord(raw.geometry) ? raw.geometry : {};
  const rawConstruction = isRecord(raw.construction) ? raw.construction : {};
  const rawConnectionNodes = isRecord(raw.connectionNodes) ? raw.connectionNodes : {};
  const cleanoutNodeIds = Array.isArray(rawConnectionNodes.cleanoutNodeIds)
    ? rawConnectionNodes.cleanoutNodeIds.filter((id): id is string => typeof id === 'string')
    : [`${raw.id}-access-node-1`, `${raw.id}-access-node-2`];
  const codeProfileId = profileOr(rawDesignBasis.codeProfileId);
  const gradeElevationM = numberOr(rawPlacement.gradeElevationM, 0);
  const burialDepthBelowGradeM = numberOr(rawPlacement.burialDepthBelowGradeM, 0.3);
  return {
    id: raw.id,
    kind: 'cmu_septic_tank',
    name: stringOr(raw.name, 'CMU Septic Tank'),
    mark: stringOr(raw.mark, 'ST-1'),
    placement: {
      centerX: numberOr(rawPlacement.centerX, 0),
      centerZ: numberOr(rawPlacement.centerZ, 0),
      rotationRad: numberOr(rawPlacement.rotationRad, 0),
      gradeElevationM,
      burialDepthBelowGradeM,
      topSlabTopElevationM: numberOr(rawPlacement.topSlabTopElevationM, gradeElevationM - burialDepthBelowGradeM),
    },
    designBasis: {
      ...defaultSepticDesignBasis(codeProfileId),
      houseLengthM: numberOr(rawDesignBasis.houseLengthM, 18),
      houseWidthM: numberOr(rawDesignBasis.houseWidthM, 7),
      houseAreaM2: numberOr(rawDesignBasis.houseAreaM2, 126),
      toilets: numberOr(rawDesignBasis.toilets, 2),
      sinks: numberOr(rawDesignBasis.sinks, 2),
      bedroomsAssumed: numberOr(rawDesignBasis.bedroomsAssumed, 2),
      designFlowGpd: numberOr(rawDesignBasis.designFlowGpd, 480),
      capacityGallons: numberOr(rawDesignBasis.capacityGallons, 750),
      capacityM3: numberOr(rawDesignBasis.capacityM3, 2.84),
      codeProfileId,
      designNote: stringOr(rawDesignBasis.designNote, defaultSepticDesignBasis(codeProfileId).designNote),
    },
    geometry: {
      ...fallbackGeometry,
      insideLengthM: numberOr(rawGeometry.insideLengthM, fallbackGeometry.insideLengthM),
      insideWidthM: numberOr(rawGeometry.insideWidthM, fallbackGeometry.insideWidthM),
      insideTotalDepthM: numberOr(rawGeometry.insideTotalDepthM, fallbackGeometry.insideTotalDepthM),
      liquidDepthM: numberOr(rawGeometry.liquidDepthM, fallbackGeometry.liquidDepthM),
      freeboardM: numberOr(rawGeometry.freeboardM, fallbackGeometry.freeboardM),
      wallThicknessM: numberOr(rawGeometry.wallThicknessM, fallbackGeometry.wallThicknessM),
      bottomSlabThicknessM: numberOr(rawGeometry.bottomSlabThicknessM, fallbackGeometry.bottomSlabThicknessM),
      topSlabThicknessM: numberOr(rawGeometry.topSlabThicknessM, fallbackGeometry.topSlabThicknessM),
      baffleWallThicknessM: numberOr(rawGeometry.baffleWallThicknessM, fallbackGeometry.baffleWallThicknessM),
      firstCompartmentRatio: numberOr(rawGeometry.firstCompartmentRatio, fallbackGeometry.firstCompartmentRatio),
      inletPipeDiameterM: numberOr(rawGeometry.inletPipeDiameterM, fallbackGeometry.inletPipeDiameterM),
      outletPipeDiameterM: numberOr(rawGeometry.outletPipeDiameterM, fallbackGeometry.outletPipeDiameterM),
      inletInvertAboveOutletM: numberOr(rawGeometry.inletInvertAboveOutletM, fallbackGeometry.inletInvertAboveOutletM),
      accessOpeningLengthM: numberOr(rawGeometry.accessOpeningLengthM, fallbackGeometry.accessOpeningLengthM),
      accessOpeningWidthM: numberOr(rawGeometry.accessOpeningWidthM, fallbackGeometry.accessOpeningWidthM),
    },
    construction: {
      ...DEFAULT_SEPTIC_CONSTRUCTION,
      ...rawConstruction,
      wallMaterial: 'cmu',
      cmuNominalSizeInches: '8x8x16',
      topType: 'monolithic_cast_in_place',
      bottomType: 'cast_in_place_slab',
    },
    connectionNodes: {
      inletNodeId: stringOr(rawConnectionNodes.inletNodeId, `${raw.id}-inlet-node`),
      outletNodeId: stringOr(rawConnectionNodes.outletNodeId, `${raw.id}-outlet-node`),
      cleanoutNodeIds,
    },
    inletSide: sideOr(raw.inletSide, 'west'),
    outletSide: sideOr(raw.outletSide, 'east'),
    labelVisible: typeof raw.labelVisible === 'boolean' ? raw.labelVisible : true,
    showCutaway3d: typeof raw.showCutaway3d === 'boolean' ? raw.showCutaway3d : true,
    createdAt: stringOr(raw.createdAt, new Date().toISOString()),
    updatedAt: stringOr(raw.updatedAt, new Date().toISOString()),
  };
}

export function normalizeSepticTanks(raw: unknown): SepticTankModel[] {
  return Array.isArray(raw)
    ? raw.map(normalizeSepticTank).filter((tank): tank is SepticTankModel => Boolean(tank))
    : [];
}

