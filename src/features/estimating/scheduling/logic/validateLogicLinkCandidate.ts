import { calculateCpm } from '../cpm/calculateCpm';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, CpmRelationshipType } from '../cpmTypes';
import { wouldCreateCircularDependency } from './logicCycleUtils';

const VALID_RELATIONSHIP_TYPES = new Set<CpmRelationshipType>(['FS', 'SS', 'FF', 'SF']);

export type LogicLinkValidationResult =
  | { ok: true }
  | { ok: false; reason: LogicLinkInvalidReason; message: string };

export type LogicLinkInvalidReason =
  | 'missing-predecessor-activity'
  | 'missing-successor-activity'
  | 'self-link'
  | 'duplicate-link'
  | 'reverse-link'
  | 'would-create-cycle'
  | 'would-over-constrain-network'
  | 'invalid-relationship-type'
  | 'invalid-lag';

export type LogicLinkValidationActivity = {
  activityCode: string;
  activityDescription?: string;
  divisionCode?: string;
  divisionName?: string;
  durationDays?: number;
  laborHours?: number;
  manDays?: number;
  crewDays?: number;
  crewSize?: number;
  totalCost?: number;
  relationshipType?: CpmRelationshipType;
  lagDays?: number;
};

function exactLinkKey(link: CpmLogicLink): string {
  return `${link.predecessorActivityCode}|${link.successorActivityCode}|${link.relationshipType}|${link.lagDays}`;
}

function toScheduleActivity(
  activity: LogicLinkValidationActivity,
): ScheduleActivity {
  return {
    activityCode: activity.activityCode,
    activityDescription: activity.activityDescription ?? activity.activityCode,
    divisionCode: activity.divisionCode ?? '00',
    divisionName: activity.divisionName ?? '',
    durationDays: Math.max(1, activity.durationDays ?? 1),
    laborHours: activity.laborHours ?? 0,
    manDays: activity.manDays ?? 0,
    crewDays: activity.crewDays ?? 0,
    crewSize: Math.max(1, activity.crewSize ?? 1),
    totalCost: activity.totalCost ?? 0,
    relationshipType: activity.relationshipType ?? 'FS',
    lagDays: activity.lagDays ?? 0,
  };
}

function buildCpmActivities(
  activities: readonly LogicLinkValidationActivity[],
  testLinks: CpmLogicLink[],
): ScheduleActivity[] {
  const byCode = new Map(activities.map((activity) => [activity.activityCode, activity]));
  const codes = new Set<string>();
  for (const link of testLinks) {
    codes.add(link.predecessorActivityCode);
    codes.add(link.successorActivityCode);
  }

  return [...codes].map((code) =>
    toScheduleActivity(
      byCode.get(code) ?? {
        activityCode: code,
      },
    ),
  );
}

function wouldOverConstrainNetwork(
  activities: readonly LogicLinkValidationActivity[],
  testLinks: CpmLogicLink[],
): boolean {
  const cpmActivities = buildCpmActivities(activities, testLinks);
  const result = calculateCpm({
    activities: cpmActivities,
    logicLinks: testLinks,
  });

  return result.activities.some((activity) => activity.totalFloat < 0);
}

export function validateLogicLinkCandidate({
  link,
  activities,
  existingLinks,
}: {
  link: CpmLogicLink;
  activities: readonly LogicLinkValidationActivity[];
  existingLinks: CpmLogicLink[];
}): LogicLinkValidationResult {
  if (!VALID_RELATIONSHIP_TYPES.has(link.relationshipType)) {
    return {
      ok: false,
      reason: 'invalid-relationship-type',
      message: `Invalid relationship type "${link.relationshipType}".`,
    };
  }

  if (!Number.isFinite(link.lagDays)) {
    return {
      ok: false,
      reason: 'invalid-lag',
      message: 'Lag days must be a finite number.',
    };
  }

  const activityCodes = new Set(activities.map((activity) => activity.activityCode));
  const pred = link.predecessorActivityCode?.trim() ?? '';
  const succ = link.successorActivityCode?.trim() ?? '';

  if (!pred) {
    return {
      ok: false,
      reason: 'missing-predecessor-activity',
      message: 'Predecessor activity code is required.',
    };
  }

  if (!succ) {
    return {
      ok: false,
      reason: 'missing-successor-activity',
      message: 'Successor activity code is required.',
    };
  }

  if (!activityCodes.has(pred)) {
    return {
      ok: false,
      reason: 'missing-predecessor-activity',
      message: `Predecessor activity "${pred}" does not exist.`,
    };
  }

  if (!activityCodes.has(succ)) {
    return {
      ok: false,
      reason: 'missing-successor-activity',
      message: `Successor activity "${succ}" does not exist.`,
    };
  }

  if (pred === succ) {
    return {
      ok: false,
      reason: 'self-link',
      message: 'A logic link cannot connect an activity to itself.',
    };
  }

  if (
    existingLinks.some(
      (existing) =>
        existing.predecessorActivityCode === pred && existing.successorActivityCode === succ,
    )
  ) {
    return {
      ok: false,
      reason: 'duplicate-link',
      message: `Logic link ${pred} → ${succ} already exists.`,
    };
  }

  if (
    existingLinks.some(
      (existing) =>
        existing.predecessorActivityCode === succ && existing.successorActivityCode === pred,
    )
  ) {
    return {
      ok: false,
      reason: 'reverse-link',
      message: `Reverse logic link ${succ} → ${pred} already exists.`,
    };
  }

  const testLinks = [...existingLinks, link];

  if (
    wouldCreateCircularDependency(existingLinks, [
      {
        predecessorActivityCode: pred,
        successorActivityCode: succ,
        relationshipType: link.relationshipType,
        lagDays: link.lagDays,
        reason: '',
      },
    ])
  ) {
    return {
      ok: false,
      reason: 'would-create-cycle',
      message: `Logic link ${pred} → ${succ} would create a circular dependency.`,
    };
  }

  if (wouldOverConstrainNetwork(activities, testLinks)) {
    return {
      ok: false,
      reason: 'would-over-constrain-network',
      message: `Logic link ${pred} → ${succ} would over-constrain the network.`,
    };
  }

  return { ok: true };
}

export function isExactDuplicateLogicLink(
  existingLinks: readonly CpmLogicLink[],
  link: CpmLogicLink,
): boolean {
  const key = exactLinkKey(link);
  return existingLinks.some((existing) => exactLinkKey(existing) === key);
}
