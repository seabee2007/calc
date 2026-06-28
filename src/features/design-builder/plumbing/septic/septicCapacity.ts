import type { CmuSepticTankGeometry, SepticTankModel } from './septicTypes';

export const GALLONS_PER_CUBIC_METER = 264.172052;

export type SepticCapacityResult = {
  liquidVolumeM3: number;
  liquidVolumeGallons: number;
  targetCapacityGallons: number;
  mismatchRatio: number;
  mismatchWarning: boolean;
};

export function calculateSepticCapacity(
  tankOrGeometry: SepticTankModel | CmuSepticTankGeometry,
  targetCapacityGallons = 'designBasis' in tankOrGeometry ? tankOrGeometry.designBasis.capacityGallons : 0,
): SepticCapacityResult {
  const geometry = 'geometry' in tankOrGeometry ? tankOrGeometry.geometry : tankOrGeometry;
  const liquidVolumeM3 = geometry.insideLengthM * geometry.insideWidthM * geometry.liquidDepthM;
  const liquidVolumeGallons = liquidVolumeM3 * GALLONS_PER_CUBIC_METER;
  const mismatchRatio =
    targetCapacityGallons > 0 ? Math.abs(liquidVolumeGallons - targetCapacityGallons) / targetCapacityGallons : 0;
  return {
    liquidVolumeM3,
    liquidVolumeGallons,
    targetCapacityGallons,
    mismatchRatio,
    mismatchWarning: mismatchRatio > 0.1,
  };
}

