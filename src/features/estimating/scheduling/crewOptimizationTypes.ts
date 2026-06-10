/**
 * Crew optimization / schedule compression (crashing, crew acceleration).
 *
 * NOT implemented yet — separate from resource leveling, which only shifts
 * activities within float without changing crew size or duration.
 *
 * Future "Optimize Crew Plan" would increase crew on compressible activities to
 * shorten durations when spare crew capacity exists (subject to productivity
 * limits, minimum duration, and non-compressible waits such as curing).
 */
export interface ScheduleActivityCrewCompressionPolicy {
  /** When false, spare crew cannot shorten this activity (curing, inspections, etc.). */
  canCompressWithCrew: boolean;
  /** Floor duration even if crew is increased. */
  minimumDurationDays?: number;
  /** Upper bound for useful crew on this activity. */
  maximumCrewSize?: number;
  /** Diminishing returns when adding crew (1 = linear, >1 = less benefit per added worker). */
  productivityLossFactor?: number;
  /** User-facing note (e.g. "Concrete cure time — duration fixed"). */
  compressionNotes?: string;
}

/** Planned future action label — do not wire until crew optimization is implemented. */
export const CREW_OPTIMIZATION_BUTTON_LABEL = 'Optimize Crew Plan';

/**
 * Duration compression from added crew (future):
 *   ceil(totalManHours / (crewSize × hoursPerDay))
 * subject to minimumDurationDays, maximumCrewSize, and canCompressWithCrew.
 */
export interface CrewOptimizationPreviewSuggestion {
  activityCode: string;
  currentCrewSize: number;
  suggestedCrewSize: number;
  currentDurationDays: number;
  suggestedDurationDays: number;
  unusedAvailableCrew: number;
  notes?: string;
}
