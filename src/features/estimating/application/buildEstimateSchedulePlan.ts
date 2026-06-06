import {
  GENERAL_SCOPE_KEY,
  UNASSIGNED_DIVISION_KEY,
  emptyGroupRollup,
  type EstimateGroupRollup,
} from '../domain/estimateLineItemTree';
import { roundToTwo } from '../domain/estimateMath';
import type {
  EstimateScheduleGroup,
  EstimateSchedulePlan,
  EstimateScheduleScopeGroup,
  EstimateScheduleTaskCandidate,
} from '../domain/estimateScheduleTypes';
import type { EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  mapEstimateTaskToScheduleCandidate,
  type MapEstimateTaskToScheduleCandidateContext,
} from './mapEstimateTaskToScheduleCandidate';
import { compareActivityCodes } from './estimateActivityCoding';
import { resolveEstimateSchedulePredecessors } from './resolveEstimateSchedulePredecessors';
import { sortScheduleCandidatesBySortOrder } from './scheduleCandidateOrdering';

export interface BuildEstimateSchedulePlanParams {
  version: EstimateDomainVersion;
  estimateId: string;
  projectId: string;
  generatedAtIso?: string;
}

function compareDivisionKeys(a: string, b: string): number {
  if (a === UNASSIGNED_DIVISION_KEY && b !== UNASSIGNED_DIVISION_KEY) return 1;
  if (b === UNASSIGNED_DIVISION_KEY && a !== UNASSIGNED_DIVISION_KEY) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function compareScopeKeys(a: string, b: string): number {
  if (a === GENERAL_SCOPE_KEY && b !== GENERAL_SCOPE_KEY) return 1;
  if (b === GENERAL_SCOPE_KEY && a !== GENERAL_SCOPE_KEY) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function isTaskRow(lineType: EstimateDomainVersion['lineItems'][number]['lineType']): boolean {
  return lineType === 'task' || lineType == null;
}

function rollupFromCandidates(candidates: EstimateScheduleTaskCandidate[]): EstimateGroupRollup {
  const rollup = emptyGroupRollup();

  for (const candidate of candidates) {
    rollup.itemCount += 1;
    rollup.laborHours = roundToTwo(
      rollup.laborHours + (candidate.labor.adjustedLaborHours || candidate.labor.laborHours),
    );
    rollup.manDays = roundToTwo(rollup.manDays + candidate.labor.manDays);
    rollup.crewDays = roundToTwo(rollup.crewDays + candidate.labor.crewDays);
    rollup.durationDays = roundToTwo(rollup.durationDays + candidate.labor.durationDays);
    if (candidate.scheduleEnabled) rollup.scheduleEnabledCount += 1;
    if (candidate.weatherSensitive) rollup.weatherSensitiveCount += 1;
    if (candidate.inspectionRequired) rollup.inspectionRequiredCount += 1;
  }

  return rollup;
}

function groupScheduleCandidates(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateScheduleGroup[] {
  if (candidates.length === 0) return [];

  const divisions = new Map<
    string,
    {
      key: string;
      label: string;
      scopes: Map<
        string,
        {
          key: string;
          label: string;
          divisionKey: string;
          tasks: EstimateScheduleTaskCandidate[];
        }
      >;
    }
  >();

  for (const candidate of candidates) {
    let division = divisions.get(candidate.divisionKey);
    if (!division) {
      division = {
        key: candidate.divisionKey,
        label: candidate.divisionLabel,
        scopes: new Map(),
      };
      divisions.set(candidate.divisionKey, division);
    }

    let scope = division.scopes.get(candidate.scopeKey);
    if (!scope) {
      scope = {
        key: candidate.scopeKey,
        label: candidate.scopeLabel,
        divisionKey: candidate.divisionKey,
        tasks: [],
      };
      division.scopes.set(candidate.scopeKey, scope);
    }

    scope.tasks.push(candidate);
  }

  const divisionGroups: EstimateScheduleGroup[] = [];

  for (const division of divisions.values()) {
    const scopes: EstimateScheduleScopeGroup[] = [];

    for (const scope of division.scopes.values()) {
      const tasks = sortScheduleCandidatesBySortOrder(scope.tasks);
      scopes.push({
        key: scope.key,
        label: scope.label,
        divisionKey: scope.divisionKey,
        tasks,
        rollup: rollupFromCandidates(tasks),
      });
    }

    scopes.sort((a, b) => compareScopeKeys(a.key, b.key));

    const allScopeTasks = scopes.flatMap((scope) => scope.tasks);

    divisionGroups.push({
      key: division.key,
      label: division.label,
      scopes,
      rollup: rollupFromCandidates(allScopeTasks),
    });
  }

  divisionGroups.sort((a, b) => compareDivisionKeys(a.key, b.key));

  return divisionGroups;
}

/** Build a grouped draft schedule plan from a saved estimate version. */
export function buildEstimateSchedulePlan(
  params: BuildEstimateSchedulePlanParams,
): EstimateSchedulePlan {
  const { version, estimateId, projectId } = params;
  const taskRows = version.lineItems.filter((task) => isTaskRow(task.lineType));
  const includedTasks = taskRows
    .filter((task) => task.scheduleEnabled)
    .sort(
      (left, right) =>
        compareActivityCodes(left.activityCode, right.activityCode) ||
        left.position - right.position,
    );
  const excludedTaskCount = taskRows.filter((task) => !task.scheduleEnabled).length;

  const context: MapEstimateTaskToScheduleCandidateContext = {
    projectId,
    estimateId,
    estimateVersionId: version.id,
    estimateVersionNumber: version.versionNumber,
  };

  const candidates = includedTasks.map((task) =>
    mapEstimateTaskToScheduleCandidate(task, context),
  );

  const preliminaryPlan: EstimateSchedulePlan = {
    meta: {
      projectId,
      estimateId,
      estimateVersionId: version.id,
      estimateVersionNumber: version.versionNumber,
      generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
      scheduleEnabledTaskCount: candidates.length,
      excludedTaskCount,
    },
    divisions: groupScheduleCandidates(candidates),
  };

  return resolveEstimateSchedulePredecessors(preliminaryPlan).plan;
}

/** Empty plan helper for tests and edge cases. */
export function emptyEstimateSchedulePlan(
  params: Pick<BuildEstimateSchedulePlanParams, 'estimateId' | 'projectId'> & {
    estimateVersionId?: string;
    estimateVersionNumber?: number;
    generatedAtIso?: string;
  },
): EstimateSchedulePlan {
  return {
    meta: {
      projectId: params.projectId,
      estimateId: params.estimateId,
      estimateVersionId: params.estimateVersionId ?? '',
      estimateVersionNumber: params.estimateVersionNumber ?? 0,
      generatedAtIso: params.generatedAtIso ?? new Date().toISOString(),
      scheduleEnabledTaskCount: 0,
      excludedTaskCount: 0,
    },
    divisions: [],
  };
}
