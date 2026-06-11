import type { CurrentEstimate } from '../../estimating/application/currentEstimateService';
import { parseEstimateSettingsFromAssumptions } from '../../estimating/application/estimateSettings';
import { resolveEstimateWorkspaceScheduleActivities } from '../../estimating/application/estimateWorkspaceScheduleSource';
import { resolveSchedulingEnabled } from '../../estimating/domain/estimateMethods';
import type { ProjectConstructionActivity } from '../../estimating/domain/constructionActivityTypes';
import type { EstimateDomainTask } from '../../estimating/infrastructure/estimateDbTypes';
import type { ScheduleActivity } from '../../estimating/scheduling/adapters/estimateLineItemsToScheduleActivities';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  type CpmLogicLink,
  type CpmResult,
  type ScheduleSettings,
} from '../../estimating/scheduling/cpmTypes';
import { getLocalDateYmd } from '../../estimating/scheduling/levelThreeGanttGrid';
import {
  migratePrecedenceDiagramFromLegacyCpmCache,
  parsePrecedenceDiagramFromAssumptions,
  recomputeCommittedCpmFromSavedState,
  type PrecedenceDiagramState,
} from '../../estimating/scheduling/precedenceDiagram';
import {
  hasLogicLinksKey,
  parseLeveledOffsetsFromAssumptions,
  parseLogicLinksFromAssumptions,
  parseLogicNetworkInitializedFromAssumptions,
  parseScheduleSettingsFromAssumptions,
  reconcileLogicLinksWithScheduleActivities,
  sanitizeScheduleAssumptionsForLineItems,
} from '../../estimating/scheduling/scheduleAssumptions';
import {
  calculateResourceHistogram,
  countOverallocatedDays,
  peakRequiredCrew,
} from '../../estimating/scheduling/resources/resourceHistogramCalculator';
import { resolveProjectAvailableCrewSize } from '../../estimating/scheduling/resources/projectAvailableCrewSize';

export interface ProjectChartsScheduleState {
  scheduleActivities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  scheduleSettings: ScheduleSettings;
  leveledOffsets: Record<string, number>;
  precedenceDiagram: PrecedenceDiagramState | null;
  cpmResult: CpmResult | null;
  cpmWarningMessage: string | null;
  availableCrewSize: number;
  resourceHistogram: ReturnType<typeof calculateResourceHistogram>;
}

export function extractProjectChartsScheduleState(input: {
  estimate: CurrentEstimate | null;
  constructionActivities: ProjectConstructionActivity[];
  projectCrewSize?: number | null;
}): ProjectChartsScheduleState {
  const empty: ProjectChartsScheduleState = {
    scheduleActivities: [],
    logicLinks: [],
    scheduleSettings: DEFAULT_SCHEDULE_SETTINGS,
    leveledOffsets: {},
    precedenceDiagram: null,
    cpmResult: null,
    cpmWarningMessage: null,
    availableCrewSize: resolveProjectAvailableCrewSize({ projectCrewSize: input.projectCrewSize }),
    resourceHistogram: [],
  };

  if (!input.estimate) return empty;

  const schedulingEnabled = resolveSchedulingEnabled(
    input.estimate.estimateType,
    input.estimate.schedulingEnabled,
  );
  const estimateSettings = parseEstimateSettingsFromAssumptions(input.estimate.assumptions);
  const lineItems = (input.estimate.lineItems ?? []) as EstimateDomainTask[];
  const scheduleBundle = resolveEstimateWorkspaceScheduleActivities({
    constructionActivities: input.constructionActivities,
    lineItems,
    estimateSettings,
    schedulingEnabled,
  });
  const scheduleActivities = scheduleBundle.activities;

  const sanitizedAssumptions = sanitizeScheduleAssumptionsForLineItems(
    input.estimate.assumptions,
    lineItems,
    scheduleActivities,
  );
  const scheduleSettings = parseScheduleSettingsFromAssumptions(sanitizedAssumptions);
  if (
    sanitizedAssumptions.scheduleSettings == null ||
    typeof sanitizedAssumptions.scheduleSettings !== 'object'
  ) {
    scheduleSettings.hoursPerDay = estimateSettings.hoursPerDay;
    scheduleSettings.availableCrewSize = DEFAULT_SCHEDULE_SETTINGS.availableCrewSize;
  }

  const parsedLinks = parseLogicLinksFromAssumptions(sanitizedAssumptions);
  const initialized = parseLogicNetworkInitializedFromAssumptions(sanitizedAssumptions);
  const hasLinksKey = hasLogicLinksKey(input.estimate.assumptions);
  const logicLinks =
    scheduleActivities.length > 0
      ? reconcileLogicLinksWithScheduleActivities(parsedLinks, scheduleActivities).links
      : initialized || hasLinksKey
        ? parsedLinks
        : [];

  const leveledOffsets = parseLeveledOffsetsFromAssumptions(sanitizedAssumptions);
  const precedenceDiagram =
    parsePrecedenceDiagramFromAssumptions(sanitizedAssumptions) ??
    parsePrecedenceDiagramFromAssumptions(input.estimate.assumptions as Record<string, unknown>) ??
    migratePrecedenceDiagramFromLegacyCpmCache({
      assumptions: input.estimate.assumptions as Record<string, unknown> | undefined,
      activities: scheduleActivities,
      logicLinks,
      scheduleSettings,
    });

  const recompute = recomputeCommittedCpmFromSavedState({
    precedenceDiagram,
    activities: scheduleActivities,
    logicLinks,
    scheduleSettings,
  });

  const availableCrewSize = resolveProjectAvailableCrewSize({
    projectCrewSize: input.projectCrewSize,
    legacyAvailableCrewSize: scheduleSettings.availableCrewSize,
  });

  const resourceHistogram =
    recompute.cpmResult?.hasRunCpm && scheduleActivities.length > 0
      ? calculateResourceHistogram({
          activities: scheduleActivities,
          cpmActivities: recompute.cpmResult.activities,
          projectStartDate: scheduleSettings.projectStartDate || getLocalDateYmd(),
          availableCrewSize,
          leveledOffsets,
          cpmResult: recompute.cpmResult,
        })
      : [];

  return {
    scheduleActivities,
    logicLinks,
    scheduleSettings,
    leveledOffsets,
    precedenceDiagram: recompute.precedenceDiagram,
    cpmResult: recompute.cpmResult,
    cpmWarningMessage: recompute.warningMessage,
    availableCrewSize,
    resourceHistogram,
  };
}

export function countScheduleActivitiesMissingLogic(
  scheduleActivities: ScheduleActivity[],
  logicLinks: CpmLogicLink[],
): number {
  if (scheduleActivities.length <= 1) return 0;
  if (logicLinks.length === 0) return scheduleActivities.length;

  const linked = new Set<string>();
  for (const link of logicLinks) {
    linked.add(link.predecessorActivityCode);
    linked.add(link.successorActivityCode);
  }

  return scheduleActivities.filter((activity) => !linked.has(activity.activityCode)).length;
}

export function countScheduledConstructionActivities(
  activities: ProjectConstructionActivity[],
): number {
  return activities.filter((activity) => activity.scheduleEnabled).length;
}

export { countOverallocatedDays, peakRequiredCrew };
