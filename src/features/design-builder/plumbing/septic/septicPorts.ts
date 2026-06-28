import type { PlumbingPoint3D } from '../plumbingTypes';
import { localToWorld, sideLocalPoint } from './septicGeometry';
import type { SepticTankModel, SepticTankSide } from './septicTypes';

const METERS_PER_INCH = 0.0254;

export type SolvedTankPort = {
  id: 'inlet' | 'outlet';
  tankId: string;
  center: PlumbingPoint3D;
  outwardDirection: PlumbingPoint3D;
  requiredPipeApproachDirection: PlumbingPoint3D;
  diameterInches: number;
};

export function septicTankSideOutwardDirection(
  tank: SepticTankModel,
  side: SepticTankSide,
): { x: number; z: number } {
  const local =
    side === 'west'
      ? { x: -1, z: 0 }
      : side === 'east'
        ? { x: 1, z: 0 }
        : side === 'north'
          ? { x: 0, z: -1 }
          : { x: 0, z: 1 };
  const cos = Math.cos(tank.placement.rotationRad);
  const sin = Math.sin(tank.placement.rotationRad);
  return {
    x: local.x * cos - local.z * sin,
    z: local.x * sin + local.z * cos,
  };
}

export function resolveSepticTankInletPort(tank: SepticTankModel): SolvedTankPort {
  const inlet = localToWorld(tank, sideLocalPoint(tank, tank.inletSide));
  const outward = septicTankSideOutwardDirection(tank, tank.inletSide);
  const diameterInches = tank.geometry.inletPipeDiameterM > 0
    ? tank.geometry.inletPipeDiameterM / METERS_PER_INCH
    : 4;
  return {
    id: 'inlet',
    tankId: tank.id,
    center: {
      x: inlet.x,
      y: tank.placement.topSlabTopElevationM -
        tank.geometry.topSlabThicknessM -
        tank.geometry.freeboardM,
      z: inlet.z,
    },
    outwardDirection: { x: outward.x, y: 0, z: outward.z },
    requiredPipeApproachDirection: { x: -outward.x, y: 0, z: -outward.z },
    diameterInches,
  };
}
