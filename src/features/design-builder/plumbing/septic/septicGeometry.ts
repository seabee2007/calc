import type { SepticTankModel, SepticTankSide } from './septicTypes';

export type SepticPoint2D = { x: number; z: number };

export function septicOuterDimensions(tank: SepticTankModel): { length: number; width: number; height: number } {
  return {
    length: tank.geometry.insideLengthM + tank.geometry.wallThicknessM * 2,
    width: tank.geometry.insideWidthM + tank.geometry.wallThicknessM * 2,
    height:
      tank.geometry.topSlabThicknessM +
      tank.geometry.insideTotalDepthM +
      tank.geometry.bottomSlabThicknessM,
  };
}

export function rotateLocalPoint(
  point: SepticPoint2D,
  rotationRad: number,
): SepticPoint2D {
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  return {
    x: point.x * c - point.z * s,
    z: point.x * s + point.z * c,
  };
}

export function localToWorld(tank: SepticTankModel, point: SepticPoint2D): SepticPoint2D {
  const rotated = rotateLocalPoint(point, tank.placement.rotationRad);
  return {
    x: tank.placement.centerX + rotated.x,
    z: tank.placement.centerZ + rotated.z,
  };
}

export function worldToLocal(tank: SepticTankModel, point: SepticPoint2D): SepticPoint2D {
  return rotateLocalPoint(
    {
      x: point.x - tank.placement.centerX,
      z: point.z - tank.placement.centerZ,
    },
    -tank.placement.rotationRad,
  );
}

export function sideLocalPoint(tank: SepticTankModel, side: SepticTankSide): SepticPoint2D {
  const outer = septicOuterDimensions(tank);
  switch (side) {
    case 'north':
      return { x: -outer.length * 0.42, z: -outer.width / 2 };
    case 'south':
      return { x: outer.length * 0.42, z: outer.width / 2 };
    case 'east':
      return { x: outer.length / 2, z: outer.width * 0.42 };
    case 'west':
    default:
      return { x: -outer.length / 2, z: -outer.width * 0.42 };
  }
}

export function septicTankFootprintPolygon(tank: SepticTankModel): SepticPoint2D[] {
  const outer = septicOuterDimensions(tank);
  const hx = outer.length / 2;
  const hz = outer.width / 2;
  return [
    localToWorld(tank, { x: -hx, z: -hz }),
    localToWorld(tank, { x: hx, z: -hz }),
    localToWorld(tank, { x: hx, z: hz }),
    localToWorld(tank, { x: -hx, z: hz }),
  ];
}

export function pointInsideSepticTankFootprint(tank: SepticTankModel, point: SepticPoint2D): boolean {
  const local = worldToLocal(tank, point);
  const outer = septicOuterDimensions(tank);
  return Math.abs(local.x) <= outer.length / 2 && Math.abs(local.z) <= outer.width / 2;
}

