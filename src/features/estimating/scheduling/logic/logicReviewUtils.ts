import type { CpmLogicLink } from '../cpmTypes';
import { appendLogicLinks, wouldCreateCircularDependency } from './logicCycleUtils';
import {
  validateLogicLinkCandidate,
  type LogicLinkInvalidReason,
} from './validateLogicLinkCandidate';
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
  return appendLogicLinks(existingLinks, suggestedLinks);
}

export { wouldCreateCircularDependency };

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
  | 'invalid-activity'
  | 'reverse-link'
  | 'invalid-relationship-type'
  | 'invalid-lag'
  | 'would-over-constrain-network'
  | 'self-link';

export type ApplyLogicSuggestionSkip = {
  link: SuggestedLogicLink;
  reason: ApplyLogicSuggestionSkipReason;
};

export type ApplyLogicSuggestionsResult = {
  nextLinks: CpmLogicLink[];
  added: SuggestedLogicLink[];
  skipped: ApplyLogicSuggestionSkip[];
};

const SKIP_REASON_LABELS: Record<ApplyLogicSuggestionSkipReason, string> = {
  'missing-link': 'missing link fields',
  duplicate: 'duplicate link',
  cycle: 'would create circular dependency',
  'invalid-activity': 'missing activity code',
  'reverse-link': 'reverse link already exists',
  'invalid-relationship-type': 'invalid relationship type',
  'invalid-lag': 'invalid lag days',
  'would-over-constrain-network': 'would over-constrain network',
  'self-link': 'self link',
};

function mapInvalidReasonToSkipReason(
  reason: LogicLinkInvalidReason,
): ApplyLogicSuggestionSkipReason {
  switch (reason) {
    case 'missing-predecessor-activity':
    case 'missing-successor-activity':
      return 'invalid-activity';
    case 'duplicate-link':
      return 'duplicate';
    case 'would-create-cycle':
      return 'cycle';
    case 'reverse-link':
      return 'reverse-link';
    case 'invalid-relationship-type':
      return 'invalid-relationship-type';
    case 'invalid-lag':
      return 'invalid-lag';
    case 'would-over-constrain-network':
      return 'would-over-constrain-network';
    case 'self-link':
      return 'self-link';
    default:
      return 'invalid-activity';
  }
}

export function summarizeSkippedLogicSuggestions(
  skipped: ApplyLogicSuggestionSkip[],
): Array<{ reason: ApplyLogicSuggestionSkipReason; label: string; count: number }> {
  const counts = new Map<ApplyLogicSuggestionSkipReason, number>();
  for (const entry of skipped) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({
    reason,
    label: SKIP_REASON_LABELS[reason],
    count,
  }));
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
  activities: readonly {
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
    relationshipType?: CpmLogicLink['relationshipType'];
    lagDays?: number;
  }[];
}): ApplyLogicSuggestionsResult {
  const nextLinks = [...existingLinks];
  const added: SuggestedLogicLink[] = [];
  const skipped: ApplyLogicSuggestionSkip[] = [];

  for (const link of suggestions) {
    if (!link?.predecessorActivityCode?.trim() || !link?.successorActivityCode?.trim()) {
      skipped.push({ link, reason: 'missing-link' });
      continue;
    }

    const candidate: CpmLogicLink = {
      predecessorActivityCode: link.predecessorActivityCode.trim(),
      successorActivityCode: link.successorActivityCode.trim(),
      relationshipType: link.relationshipType,
      lagDays: link.lagDays,
    };

    const validation = validateLogicLinkCandidate({
      link: candidate,
      activities,
      existingLinks: nextLinks,
    });

    if (!validation.ok) {
      skipped.push({
        link,
        reason: mapInvalidReasonToSkipReason(validation.reason),
      });
      continue;
    }

    nextLinks.push(candidate);
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

export type UnsafeLogicLinkIssueType =
  | 'self-link'
  | 'duplicate-link'
  | 'missing-activity-code'
  | 'circular-dependency';

export type UnsafeLogicLinkIssue = {
  type: UnsafeLogicLinkIssueType;
  link: CpmLogicLink;
  message: string;
};

export function collectUnsafeLogicLinkIssues({
  logicLinks,
  activities,
}: {
  logicLinks: CpmLogicLink[];
  activities: readonly { activityCode: string }[];
}): UnsafeLogicLinkIssue[] {
  const activityCodes = new Set(activities.map((activity) => activity.activityCode));
  const issues: UnsafeLogicLinkIssue[] = [];
  const graphPairs = new Map<string, number>();

  for (const link of logicLinks) {
    if (link.predecessorActivityCode === link.successorActivityCode) {
      issues.push({
        type: 'self-link',
        link,
        message: `${link.predecessorActivityCode} links to itself`,
      });
    }

    if (
      !activityCodes.has(link.predecessorActivityCode) ||
      !activityCodes.has(link.successorActivityCode)
    ) {
      issues.push({
        type: 'missing-activity-code',
        link,
        message: `${link.predecessorActivityCode} → ${link.successorActivityCode} references missing activity code`,
      });
    }

    const pairKey = `${link.predecessorActivityCode}|${link.successorActivityCode}`;
    const count = (graphPairs.get(pairKey) ?? 0) + 1;
    graphPairs.set(pairKey, count);
    if (count > 1) {
      issues.push({
        type: 'duplicate-link',
        link,
        message: `Duplicate link ${link.predecessorActivityCode} → ${link.successorActivityCode}`,
      });
    }
  }

  if (logicLinks.length > 0 && wouldCreateCircularDependency(logicLinks, [])) {
    for (const link of logicLinks) {
      const withoutLink = logicLinks.filter(
        (candidate) =>
          !(
            candidate.predecessorActivityCode === link.predecessorActivityCode &&
            candidate.successorActivityCode === link.successorActivityCode &&
            candidate.relationshipType === link.relationshipType &&
            candidate.lagDays === link.lagDays
          ),
      );
      if (wouldCreateCircularDependency(withoutLink, [])) {
        continue;
      }
      issues.push({
        type: 'circular-dependency',
        link,
        message: `${link.predecessorActivityCode} → ${link.successorActivityCode} participates in a circular dependency`,
      });
    }
  }

  return issues;
}

export function summarizeUnsafeLogicLinkIssues(
  issues: UnsafeLogicLinkIssue[],
): Array<{ type: UnsafeLogicLinkIssueType; label: string; count: number }> {
  const labels: Record<UnsafeLogicLinkIssueType, string> = {
    'self-link': 'self links',
    'duplicate-link': 'duplicate links',
    'missing-activity-code': 'missing activity codes',
    'circular-dependency': 'circular dependencies',
  };
  const counts = new Map<UnsafeLogicLinkIssueType, number>();
  for (const issue of issues) {
    counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({
    type,
    label: labels[type],
    count,
  }));
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
