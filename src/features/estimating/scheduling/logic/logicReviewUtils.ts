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
