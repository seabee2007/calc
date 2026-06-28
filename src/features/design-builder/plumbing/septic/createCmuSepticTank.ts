import type { PlumbingNode, PlumbingSystem } from '../plumbingTypes';
import {
  DEFAULT_SEPTIC_CONSTRUCTION,
  defaultCmuSepticGeometry,
  defaultSepticDesignBasis,
  defaultSmallHouseCmuSepticTankPreset,
} from './septicDefaults';
import { localToWorld, sideLocalPoint } from './septicGeometry';
import type { SepticCodeProfileId, SepticTankModel, SepticTankSide } from './septicTypes';

function createId(prefix: string, seed?: string): string {
  return `${prefix}-${seed ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextSepticMark(tanks: readonly SepticTankModel[]): string {
  const used = tanks
    .map((tank) => Number(tank.mark.replace(/^ST-/, '')))
    .filter((value) => Number.isFinite(value));
  return `ST-${used.length > 0 ? Math.max(...used) + 1 : 1}`;
}

export function createCmuSepticTank(params: {
  system?: PlumbingSystem;
  centerX: number;
  centerZ: number;
  rotationRad?: number;
  codeProfileId?: SepticCodeProfileId;
  inletSide?: SepticTankSide;
  outletSide?: SepticTankSide;
  idSeed?: string;
  now?: string;
}): SepticTankModel {
  const now = params.now ?? new Date().toISOString();
  const tankId = createId('cmu-septic-tank', params.idSeed);
  return {
    id: tankId,
    kind: 'cmu_septic_tank',
    name: defaultSmallHouseCmuSepticTankPreset.name,
    mark: nextSepticMark(params.system?.septicTanks ?? []),
    placement: {
      centerX: params.centerX,
      centerZ: params.centerZ,
      rotationRad: params.rotationRad ?? 0,
      gradeElevationM: 0,
      burialDepthBelowGradeM: 0.3,
      topSlabTopElevationM: -0.3,
    },
    designBasis: defaultSepticDesignBasis(params.codeProfileId ?? 'conceptual'),
    geometry: defaultCmuSepticGeometry(),
    construction: { ...DEFAULT_SEPTIC_CONSTRUCTION },
    connectionNodes: {
      inletNodeId: `${tankId}-inlet-node`,
      outletNodeId: `${tankId}-outlet-node`,
      cleanoutNodeIds: [`${tankId}-access-node-1`, `${tankId}-access-node-2`],
    },
    inletSide: params.inletSide ?? 'west',
    outletSide: params.outletSide ?? 'east',
    labelVisible: true,
    showCutaway3d: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCmuSepticTankNodes(tank: SepticTankModel): PlumbingNode[] {
  const inlet = localToWorld(tank, sideLocalPoint(tank, tank.inletSide));
  const outlet = localToWorld(tank, sideLocalPoint(tank, tank.outletSide));
  const firstAccess = localToWorld(tank, {
    x: -tank.geometry.insideLengthM * 0.18,
    z: 0,
  });
  const secondAccess = localToWorld(tank, {
    x: tank.geometry.insideLengthM * 0.28,
    z: 0,
  });
  return [
    {
      id: tank.connectionNodes.inletNodeId,
      kind: 'septic_inlet',
      system: 'sanitary',
      position: { x: inlet.x, y: tank.placement.topSlabTopElevationM, z: inlet.z },
      septicTankId: tank.id,
      label: 'Septic inlet',
    },
    {
      id: tank.connectionNodes.outletNodeId,
      kind: 'septic_outlet',
      system: 'sanitary',
      position: { x: outlet.x, y: tank.placement.topSlabTopElevationM, z: outlet.z },
      septicTankId: tank.id,
      label: 'Future leach field outlet',
    },
    {
      id: tank.connectionNodes.cleanoutNodeIds[0],
      kind: 'septic_access',
      system: 'sanitary',
      position: { x: firstAccess.x, y: tank.placement.topSlabTopElevationM, z: firstAccess.z },
      septicTankId: tank.id,
      label: 'Access opening 1',
    },
    {
      id: tank.connectionNodes.cleanoutNodeIds[1],
      kind: 'septic_access',
      system: 'sanitary',
      position: { x: secondAccess.x, y: tank.placement.topSlabTopElevationM, z: secondAccess.z },
      septicTankId: tank.id,
      label: 'Access opening 2',
    },
  ];
}

export function addCmuSepticTankToPlumbingSystem(params: {
  system: PlumbingSystem;
  centerX: number;
  centerZ: number;
  rotationRad?: number;
  idSeed?: string;
}): { system: PlumbingSystem; tank: SepticTankModel } {
  const tank = createCmuSepticTank({ ...params, system: params.system });
  const nodes = createCmuSepticTankNodes(tank);
  return {
    tank,
    system: {
      ...params.system,
      septicTanks: [...params.system.septicTanks, tank],
      nodes: [...params.system.nodes, ...nodes],
    },
  };
}

