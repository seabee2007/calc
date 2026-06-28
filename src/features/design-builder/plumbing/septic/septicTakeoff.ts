import type { SepticTankModel } from './septicTypes';

export type SepticTakeoff = {
  tankId: string;
  cmuWallAreaM2: number;
  estimated8InCmuBlockCount: number;
  bottomSlabConcreteVolumeM3: number;
  topSlabConcreteVolumeM3: number;
  baffleWallCmuBlockCount: number;
  interiorPlasterAreaM2: number;
  accessCoverCount: number;
  inletOutletPipeStubCount: number;
};

function round(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function generateSepticTakeoff(tank: SepticTankModel): SepticTakeoff {
  const g = tank.geometry;
  const outerLength = g.insideLengthM + g.wallThicknessM * 2;
  const outerWidth = g.insideWidthM + g.wallThicknessM * 2;
  const wallHeight = g.insideTotalDepthM;
  const exteriorWallArea = 2 * (outerLength + outerWidth) * wallHeight;
  const baffleArea = g.insideWidthM * wallHeight;
  const nominalBlockFaceAreaM2 = 0.4064 * 0.2032;
  return {
    tankId: tank.id,
    cmuWallAreaM2: round(exteriorWallArea),
    estimated8InCmuBlockCount: Math.ceil(exteriorWallArea / nominalBlockFaceAreaM2),
    bottomSlabConcreteVolumeM3: round(outerLength * outerWidth * g.bottomSlabThicknessM),
    topSlabConcreteVolumeM3: round(outerLength * outerWidth * g.topSlabThicknessM),
    baffleWallCmuBlockCount: Math.ceil(baffleArea / nominalBlockFaceAreaM2),
    interiorPlasterAreaM2: round(2 * (g.insideLengthM + g.insideWidthM) * wallHeight + baffleArea * 2),
    accessCoverCount: tank.connectionNodes.cleanoutNodeIds.length,
    inletOutletPipeStubCount: 2,
  };
}

