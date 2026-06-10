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

function resolveTemplateActivitySequence(
  divisionCode: string,
  templateMasterCode: string | null | undefined,
  existingActivities: readonly ProjectConstructionActivity[],
  sourceTemplateKey: string,
): number {
  const parsed = templateMasterCode ? parseActivityCode(templateMasterCode) : null;
  if (parsed) return parsed.activitySequence;

  let max = 0;
  for (const activity of existingActivities) {
    if ((activity.sourceTemplateKey ?? activity.templateId) !== sourceTemplateKey) continue;
    const seq =
      activity.activitySequence ??
      parseActivityCode(activity.activityCode)?.activitySequence ??
      0;
    if (seq > max) max = seq;
  }
  if (max > 0) return max;

  return nextActivitySequenceForDivision(existingActivities, divisionCode);
}

function nextInstanceSequenceForTemplate(
  existingActivities: readonly ProjectConstructionActivity[],
  sourceTemplateKey: string,
  activitySequence: number,
  excludeActivityId?: string,
): number {
  let max = 0;
  for (const activity of existingActivities) {
    if (activity.id === excludeActivityId) continue;
    if ((activity.sourceTemplateKey ?? activity.templateId) !== sourceTemplateKey) continue;
    const parsed = parseActivityCode(activity.activityCode);
    const seq =
      activity.instanceSequence ??
      parsed?.lineSequence ??
      (parsed?.activitySequence === activitySequence ? parsed.lineSequence : 0);
    if (seq > max) max = seq;
  }
  return max + 1;
}

function nextActivitySequenceForDivision(
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
  return max > 0 ? max : 1;
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

  const activitySequence = resolveTemplateActivitySequence(
    input.divisionCode,
    input.templateMasterCode,
    input.existingActivities,
    input.sourceTemplateKey,
  );
  const instanceSequence = nextInstanceSequenceForTemplate(
    input.existingActivities,
    input.sourceTemplateKey,
    activitySequence,
    input.excludeActivityId,
  );
  const activityCode = buildActivityCode(
    input.divisionCode,
    activitySequence,
    instanceSequence,
  );

  return {
    activityCode,
    activitySequence,
    instanceSequence,
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
