const DEFAULT_HOURS_PER_DAY = 8;

function normalizePositive(value: number | undefined | null, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function normalizeNonNegative(value: number | undefined | null): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

export interface ResolveScheduleActivityCrewSizeInput {
  crewSize?: number | null;
  laborHours?: number;
  manDays?: number;
  durationDays: number;
  hoursPerDay?: number;
}

export type ScheduleActivityCrewSizeSource = 'saved' | 'fallback' | 'default';

export interface ResolvedScheduleActivityCrewSize {
  crewSize: number;
  source: ScheduleActivityCrewSizeSource;
}

/**
 * Resolve daily crew headcount for schedule/resource calculations.
 * Uses saved crew size when present; never treats man-hours, man-days, or duration as crew size.
 */
export function resolveScheduleActivityCrewSize(
  input: ResolveScheduleActivityCrewSizeInput,
): ResolvedScheduleActivityCrewSize {
  const hoursPerDay = normalizePositive(input.hoursPerDay, DEFAULT_HOURS_PER_DAY);
  const durationDays = Math.max(1, Math.ceil(normalizePositive(input.durationDays, 1)));
  const laborHours = normalizeNonNegative(input.laborHours);
  const manDaysFromHours = laborHours > 0 ? laborHours / hoursPerDay : 0;
  const manDays = normalizeNonNegative(input.manDays) > 0 ? input.manDays! : manDaysFromHours;
  const roundedManDays = manDays > 0 ? Math.max(1, Math.round(manDays)) : 0;

  const saved = input.crewSize;
  const hasSavedCrew = saved != null && Number.isFinite(saved) && saved > 0;

  // Common data issue: total man-days stored in crew_size (e.g. 33 crew on an 11-day job).
  const savedMatchesManDays =
    hasSavedCrew &&
    roundedManDays > 1 &&
    Math.round(saved!) === roundedManDays;

  if (hasSavedCrew && !savedMatchesManDays) {
    return { crewSize: Math.max(1, Math.ceil(saved!)), source: 'saved' };
  }

  if (laborHours > 0) {
    return {
      crewSize: Math.max(1, Math.ceil(laborHours / (durationDays * hoursPerDay))),
      source: 'fallback',
    };
  }

  if (hasSavedCrew) {
    return { crewSize: Math.max(1, Math.ceil(saved!)), source: 'saved' };
  }

  return { crewSize: 1, source: 'default' };
}
