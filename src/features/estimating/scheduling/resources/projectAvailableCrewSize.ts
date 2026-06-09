export const DEFAULT_PROJECT_CREW_SIZE = 10;

export function resolveProjectAvailableCrewSize(input: {
  projectCrewSize?: number | null;
  legacyAvailableCrewSize?: number | null;
}): number {
  if (
    input.projectCrewSize != null &&
    Number.isFinite(input.projectCrewSize) &&
    input.projectCrewSize > 0
  ) {
    return Math.round(input.projectCrewSize);
  }
  if (
    input.legacyAvailableCrewSize != null &&
    Number.isFinite(input.legacyAvailableCrewSize) &&
    input.legacyAvailableCrewSize > 0
  ) {
    return Math.round(input.legacyAvailableCrewSize);
  }
  return DEFAULT_PROJECT_CREW_SIZE;
}
