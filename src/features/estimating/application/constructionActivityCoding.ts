/**
 * Project construction activity coding — unique DD-AA-II codes per project instance.
 *
 * Templates supply a master code (e.g. 03-02-01). Each saved project instance
 * gets a unique code by incrementing the instance segment (II) for the same
 * source template within a project.
 */
import { normalizeCsiDivisionCode } from '../domain/csiDivisions';
import {
  buildActivityCode,
  parseActivityCode,
  pad2,
} from './estimateActivityCoding';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';

export interface ActivityInstanceIdentityInput {
  activityName: string;
  instanceLabel?: string | null;
  location?: string | null;
  drawingReference?: string | null;
  phase?: string | null;
  notes?: string | null;
}

export interface AssignedProjectActivityCode {
  activityCode: string;
  activitySequence: number;
  instanceSequence: number;
  baseTitle: string;
  title: string;
}

export interface GenerateNextProjectActivityCodeInput {
  divisionCode: string;
  existingActivities: readonly ProjectConstructionActivity[];
  preferredCategoryKey?: string | null;
  preferredTitle?: string | null;
  excludeActivityId?: string;
}

/** Display title: "Place Continuous Footing — F-1" */
export function buildConstructionActivityDisplayTitle(
  baseTitle: string,
  instanceLabel?: string | null,
  location?: string | null,
): string {
  const base = baseTitle.trim();
  const label = instanceLabel?.trim();
  const loc = location?.trim();
  const suffix = label || loc;
  if (!base) return suffix ?? '';
  if (!suffix) return base;
  return `${base} — ${suffix}`;
}

/** Count saved instances of the same source template in a project. */
export function countTemplateInstances(
  activities: readonly ProjectConstructionActivity[],
  sourceTemplateKey: string,
  excludeActivityId?: string,
): number {
  return activities.filter(
    (activity) =>
      activity.id !== excludeActivityId &&
      (activity.sourceTemplateKey ?? activity.templateId ?? '') === sourceTemplateKey,
  ).length;
}

/** True when the same template already exists and user should provide an instance label. */
export function requiresInstanceLabelForTemplate(
  activities: readonly ProjectConstructionActivity[],
  sourceTemplateKey: string,
): boolean {
  return countTemplateInstances(activities, sourceTemplateKey) > 0;
}

function normalizeCategoryKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function matchesPreferredCategory(
  activity: ProjectConstructionActivity,
  preferredCategoryKey?: string | null,
  preferredTitle?: string | null,
): boolean {
  const categoryKey = normalizeCategoryKey(preferredCategoryKey);
  if (categoryKey) {
    const activityCategory = normalizeCategoryKey(activity.sourceTemplateKey ?? activity.templateId);
    if (activityCategory === categoryKey) return true;
  }

  const titleKey = normalizeCategoryKey(preferredTitle);
  if (!titleKey) return false;
  return (
    normalizeCategoryKey(activity.baseTitle) === titleKey ||
    normalizeCategoryKey(activity.title) === titleKey ||
    normalizeCategoryKey(activity.name) === titleKey
  );
}

function nextAvailableInstanceSequence(
  usedCodes: ReadonlySet<string>,
  divisionCode: string,
  activitySequence: number,
): number {
  for (let instanceSequence = 1; instanceSequence <= 99; instanceSequence += 1) {
    if (!usedCodes.has(buildActivityCode(divisionCode, activitySequence, instanceSequence))) {
      return instanceSequence;
    }
  }
  return 100;
}

function nextUnusedActivitySequence(
  existingActivities: readonly ProjectConstructionActivity[],
  divisionCode: string,
): number {
  const normalizedDivision = pad2(normalizeCsiDivisionCode(divisionCode));
  let max = 0;
  for (const activity of existingActivities) {
    if (pad2(normalizeCsiDivisionCode(activity.divisionCode)) !== normalizedDivision) continue;
    const parsed = parseActivityCode(activity.activityCode);
    const seq = activity.activitySequence ?? parsed?.activitySequence ?? 0;
    if (seq > max) max = seq;
  }
  return max + 1 || 1;
}

/**
 * Generate the next unused stable project activity code in DD-AA-II format.
 *
 * Same project category/template gets another instance under its existing AA
 * sequence. New categories get the next AA sequence for the division. In all
 * cases the final DD-AA-II code is checked against every existing activity in
 * the project/division before it is returned.
 */
export function generateNextProjectActivityCode(
  input: GenerateNextProjectActivityCodeInput,
): Pick<AssignedProjectActivityCode, 'activityCode' | 'activitySequence' | 'instanceSequence'> {
  const divisionCode = pad2(normalizeCsiDivisionCode(input.divisionCode));
  const existingInDivision = input.existingActivities.filter(
    (activity) =>
      activity.id !== input.excludeActivityId &&
      pad2(normalizeCsiDivisionCode(activity.divisionCode)) === divisionCode,
  );
  const usedCodes = new Set(
    existingInDivision
      .map((activity) => activity.activityCode?.trim())
      .filter((code): code is string => Boolean(code)),
  );

  const categoryMatch = existingInDivision.find((activity) =>
    matchesPreferredCategory(activity, input.preferredCategoryKey, input.preferredTitle),
  );
  const matchedParsed = categoryMatch ? parseActivityCode(categoryMatch.activityCode) : null;
  const activitySequence =
    categoryMatch?.activitySequence ??
    matchedParsed?.activitySequence ??
    nextUnusedActivitySequence(existingInDivision, divisionCode);
  const instanceSequence = nextAvailableInstanceSequence(usedCodes, divisionCode, activitySequence);

  return {
    activityCode: buildActivityCode(divisionCode, activitySequence, instanceSequence),
    activitySequence,
    instanceSequence,
  };
}

/**
 * Assign a unique project activity code for a new or edited instance.
 * Preserves activityCode when editing an existing activity (stable id for Logic Network).
 */
export function assignProjectActivityCode(input: {
  existingActivities: readonly ProjectConstructionActivity[];
  divisionCode: string;
  sourceTemplateKey: string;
  templateMasterCode?: string | null;
  identity: ActivityInstanceIdentityInput;
  /** When editing, keep the existing stable code. */
  preserveActivityCode?: string | null;
  excludeActivityId?: string;
}): AssignedProjectActivityCode {
  const baseTitle = input.identity.activityName.trim();
  const title = buildConstructionActivityDisplayTitle(
    baseTitle,
    input.identity.instanceLabel,
    input.identity.location,
  );

  if (input.preserveActivityCode?.trim()) {
    const parsed = parseActivityCode(input.preserveActivityCode);
    return {
      activityCode: input.preserveActivityCode.trim(),
      activitySequence: parsed?.activitySequence ?? 1,
      instanceSequence: parsed?.lineSequence ?? 1,
      baseTitle,
      title: title || baseTitle,
    };
  }

  const generated = generateNextProjectActivityCode({
    existingActivities: input.existingActivities,
    divisionCode: input.divisionCode,
    preferredCategoryKey: input.sourceTemplateKey,
    preferredTitle: baseTitle,
    excludeActivityId: input.excludeActivityId,
  });

  return {
    activityCode: generated.activityCode,
    activitySequence: generated.activitySequence,
    instanceSequence: generated.instanceSequence,
    baseTitle,
    title: title || baseTitle,
  };
}

export function validateInstanceLabelForDuplicateTemplate(input: {
  existingActivities: readonly ProjectConstructionActivity[];
  sourceTemplateKey: string;
  instanceLabel?: string | null;
  excludeActivityId?: string;
}): string | null {
  if (
    !requiresInstanceLabelForTemplate(
      input.existingActivities.filter((a) => a.id !== input.excludeActivityId),
      input.sourceTemplateKey,
    )
  ) {
    return null;
  }
  if (input.instanceLabel?.trim()) return null;
  return 'This activity already exists. Add an instance label such as F-1, F-2, Area C-2, or Grid A/1-4.';
}

/** Whether a code looks like a professional project activity code (DD-AA-II). */
export function isProfessionalActivityCode(code: string): boolean {
  return parseActivityCode(code.trim()) !== null;
}
