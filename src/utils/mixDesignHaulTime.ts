import type { Project } from '../types';
import type { PlacementOrder } from '../types/placementOrder';
import type { PourPlannerFormState } from '../types/pourPlanner';
import { DEFAULT_MIX_ADVISOR_FORM } from '../constants/mixDesignAdvisorDefaults';

const DEFAULT_HAUL_MINUTES = DEFAULT_MIX_ADVISOR_FORM.haulTimeMinutes;

function positiveMinutes(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return String(Math.round(n));
}

/** Parse "Plant to Site Drive: 12.4 mi · 34 min" from pour order summary lines. */
export function parseHaulMinutesFromSummaryLines(lines?: string[]): string | undefined {
  if (!lines?.length) return undefined;
  for (const line of lines) {
    if (!/plant to site drive/i.test(line)) continue;
    const minMatch = line.match(/(\d+(?:\.\d+)?)\s*min/i);
    if (minMatch) return positiveMinutes(minMatch[1]);
  }
  return undefined;
}

export function draftHasCustomHaulTime(
  haulTimeMinutes: string | undefined,
  defaultMinutes: string = DEFAULT_HAUL_MINUTES,
): boolean {
  const v = haulTimeMinutes?.trim();
  if (!v) return false;
  return v !== defaultMinutes;
}

export function resolveHaulTimeMinutesFromProject(
  project: Project | undefined,
  pourPlannerForm?: Partial<PourPlannerFormState>,
): string | undefined {
  const fromDraft = positiveMinutes(pourPlannerForm?.travelTimeMinutes);
  if (fromDraft) return fromDraft;

  const order: PlacementOrder | undefined = project?.placementOrder;
  const fromOrder = positiveMinutes(order?.travelTimeMinutes);
  if (fromOrder) return fromOrder;

  return parseHaulMinutesFromSummaryLines(order?.summaryLines);
}
