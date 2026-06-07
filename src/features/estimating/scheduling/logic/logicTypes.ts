import type { CpmLogicLink, CpmRelationshipType } from '../cpmTypes';

export type LogicRelationshipType = CpmRelationshipType;

export type LogicWarningSeverity = 'info' | 'warning' | 'critical';

export type LogicWarningCategory =
  | 'missingLikelyPredecessor'
  | 'missingLikelySuccessor'
  | 'outOfSequence'
  | 'duplicateActivityCode'
  | 'circularDependency'
  | 'missingPredecessorReference'
  | 'noPredecessor'
  | 'noSuccessor'
  | 'missingDuration'
  | 'missingCrewData';

export type ActivityMatchCriteria = {
  titleIncludes?: string[];
  divisionCode?: string;
  workPackageIncludes?: string[];
};

export type ExpectedLogicMatch = {
  titleIncludes: string[];
  divisionCode?: string;
  relationshipType: LogicRelationshipType;
  lagDays: number;
  reason: string;
};

export type LogicSequenceRule = {
  id: string;
  name: string;
  description?: string;
  whenActivityMatches: ActivityMatchCriteria;
  expectedPredecessors?: ExpectedLogicMatch[];
  expectedSuccessors?: ExpectedLogicMatch[];
};

export type SuggestedLogicLink = {
  predecessorActivityCode: string;
  successorActivityCode: string;
  relationshipType: LogicRelationshipType;
  lagDays: number;
  reason: string;
};

export type LogicReviewWarning = {
  id: string;
  severity: LogicWarningSeverity;
  category: LogicWarningCategory;
  activityCode?: string;
  activityTitle?: string;
  issue: string;
  reason?: string;
  suggestedLinks?: SuggestedLogicLink[];
  canAutoFix: boolean;
  source: 'deterministic' | 'ai';
  aiConfidence?: 'low' | 'medium' | 'high';
};

export type LogicReviewResult = {
  warnings: LogicReviewWarning[];
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  blocksSave: boolean;
};

export type CheckLogicNetworkInput = {
  activities: Array<{
    activityCode: string;
    activityDescription: string;
    divisionCode: string;
    workPackageName?: string;
    durationDays: number;
    crewSize: number;
    predecessorActivityCode?: string;
  }>;
  logicLinks: CpmLogicLink[];
  ignoredWarningIds?: string[];
  showIgnored?: boolean;
  showLowConfidenceWarnings?: boolean;
};

export type AiLogicReviewInput = {
  activities: Array<{
    activityCode: string;
    title: string;
    description?: string;
    divisionCode?: string;
    divisionName?: string;
    workPackageName?: string;
    durationDays?: number;
    crewSize?: number;
    laborHours?: number;
    scheduleEnabled?: boolean;
    // Stable identity fields. runtimeActivityId is the authoritative identity so
    // repeated master codes stay uniquely linkable; masterActivityCode/logicAnchor
    // are the authoritative source of an activity's meaning (never infer from notes).
    runtimeActivityId?: string;
    displayCode?: string;
    masterActivityCode?: string;
    isCustomActivity?: boolean;
    // Optional classification fields sourced from the Residential Activity Master.
    activityType?: 'work' | 'inspection' | 'milestone' | 'curing_lag' | 'procurement_lead_time' | 'testing';
    sequencingCategory?: string;
    logicAnchor?: string;
    primaryTrade?: string;
    variant?: 'baseline' | 'slab_on_grade' | 'crawlspace' | 'optional';
  }>;
  logicLinks: CpmLogicLink[];
};

export type AiLogicSuggestion = {
  id: string;
  confidence: 'low' | 'medium' | 'high';
  issue: string;
  predecessorActivityCode: string;
  successorActivityCode: string;
  relationshipType: LogicRelationshipType;
  lagDays: number;
  reason: string;
};

export type AiLogicReviewResult = {
  suggestions: AiLogicSuggestion[];
};

export type LogicBatchSnapshot = {
  appliedAt: string;
  addedLinks: CpmLogicLink[];
  previousLinksSnapshot: CpmLogicLink[];
};

export const LOGIC_WARNING_CATEGORY_LABELS: Record<LogicWarningCategory, string> = {
  missingLikelyPredecessor: 'Missing likely predecessors',
  missingLikelySuccessor: 'Missing likely successors',
  outOfSequence: 'Possible out-of-sequence activities',
  duplicateActivityCode: 'Duplicate or circular logic',
  circularDependency: 'Duplicate or circular logic',
  missingPredecessorReference: 'Duplicate or circular logic',
  noPredecessor: 'Activities with no predecessor',
  noSuccessor: 'Activities with no successor',
  missingDuration: 'Activities missing duration',
  missingCrewData: 'Activities missing crew/resource data',
};
