export const IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M = 3.048;

export function ipc2024MinimumDrainageSlopeInPerFt(diameterInches: number | null | undefined): number {
  if (diameterInches != null && Number.isFinite(diameterInches) && diameterInches >= 8) return 1 / 16;
  if (diameterInches != null && Number.isFinite(diameterInches) && diameterInches >= 3) return 1 / 8;
  return 1 / 4;
}

export function slopeInPerFtToMetersPerMeter(slopeInPerFt: number): number {
  return slopeInPerFt / 12;
}

export function minimumDrainageDropMeters(params: {
  diameterInches: number | null | undefined;
  planLengthMeters: number;
}): number {
  return params.planLengthMeters *
    slopeInPerFtToMetersPerMeter(ipc2024MinimumDrainageSlopeInPerFt(params.diameterInches));
}
