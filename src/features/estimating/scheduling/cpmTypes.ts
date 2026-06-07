export type CpmRelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

export interface CpmLogicLink {
  predecessorActivityCode: string;
  successorActivityCode: string;
  relationshipType: CpmRelationshipType;
  lagDays: number;
  /**
   * Stable runtime ids for the endpoints. When present these are the authoritative
   * identity (so repeated activity codes stay uniquely linkable); the activityCode
   * fields remain for display and legacy/back-compat link matching.
   */
  predecessorRuntimeId?: string;
  successorRuntimeId?: string;
}

export interface CpmActivityResult {
  activityCode: string;
  /** Day-number offset from project day 0 (inclusive start). */
  earlyStart: number;
  /** Day-number offset — exclusive finish (ES + duration). */
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export type LogicNetworkViewMode = 'logic-network' | 'precedence-diagram';

export type ScheduleWorkflowStatus =
  | 'logic-network-draft'
  | 'logic-ready'
  | 'precedence-ready'
  | 'cpm-calculated'
  | 'missing-logic'
  | 'invalid-circular'
  | 'invalid-disconnected'
  | 'invalid-missing-references'
  | 'invalid-open-ended'
  | 'over-constrained';

export type CriticalPathStatus =
  | 'valid'
  | 'missing-logic'
  | 'disconnected'
  | 'circular'
  | 'over-constrained'
  | 'open-start'
  | 'open-finish'
  | 'not-run';

export interface CpmResult {
  activities: CpmActivityResult[];
  projectDurationDays: number;
  /** Math-based zero-float codes — not used for display styling. */
  criticalPathActivityCodes: string[];
  warnings: string[];
  hardErrors: string[];
  criticalPathStatus: CriticalPathStatus;
  hasRunCpm: boolean;
  hasValidPrecedenceDiagram: boolean;
  hasValidCriticalPath: boolean;
  criticalPathContinuityWarnings: string[];
  /** Display-critical codes — alias: validCriticalPathActivityCodes */
  displayCriticalActivityCodes: string[];
  validCriticalPathActivityCodes: string[];
  openStartActivityCodes: string[];
  openFinishActivityCodes: string[];
}

export function buildValidCpmDisplayFields(
  displayCriticalActivityCodes: string[],
  overrides: Partial<
    Pick<
      CpmResult,
      | 'criticalPathStatus'
      | 'hasValidCriticalPath'
      | 'criticalPathContinuityWarnings'
      | 'openStartActivityCodes'
      | 'openFinishActivityCodes'
      | 'hasRunCpm'
      | 'hasValidPrecedenceDiagram'
      | 'hardErrors'
    >
  > = {},
): Pick<
  CpmResult,
  | 'criticalPathStatus'
  | 'hasValidCriticalPath'
  | 'criticalPathContinuityWarnings'
  | 'displayCriticalActivityCodes'
  | 'validCriticalPathActivityCodes'
  | 'openStartActivityCodes'
  | 'openFinishActivityCodes'
  | 'hasRunCpm'
  | 'hasValidPrecedenceDiagram'
  | 'hardErrors'
> {
  return {
    criticalPathStatus: 'valid',
    hasValidCriticalPath: true,
    criticalPathContinuityWarnings: [],
    displayCriticalActivityCodes,
    validCriticalPathActivityCodes: displayCriticalActivityCodes,
    openStartActivityCodes: [],
    openFinishActivityCodes: [],
    hasRunCpm: false,
    hasValidPrecedenceDiagram: false,
    hardErrors: [],
    ...overrides,
  };
}

export const EMPTY_CPM_DISPLAY_CRITICAL: Pick<
  CpmResult,
  | 'criticalPathStatus'
  | 'hasValidCriticalPath'
  | 'criticalPathContinuityWarnings'
  | 'displayCriticalActivityCodes'
  | 'validCriticalPathActivityCodes'
  | 'openStartActivityCodes'
  | 'openFinishActivityCodes'
  | 'hasRunCpm'
  | 'hasValidPrecedenceDiagram'
  | 'hardErrors'
> = {
  criticalPathStatus: 'missing-logic',
  hasValidCriticalPath: false,
  criticalPathContinuityWarnings: [],
  displayCriticalActivityCodes: [],
  validCriticalPathActivityCodes: [],
  openStartActivityCodes: [],
  openFinishActivityCodes: [],
  hasRunCpm: false,
  hasValidPrecedenceDiagram: false,
  hardErrors: [],
};

export function attachCpmWorkflowFields(
  result: Omit<
    CpmResult,
    'hasRunCpm' | 'hasValidPrecedenceDiagram' | 'validCriticalPathActivityCodes' | 'hardErrors'
  >,
  options: { hasRunCpm: boolean; hardErrors?: string[] },
): CpmResult {
  const hardErrors = options.hardErrors ?? [];
  return {
    ...result,
    hasRunCpm: options.hasRunCpm,
    hasValidPrecedenceDiagram: options.hasRunCpm && hardErrors.length === 0,
    validCriticalPathActivityCodes: result.displayCriticalActivityCodes,
    hardErrors,
  };
}

export interface ScheduleSettings {
  projectStartDate: string;
  hoursPerDay: number;
  availableCrewSize: number;
  includeWeekends: boolean;
}

export interface LogicNetworkLayout {
  activityCode: string;
  x: number;
  y: number;
}

export interface ResourceHistogramDay {
  dayOffset: number;
  date: string;
  requiredCrew: number;
  availableCrew: number;
  isOverallocated: boolean;
}

export interface MovedActivity {
  activityCode: string;
  oldStart: number;
  newStart: number;
  daysMoved: number;
  reason: string;
}

export interface ResourceLevelingResult {
  leveledActivities: CpmActivityResult[];
  resourceHistogramBefore: ResourceHistogramDay[];
  resourceHistogramAfter: ResourceHistogramDay[];
  projectDurationBefore: number;
  projectDurationAfter: number;
  movedActivities: MovedActivity[];
  warnings: string[];
}

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  projectStartDate: '',
  hoursPerDay: 8,
  availableCrewSize: 10,
  includeWeekends: false,
};
