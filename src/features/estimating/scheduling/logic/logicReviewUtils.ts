import { calculateCpm } from '../cpm/calculateCpm';
import type { CpmLogicLink } from '../cpmTypes';
import type {
  ActivityMatchCriteria,
  CheckLogicNetworkInput,
  ExpectedLogicMatch,
  LogicReviewWarning,
  LogicWarningCategory,
  SuggestedLogicLink,
} from './logicTypes';

export type LogicReviewActivity = CheckLogicNetworkInput['activities'][number];

export function normalizeLogicText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function activityMatchesCriteria(
  activity: LogicReviewActivity,
  criteria: ActivityMatchCriteria,
): boolean {
  const title = normalizeLogicText(activity.activityDescription);
  const workPackage = normalizeLogicText(activity.workPackageName ?? '');

  if (criteria.divisionCode && activity.divisionCode !== criteria.divisionCode) {
    return false;
  }

  const titleKeywords = (criteria.titleIncludes ?? []).map(normalizeLogicText);
  if (titleKeywords.length > 0) {
    const inTitle = titleKeywords.every((keyword) => title.includes(keyword));
    const inWorkPackage = titleKeywords.every((keyword) => workPackage.includes(keyword));
    if (!inTitle && !inWorkPackage) {
      return false;
    }
  }

  const workPackageKeywords = (criteria.workPackageIncludes ?? []).map(normalizeLogicText);
  if (workPackageKeywords.length > 0) {
    if (!workPackageKeywords.every((keyword) => workPackage.includes(keyword))) {
      return false;
    }
  }

  return (
    titleKeywords.length > 0 ||
    workPackageKeywords.length > 0 ||
    Boolean(criteria.divisionCode)
  );
}

export function findMatchingActivities(
  activities: LogicReviewActivity[],
  criteria: ActivityMatchCriteria,
): LogicReviewActivity[] {
  return activities.filter((activity) => activityMatchesCriteria(activity, criteria));
}

export function findFirstMatchingActivity(
  activities: LogicReviewActivity[],
  criteria: ExpectedLogicMatch,
): LogicReviewActivity | undefined {
  return activities.find((activity) =>
    activityMatchesCriteria(activity, {
      titleIncludes: criteria.titleIncludes,
      divisionCode: criteria.divisionCode,
    }),
  );
}

export function linkExists(
  predecessorActivityCode: string,
  successorActivityCode: string,
  logicLinks: CpmLogicLink[],
  lineItemPredecessors: Map<string, string>,
): boolean {
  const hasLogicLink = logicLinks.some(
    (link) =>
      link.predecessorActivityCode === predecessorActivityCode &&
      link.successorActivityCode === successorActivityCode,
  );
  if (hasLogicLink) return true;

  const lineItemPred = lineItemPredecessors.get(successorActivityCode);
  return lineItemPred === predecessorActivityCode;
}

export function buildWarningId(parts: {
  category: LogicWarningCategory;
  activityCode?: string;
  predecessorActivityCode?: string;
  successorActivityCode?: string;
  ruleId?: string;
}): string {
  return [
    parts.category,
    parts.activityCode ?? '',
    parts.predecessorActivityCode ?? '',
    parts.successorActivityCode ?? '',
    parts.ruleId ?? '',
  ].join('|');
}

export function buildSuggestedLink(
  predecessor: LogicReviewActivity,
  successor: LogicReviewActivity,
  match: ExpectedLogicMatch,
): SuggestedLogicLink {
  return {
    predecessorActivityCode: predecessor.activityCode,
    successorActivityCode: successor.activityCode,
    relationshipType: match.relationshipType,
    lagDays: match.lagDays,
    reason: match.reason,
  };
}

export function appendSuggestedLogicLinks(
  existingLinks: CpmLogicLink[],
  suggestedLinks: SuggestedLogicLink[],
): CpmLogicLink[] {
  const next = [...existingLinks];
  for (const suggested of suggestedLinks) {
    const duplicate = next.some(
      (link) =>
        link.predecessorActivityCode === suggested.predecessorActivityCode &&
        link.successorActivityCode === suggested.successorActivityCode,
    );
    if (duplicate) continue;
    next.push({
      predecessorActivityCode: suggested.predecessorActivityCode,
      successorActivityCode: suggested.successorActivityCode,
      relationshipType: suggested.relationshipType,
      lagDays: suggested.lagDays,
    });
  }
  return next;
}

export function wouldCreateCircularDependency(
  existingLinks: CpmLogicLink[],
  suggestedLinks: SuggestedLogicLink[],
): boolean {
  const testLinks = appendSuggestedLogicLinks(existingLinks, suggestedLinks);
  const codes = new Set<string>();
  for (const link of testLinks) {
    codes.add(link.predecessorActivityCode);
    codes.add(link.successorActivityCode);
  }

  const result = calculateCpm({
    activities: [...codes].map((code) => ({
      activityCode: code,
      activityDescription: code,
      divisionCode: '00',
      divisionName: '',
      durationDays: 1,
      laborHours: 0,
      manDays: 0,
      crewDays: 0,
      crewSize: 1,
      totalCost: 0,
      relationshipType: 'FS' as const,
      lagDays: 0,
    })),
    logicLinks: testLinks,
  });

  return result.warnings.some((warning) => warning.toLowerCase().includes('circular'));
}

export function filterIgnoredWarnings(
  warnings: LogicReviewWarning[],
  ignoredWarningIds: string[],
  showIgnored: boolean,
): LogicReviewWarning[] {
  if (showIgnored) return warnings;
  const ignored = new Set(ignoredWarningIds);
  return warnings.filter((warning) => !ignored.has(warning.id));
}

export function summarizeLogicWarnings(warnings: LogicReviewWarning[]): {
  critical: number;
  warning: number;
  info: number;
  total: number;
} {
  const critical = warnings.filter((warning) => warning.severity === 'critical').length;
  const warningCount = warnings.filter((warning) => warning.severity === 'warning').length;
  const info = warnings.filter((warning) => warning.severity === 'info').length;
  return {
    critical,
    warning: warningCount,
    info,
    total: warnings.length,
  };
}

export type ApplyLogicSuggestionSkipReason =
  | 'missing-link'
  | 'duplicate'
  | 'cycle'
  | 'invalid-activity';

export type ApplyLogicSuggestionSkip = {
  link: SuggestedLogicLink;
  reason: ApplyLogicSuggestionSkipReason;
};

export type ApplyLogicSuggestionsResult = {
  nextLinks: CpmLogicLink[];
  added: SuggestedLogicLink[];
  skipped: ApplyLogicSuggestionSkip[];
};

function isDuplicateLogicLink(
  existingLinks: readonly CpmLogicLink[],
  link: SuggestedLogicLink,
): boolean {
  return existingLinks.some(
    (existing) =>
      existing.predecessorActivityCode === link.predecessorActivityCode &&
      existing.successorActivityCode === link.successorActivityCode &&
      existing.relationshipType === link.relationshipType &&
      existing.lagDays === link.lagDays,
  );
}

function isGraphDuplicateLogicLink(
  existingLinks: readonly CpmLogicLink[],
  link: SuggestedLogicLink,
): boolean {
  return existingLinks.some(
    (existing) =>
      existing.predecessorActivityCode === link.predecessorActivityCode &&
      existing.successorActivityCode === link.successorActivityCode,
  );
}

export function collectVisibleAutoFixLinks(warnings: LogicReviewWarning[]): SuggestedLogicLink[] {
  const links: SuggestedLogicLink[] = [];
  for (const warning of warnings) {
    if (!warning.canAutoFix) continue;
    for (const link of warning.suggestedLinks ?? []) {
      links.push(link);
    }
  }
  return links;
}

export function applyLogicSuggestions({
  suggestions,
  existingLinks,
  activities,
}: {
  suggestions: SuggestedLogicLink[];
  existingLinks: CpmLogicLink[];
  activities: readonly { activityCode: string }[];
}): ApplyLogicSuggestionsResult {
  const activityCodes = new Set(activities.map((activity) => activity.activityCode));
  const nextLinks = [...existingLinks];
  const added: SuggestedLogicLink[] = [];
  const skipped: ApplyLogicSuggestionSkip[] = [];

  for (const link of suggestions) {
    if (!link?.predecessorActivityCode?.trim() || !link?.successorActivityCode?.trim()) {
      skipped.push({ link, reason: 'missing-link' });
      continue;
    }

    if (
      !activityCodes.has(link.predecessorActivityCode) ||
      !activityCodes.has(link.successorActivityCode)
    ) {
      skipped.push({ link, reason: 'invalid-activity' });
      continue;
    }

    if (isDuplicateLogicLink(nextLinks, link) || isGraphDuplicateLogicLink(nextLinks, link)) {
      skipped.push({ link, reason: 'duplicate' });
      continue;
    }

    if (wouldCreateCircularDependency(nextLinks, [link])) {
      skipped.push({ link, reason: 'cycle' });
      continue;
    }

    nextLinks.push({
      predecessorActivityCode: link.predecessorActivityCode,
      successorActivityCode: link.successorActivityCode,
      relationshipType: link.relationshipType,
      lagDays: link.lagDays,
    });
    added.push(link);
  }

  return { nextLinks, added, skipped };
}

export function filterResolvedAiWarnings(
  aiWarnings: LogicReviewWarning[],
  existingLinks: CpmLogicLink[],
  added: SuggestedLogicLink[],
): LogicReviewWarning[] {
  const mergedLinks = appendSuggestedLogicLinks(existingLinks, added);
  return aiWarnings.filter((warning) => {
    const suggested = warning.suggestedLinks ?? [];
    if (suggested.length === 0) return true;
    return suggested.some(
      (link) =>
        !mergedLinks.some(
          (existing) =>
            existing.predecessorActivityCode === link.predecessorActivityCode &&
            existing.successorActivityCode === link.successorActivityCode,
        ),
    );
  });
}

export function buildAcceptAllToastMessage(
  addedCount: number,
  skippedCount: number,
): { message: string; variant: 'success' | 'error' } {
  if (addedCount === 0) {
    return { message: 'Could not accept logic suggestions', variant: 'error' };
  }
  if (skippedCount === 0) {
    return { message: 'Logic suggestions accepted', variant: 'success' };
  }
  return {
    message: `Accepted ${addedCount} suggestions. ${skippedCount} could not be added.`,
    variant: 'success',
  };
}
