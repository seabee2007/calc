import { pointInsideSepticTankFootprint } from '../septicGeometry';
import type { SepticPoint2D } from '../septicGeometry';
import type { SepticTankModel } from '../septicTypes';

export function hitTestSepticTank(
  point: SepticPoint2D,
  tanks: readonly SepticTankModel[],
): SepticTankModel | null {
  for (let index = tanks.length - 1; index >= 0; index -= 1) {
    if (pointInsideSepticTankFootprint(tanks[index], point)) return tanks[index];
  }
  return null;
}

