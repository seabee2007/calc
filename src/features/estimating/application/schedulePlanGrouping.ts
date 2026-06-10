import {
  GENERAL_SCOPE_KEY,
  UNASSIGNED_DIVISION_KEY,
  emptyGroupRollup,
  type EstimateGroupRollup,
} from '../domain/estimateLineItemTree';
import { roundToTwo } from '../domain/estimateMath';
import type {
  EstimateScheduleGroup,
  EstimateScheduleScopeGroup,
  EstimateScheduleTaskCandidate,
} from '../domain/estimateScheduleTypes';
import { sortScheduleCandidatesBySortOrder } from './scheduleCandidateOrdering';

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

export function rollupFromScheduleCandidates(
  candidates: EstimateScheduleTaskCandidate[],
): EstimateGroupRollup {
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

/** Group flat schedule task candidates into division / scope hierarchy. */
export function groupScheduleCandidates(
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
        rollup: rollupFromScheduleCandidates(tasks),
      });
    }

    scopes.sort((a, b) => compareScopeKeys(a.key, b.key));

    const allScopeTasks = scopes.flatMap((scope) => scope.tasks);

    divisionGroups.push({
      key: division.key,
      label: division.label,
      scopes,
      rollup: rollupFromScheduleCandidates(allScopeTasks),
    });
  }

  divisionGroups.sort((a, b) => compareDivisionKeys(a.key, b.key));

  return divisionGroups;
}
