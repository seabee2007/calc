export type CpmRelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

export interface CpmLogicLink {
  predecessorActivityCode: string;
  successorActivityCode: string;
  relationshipType: CpmRelationshipType;
  lagDays: number;
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

export interface CpmResult {
  activities: CpmActivityResult[];
  projectDurationDays: number;
  criticalPathActivityCodes: string[];
  warnings: string[];
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
