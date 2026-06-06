import { calculateCpm } from '../cpm/calculateCpm';
import type { CpmLogicLink } from '../cpmTypes';
import { CONSTRUCTION_SEQUENCE_RULES } from './logicSequenceRules';
import type {
  CheckLogicNetworkInput,
  LogicReviewResult,
  LogicReviewWarning,
} from './logicTypes';
import {
  buildSuggestedLink,
  buildWarningId,
  filterIgnoredWarnings,
  findFirstMatchingActivity,
  findMatchingActivities,
  linkExists,
  summarizeLogicWarnings,
} from './logicReviewUtils';

function groupMissingPredecessorWarnings(
  successorCode: string,
  successorTitle: string,
  missingLinks: ReturnType<typeof buildSuggestedLink>[],
  ruleId: string,
  ruleReason: string,
): LogicReviewWarning {
  const predecessorLabels = missingLinks
    .map((link) => `${link.predecessorActivityCode}`)
    .join(', ');

  return {
    id: buildWarningId({
      category: 'missingLikelyPredecessor',
      activityCode: successorCode,
      ruleId,
    }),
    severity: 'warning',
    category: 'missingLikelyPredecessor',
    activityCode: successorCode,
    activityTitle: successorTitle,
    issue: `${successorTitle} usually should not start until related predecessor work is complete.`,
    reason: ruleReason,
    suggestedLinks: missingLinks,
    canAutoFix: missingLinks.length > 0,
    source: 'deterministic',
  };
}

function runSequenceRules(input: CheckLogicNetworkInput): LogicReviewWarning[] {
  const warnings: LogicReviewWarning[] = [];
  const lineItemPredecessors = new Map(
    input.activities
      .filter((activity) => activity.predecessorActivityCode)
      .map((activity) => [activity.activityCode, activity.predecessorActivityCode!]),
  );

  for (const rule of CONSTRUCTION_SEQUENCE_RULES) {
    const targetActivities = findMatchingActivities(input.activities, rule.whenActivityMatches);
    for (const target of targetActivities) {
      const missingPredecessors: ReturnType<typeof buildSuggestedLink>[] = [];

      for (const expected of rule.expectedPredecessors ?? []) {
        const predecessor = findFirstMatchingActivity(input.activities, expected);
        if (!predecessor || predecessor.activityCode === target.activityCode) {
          continue;
        }

        if (
          linkExists(
            predecessor.activityCode,
            target.activityCode,
            input.logicLinks,
            lineItemPredecessors,
          )
        ) {
          continue;
        }

        missingPredecessors.push(buildSuggestedLink(predecessor, target, expected));
      }

      if (missingPredecessors.length === 0) {
        continue;
      }

      warnings.push(
        groupMissingPredecessorWarnings(
          target.activityCode,
          target.activityDescription,
          missingPredecessors,
          rule.id,
          missingPredecessors[0]?.reason ?? rule.description ?? rule.name,
        ),
      );
    }
  }

  return warnings;
}

function runHardValidationChecks(input: CheckLogicNetworkInput): LogicReviewWarning[] {
  const warnings: LogicReviewWarning[] = [];
  const activityCodes = input.activities.map((activity) => activity.activityCode);
  const codeSet = new Set<string>();
  const duplicates = new Set<string>();

  for (const code of activityCodes) {
    if (!code) continue;
    if (codeSet.has(code)) {
      duplicates.add(code);
    }
    codeSet.add(code);
  }

  for (const duplicate of duplicates) {
    warnings.push({
      id: buildWarningId({
        category: 'duplicateActivityCode',
        activityCode: duplicate,
      }),
      severity: 'critical',
      category: 'duplicateActivityCode',
      activityCode: duplicate,
      issue: `Duplicate activity code "${duplicate}" should be reviewed before saving.`,
      reason: 'Each schedule activity needs a unique activity code.',
      canAutoFix: false,
      source: 'deterministic',
    });
  }

  for (const link of input.logicLinks) {
    if (!codeSet.has(link.predecessorActivityCode)) {
      warnings.push({
        id: buildWarningId({
          category: 'missingPredecessorReference',
          activityCode: link.successorActivityCode,
          predecessorActivityCode: link.predecessorActivityCode,
        }),
        severity: 'warning',
        category: 'missingPredecessorReference',
        activityCode: link.successorActivityCode,
        issue: `Logic link references missing predecessor "${link.predecessorActivityCode}".`,
        reason: 'Broken logic links should be fixed or removed.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }
    if (!codeSet.has(link.successorActivityCode)) {
      warnings.push({
        id: buildWarningId({
          category: 'missingPredecessorReference',
          activityCode: link.predecessorActivityCode,
          successorActivityCode: link.successorActivityCode,
        }),
        severity: 'warning',
        category: 'missingPredecessorReference',
        activityCode: link.predecessorActivityCode,
        issue: `Logic link references missing successor "${link.successorActivityCode}".`,
        reason: 'Broken logic links should be fixed or removed.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }
  }

  const cpmProbe = calculateCpm({
    activities: input.activities.map((activity) => ({
      activityCode: activity.activityCode,
      activityDescription: activity.activityDescription,
      divisionCode: activity.divisionCode,
      divisionName: '',
      durationDays: Math.max(1, activity.durationDays),
      laborHours: 0,
      manDays: 0,
      crewDays: 0,
      crewSize: Math.max(1, activity.crewSize),
      totalCost: 0,
      relationshipType: 'FS' as const,
      lagDays: 0,
    })),
    logicLinks: input.logicLinks,
  });

  if (cpmProbe.warnings.some((warning) => warning.toLowerCase().includes('circular'))) {
    warnings.push({
      id: buildWarningId({ category: 'circularDependency' }),
      severity: 'critical',
      category: 'circularDependency',
      issue: 'Circular dependency detected in logic links.',
      reason: 'Circular logic can break CPM dates and should be corrected before saving.',
      canAutoFix: false,
      source: 'deterministic',
    });
  }

  const predecessorMap = new Map<string, Set<string>>();
  const successorMap = new Map<string, Set<string>>();
  for (const activity of input.activities) {
    predecessorMap.set(activity.activityCode, new Set());
    successorMap.set(activity.activityCode, new Set());
  }
  for (const link of input.logicLinks) {
    predecessorMap.get(link.successorActivityCode)?.add(link.predecessorActivityCode);
    successorMap.get(link.predecessorActivityCode)?.add(link.successorActivityCode);
  }

  const lineItemPredecessors = new Map(
    input.activities
      .filter((activity) => activity.predecessorActivityCode)
      .map((activity) => [activity.activityCode, activity.predecessorActivityCode!]),
  );

  const hasMultipleActivities = input.activities.length > 1;
  const projectFinish = Math.max(...cpmProbe.activities.map((activity) => activity.earlyFinish), 0);

  for (const activity of input.activities) {
    if (activity.durationDays < 1) {
      warnings.push({
        id: buildWarningId({
          category: 'missingDuration',
          activityCode: activity.activityCode,
        }),
        severity: 'warning',
        category: 'missingDuration',
        activityCode: activity.activityCode,
        activityTitle: activity.activityDescription,
        issue: `${activity.activityDescription} may be missing a valid duration.`,
        reason: 'CPM needs duration days to calculate dates and float.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }

    if (activity.crewSize < 1) {
      warnings.push({
        id: buildWarningId({
          category: 'missingCrewData',
          activityCode: activity.activityCode,
        }),
        severity: 'warning',
        category: 'missingCrewData',
        activityCode: activity.activityCode,
        activityTitle: activity.activityDescription,
        issue: `${activity.activityDescription} may be missing crew or resource data.`,
        reason: 'Crew size helps resource planning and leveling.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }

    const cpmActivity = cpmProbe.activities.find(
      (entry) => entry.activityCode === activity.activityCode,
    );
    const hasIncomingLink =
      (predecessorMap.get(activity.activityCode)?.size ?? 0) > 0 ||
      Boolean(lineItemPredecessors.get(activity.activityCode));

    if (hasMultipleActivities && !hasIncomingLink) {
      warnings.push({
        id: buildWarningId({
          category: 'noPredecessor',
          activityCode: activity.activityCode,
        }),
        severity: 'info',
        category: 'noPredecessor',
        activityCode: activity.activityCode,
        activityTitle: activity.activityDescription,
        issue: `${activity.activityDescription} has no predecessor link and may need one.`,
        reason: 'Review whether this activity should start after other work.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }

    const hasOutgoingLink = (successorMap.get(activity.activityCode)?.size ?? 0) > 0;
    const isNaturalFinish = cpmActivity?.earlyFinish === projectFinish;

    if (hasMultipleActivities && !hasOutgoingLink && !isNaturalFinish) {
      warnings.push({
        id: buildWarningId({
          category: 'noSuccessor',
          activityCode: activity.activityCode,
        }),
        severity: 'info',
        category: 'noSuccessor',
        activityCode: activity.activityCode,
        activityTitle: activity.activityDescription,
        issue: `${activity.activityDescription} has no successor link and may be out of sequence.`,
        reason: 'Review whether later work should follow this activity.',
        canAutoFix: false,
        source: 'deterministic',
      });
    }
  }

  return warnings;
}

export function checkLogicNetwork(input: CheckLogicNetworkInput): LogicReviewResult {
  const hardWarnings = runHardValidationChecks(input);
  const ruleWarnings = runSequenceRules(input);
  const combined = [...hardWarnings, ...ruleWarnings];
  const visible = filterIgnoredWarnings(
    combined,
    input.ignoredWarningIds ?? [],
    input.showIgnored ?? false,
  );
  const counts = summarizeLogicWarnings(visible);
  const blocksSave = visible.some(
    (warning) =>
      warning.category === 'duplicateActivityCode' || warning.category === 'circularDependency',
  );

  return {
    warnings: visible,
    counts,
    blocksSave,
  };
}

export function dedupeLogicWarnings(warnings: LogicReviewWarning[]): LogicReviewWarning[] {
  const seen = new Set<string>();
  const result: LogicReviewWarning[] = [];
  for (const warning of warnings) {
    if (seen.has(warning.id)) continue;
    seen.add(warning.id);
    result.push(warning);
  }
  return result;
}

export function mergeSuggestedLinksFromWarnings(
  warnings: LogicReviewWarning[],
): import('./logicTypes').SuggestedLogicLink[] {
  const links: import('./logicTypes').SuggestedLogicLink[] = [];
  for (const warning of warnings) {
    for (const link of warning.suggestedLinks ?? []) {
      links.push(link);
    }
  }
  return links;
}
