import type { CmuCoreGeometry, CmuWallSystemParameters } from '../types';
import { resolveCmuModuleConfig } from './cmuModuleRules';

export type { CmuCoreGeometry };

/** Reasonable default for metric 400 x 200 CMU — not structural-engineering certified. */
export const METRIC_CMU_400X200_CORE: CmuCoreGeometry = {
  coreCount: 2,
  coreLengthMeters: 0.12,
  coreWidthMeters: 0.08,
  coreHeightMeters: 0.19,
  shellThicknessMeters: 0.025,
  webThicknessMeters: 0.05,
};

export function resolveCmuCoreGeometry(
  params: Pick<CmuWallSystemParameters, 'blockModule' | 'blockHeightMeters'>,
): CmuCoreGeometry {
  const module = resolveCmuModuleConfig(params as CmuWallSystemParameters);
  const actualHeight = module.actualHeightMeters ?? Math.max(0.01, module.moduleHeightMeters - module.mortarJointMeters);
  const configured = module.cmuCoreGeometry;
  if (configured) {
    return {
      ...configured,
      coreHeightMeters: configured.coreHeightMeters || actualHeight,
    };
  }
  return {
    ...METRIC_CMU_400X200_CORE,
    coreHeightMeters: actualHeight,
  };
}

export function computeCellCoreVolumeCubicMeters(
  core: CmuCoreGeometry,
  heightMeters = core.coreHeightMeters,
): number {
  const safeHeight = Math.max(0, heightMeters);
  return Math.max(
    0,
    core.coreCount * core.coreLengthMeters * core.coreWidthMeters * safeHeight,
  );
}

export function applyGroutWaste(
  grossVolumeCubicMeters: number,
  wastePercent: number,
): { grossVolumeCubicMeters: number; netVolumeCubicMeters: number; wastePercent: number } {
  const safeGross = Math.max(0, grossVolumeCubicMeters);
  const safeWaste = Math.max(0, wastePercent);
  return {
    grossVolumeCubicMeters: safeGross,
    wastePercent: safeWaste,
    netVolumeCubicMeters: safeGross * (1 + safeWaste / 100),
  };
}
