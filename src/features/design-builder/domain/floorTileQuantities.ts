/** Approximate yield of modified thinset at 1/2" bed thickness (m³ per 50 lb bag). */
export const THINSET_BAG_COVERAGE_CUBIC_METERS = 0.04;

/** Approximate yield of sanded grout (m³ per 25 lb bag). */
export const GROUT_BAG_COVERAGE_CUBIC_METERS = 0.012;

export type FloorTileQuantityInput = {
  floorAreaSquareMeters: number;
  installedAreaSquareMeters: number;
  fullTileCount: number;
  cutTileCount: number;
  tileWidthMeters: number;
  tileDepthMeters: number;
  groutJointMeters: number;
  thinsetThicknessMeters: number;
  wasteFactor: number;
};

export type FloorTileQuantityResult = {
  orderTileCount: number;
  thinsetVolumeCubicMeters: number;
  thinsetBags: number;
  groutVolumeCubicMeters: number;
  groutBags: number;
};

export function cubicMetersToCubicFeet(value: number): number {
  return value * 35.3146667215;
}

/**
 * Approximate grout joint volume using perimeter joint length across the tiled field.
 * V ≈ installedArea × jointWidth × (1/tileWidth + 1/tileDepth)
 */
export function estimateGroutVolumeCubicMeters(params: {
  installedAreaSquareMeters: number;
  tileWidthMeters: number;
  tileDepthMeters: number;
  groutJointMeters: number;
}): number {
  if (params.groutJointMeters <= 0 || params.installedAreaSquareMeters <= 0) return 0;
  const safeWidth = Math.max(params.tileWidthMeters, 0.01);
  const safeDepth = Math.max(params.tileDepthMeters, 0.01);
  return (
    params.installedAreaSquareMeters *
    params.groutJointMeters *
    (1 / safeWidth + 1 / safeDepth)
  );
}

export function resolveFloorTileQuantities(input: FloorTileQuantityInput): FloorTileQuantityResult {
  const totalTileCount = input.fullTileCount + input.cutTileCount;
  const wasteMultiplier = 1 + Math.max(0, input.wasteFactor);
  const orderTileCount = Math.ceil(totalTileCount * wasteMultiplier);
  const thinsetVolumeCubicMeters =
    input.floorAreaSquareMeters * input.thinsetThicknessMeters * wasteMultiplier;
  const thinsetBags =
    thinsetVolumeCubicMeters > 0
      ? Math.ceil(thinsetVolumeCubicMeters / THINSET_BAG_COVERAGE_CUBIC_METERS)
      : 0;
  const groutVolumeCubicMeters = estimateGroutVolumeCubicMeters({
    installedAreaSquareMeters: input.installedAreaSquareMeters,
    tileWidthMeters: input.tileWidthMeters,
    tileDepthMeters: input.tileDepthMeters,
    groutJointMeters: input.groutJointMeters,
  });
  const groutBags =
    groutVolumeCubicMeters > 0
      ? Math.ceil((groutVolumeCubicMeters * wasteMultiplier) / GROUT_BAG_COVERAGE_CUBIC_METERS)
      : 0;

  return {
    orderTileCount,
    thinsetVolumeCubicMeters,
    thinsetBags,
    groutVolumeCubicMeters,
    groutBags,
  };
}
