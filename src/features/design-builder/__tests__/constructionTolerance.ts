export const CONSTRUCTION_TOLERANCE_INCHES = 0.01;
export const CONSTRUCTION_TOLERANCE_METERS = CONSTRUCTION_TOLERANCE_INCHES * 0.0254;

export function roundToConstructionToleranceMeters(valueMeters: number): number {
  return Math.round(valueMeters / CONSTRUCTION_TOLERANCE_METERS) * CONSTRUCTION_TOLERANCE_METERS;
}
