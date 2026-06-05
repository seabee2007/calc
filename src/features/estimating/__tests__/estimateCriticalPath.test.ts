import { describe, expect, it } from 'vitest';
import { calculateEstimateCriticalPath } from '../application/estimateCriticalPath';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import type { EstimateScheduleDependencyPreview } from '../application/estimateScheduleDependencies';
import type { PlannedEstimateSchedulePlan } from '../application/estimateScheduleDatePlanner';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

function buildTask(
  lineIndex: number,
  overrides: Partial<EstimateDomainTask> = {},
): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[lineIndex];
  const input = sampleEstimateVersion.lineItems[lineIndex];

  return {
    id: `line-${lineIndex}`,
    lineType: 'task',
    title: input.description,
    description: input.description,
    scopeName: 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: lineIndex,
    lineItem: input,
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 10,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      quantityFormula: line.quantityFormula,
      metrics: line.metrics,
      costs: line.costs,
    },
    ...overrides,
  };
}

function buildVersion(lineItems: EstimateDomainTask[]): EstimateDomainVersion {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);

  return {
    id: 'ver-1',
    estimateId: 'est-1',
    projectId: 'proj-1',
    versionNumber: 1,
    versionName: 'Initial',
    estimateType: 'detailed',
    status: 'draft',
    snapshot,
    totals: snapshot.totals,
    notes: null,
    createdBy: null,
    createdAt: '2026-06-04T00:00:00.000Z',
    lineItems,
    warnings: [],
  };
}

function buildPlannedChain(taskCount = 3) {
  const lineItems = Array.from({ length: taskCount }, (_, index) =>
    buildTask(0, { id: `line-${index}`, position: index }),
  );
  const plan = buildEstimateSchedulePlan({
    version: buildVersion(lineItems),
    estimateId: 'est-1',
    projectId: 'proj-1',
    generatedAtIso: '2026-06-04T12:00:00.000Z',
  });
  const datePlanResult = planEstimateScheduleDates(plan, {
    projectStartDate: '2026-06-09',
    dependencyMode: 'sequential_by_project',
    includeWeekends: false,
  });

  const tasks = datePlanResult.plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );

  const dependencies: EstimateScheduleDependencyPreview[] = [];
  for (let index = 1; index < tasks.length; index += 1) {
    const predecessor = tasks[index - 1];
    const successor = tasks[index];
    dependencies.push({
      id: `estimate_preview:finish_to_start:${predecessor.candidateId}:${successor.candidateId}`,
      predecessorCandidateId: predecessor.candidateId,
      successorCandidateId: successor.candidateId,
      dependencyType: 'finish_to_start',
      lagDays: 0,
      source: 'estimate_preview',
    });
  }

  return { plan: datePlanResult.plan, dependencies, tasks };
}

function buildParallelBranchPlan(): {
  plan: PlannedEstimateSchedulePlan;
  dependencies: EstimateScheduleDependencyPreview[];
  taskAId: string;
  taskBId: string;
  taskCId: string;
} {
  const plan: PlannedEstimateSchedulePlan = {
    meta: {
      projectId: 'proj-1',
      estimateId: 'est-1',
      estimateVersionId: 'ver-1',
      estimateVersionNumber: 1,
      generatedAtIso: '2026-06-04T12:00:00.000Z',
      scheduleEnabledTaskCount: 3,
      excludedTaskCount: 0,
    },
    divisions: [
      {
        key: '03',
        label: 'Concrete',
        rollup: {
          itemCount: 3,
          durationDays: 10,
          laborHours: 0,
          manDays: 0,
          crewDays: 0,
        },
        scopes: [
          {
            key: 'scope-a',
            label: 'Scope A',
            divisionKey: '03',
            rollup: {
              itemCount: 3,
              durationDays: 10,
              laborHours: 0,
              manDays: 0,
              crewDays: 0,
            },
            tasks: [
              {
                candidateId: 'task-a',
                source: {
                  projectId: 'proj-1',
                  estimateId: 'est-1',
                  estimateVersionId: 'ver-1',
                  estimateVersionNumber: 1,
                  estimateLineItemId: 'line-a',
                  linePosition: 0,
                },
                divisionKey: '03',
                divisionLabel: 'Concrete',
                scopeKey: 'scope-a',
                scopeLabel: 'Scope A',
                title: 'Long branch',
                labor: {
                  laborHours: 40,
                  adjustedLaborHours: 40,
                  manDays: 5,
                  crewDays: 5,
                  durationDays: 5,
                  crewSize: 1,
                  hoursPerDay: 8,
                  parallelCrews: 1,
                },
                scheduleEnabled: true,
                weatherSensitive: false,
                inspectionRequired: false,
                plannedStartDate: '2026-06-09',
                plannedEndDate: '2026-06-13',
                sortOrder: 0,
                predecessorCandidateIds: [],
                suggestedDependencyType: null,
                warnings: [],
              },
              {
                candidateId: 'task-b',
                source: {
                  projectId: 'proj-1',
                  estimateId: 'est-1',
                  estimateVersionId: 'ver-1',
                  estimateVersionNumber: 1,
                  estimateLineItemId: 'line-b',
                  linePosition: 1,
                },
                divisionKey: '03',
                divisionLabel: 'Concrete',
                scopeKey: 'scope-a',
                scopeLabel: 'Scope A',
                title: 'Short branch',
                labor: {
                  laborHours: 16,
                  adjustedLaborHours: 16,
                  manDays: 2,
                  crewDays: 2,
                  durationDays: 2,
                  crewSize: 1,
                  hoursPerDay: 8,
                  parallelCrews: 1,
                },
                scheduleEnabled: true,
                weatherSensitive: false,
                inspectionRequired: false,
                plannedStartDate: '2026-06-09',
                plannedEndDate: '2026-06-10',
                sortOrder: 1,
                predecessorCandidateIds: [],
                suggestedDependencyType: null,
                warnings: [],
              },
              {
                candidateId: 'task-c',
                source: {
                  projectId: 'proj-1',
                  estimateId: 'est-1',
                  estimateVersionId: 'ver-1',
                  estimateVersionNumber: 1,
                  estimateLineItemId: 'line-c',
                  linePosition: 2,
                },
                divisionKey: '03',
                divisionLabel: 'Concrete',
                scopeKey: 'scope-a',
                scopeLabel: 'Scope A',
                title: 'Merge task',
                labor: {
                  laborHours: 8,
                  adjustedLaborHours: 8,
                  manDays: 1,
                  crewDays: 1,
                  durationDays: 1,
                  crewSize: 1,
                  hoursPerDay: 8,
                  parallelCrews: 1,
                },
                scheduleEnabled: true,
                weatherSensitive: false,
                inspectionRequired: false,
                plannedStartDate: '2026-06-14',
                plannedEndDate: '2026-06-14',
                sortOrder: 2,
                predecessorCandidateIds: [],
                suggestedDependencyType: null,
                warnings: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const dependencies: EstimateScheduleDependencyPreview[] = [
    {
      id: 'estimate_preview:finish_to_start:task-a:task-c',
      predecessorCandidateId: 'task-a',
      successorCandidateId: 'task-c',
      dependencyType: 'finish_to_start',
      lagDays: 0,
      source: 'estimate_preview',
    },
    {
      id: 'estimate_preview:finish_to_start:task-b:task-c',
      predecessorCandidateId: 'task-b',
      successorCandidateId: 'task-c',
      dependencyType: 'finish_to_start',
      lagDays: 0,
      source: 'estimate_preview',
    },
  ];

  return {
    plan,
    dependencies,
    taskAId: 'task-a',
    taskBId: 'task-b',
    taskCId: 'task-c',
  };
}

describe('calculateEstimateCriticalPath', () => {
  it('returns all tasks critical in a simple finish-to-start chain', () => {
    const { plan, dependencies, tasks } = buildPlannedChain(3);
    const result = calculateEstimateCriticalPath(plan, dependencies);

    expect(result.criticalTaskIds).toHaveLength(tasks.length);
    expect(result.projectStartDate).toBe('2026-06-09');
    expect(result.projectFinishDate).toBeTruthy();
    expect(result.projectDurationDays).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(result.totalFloatByTaskId[task.candidateId]).toBe(0);
    }
  });

  it('gives float to a shorter parallel branch', () => {
    const { plan, dependencies, taskAId, taskBId, taskCId } = buildParallelBranchPlan();
    const result = calculateEstimateCriticalPath(plan, dependencies);

    expect(result.criticalTaskIds).toContain(taskAId);
    expect(result.criticalTaskIds).toContain(taskCId);
    expect(result.criticalTaskIds).not.toContain(taskBId);
    expect(result.totalFloatByTaskId[taskBId]).toBeGreaterThan(0);
    expect(result.totalFloatByTaskId[taskAId]).toBe(0);
    expect(result.totalFloatByTaskId[taskCId]).toBe(0);
  });

  it('skips tasks with missing planned dates safely', () => {
    const { plan, dependencies } = buildPlannedChain(2);
    plan.divisions[0]!.scopes[0]!.tasks.push({
      ...plan.divisions[0]!.scopes[0]!.tasks[0]!,
      candidateId: 'missing-dates',
      plannedStartDate: '',
      plannedEndDate: '',
    });

    const result = calculateEstimateCriticalPath(plan, dependencies);
    expect(result.totalFloatByTaskId['missing-dates']).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === 'circular_dependencies')).toBe(false);
  });

  it('returns a safe warning when no dependencies exist', () => {
    const { plan } = buildPlannedChain(2);
    const result = calculateEstimateCriticalPath(plan, []);

    expect(result.warnings.some((warning) => warning.code === 'missing_dependencies')).toBe(true);
    expect(result.criticalTaskIds.length).toBeGreaterThan(0);
    expect(result.projectDurationDays).toBeGreaterThan(0);
  });

  it('returns a warning for circular dependencies', () => {
    const { plan } = buildPlannedChain(2);
    const tasks = plan.divisions[0]!.scopes[0]!.tasks;
    const dependencies: EstimateScheduleDependencyPreview[] = [
      {
        id: 'cycle-1',
        predecessorCandidateId: tasks[0]!.candidateId,
        successorCandidateId: tasks[1]!.candidateId,
        dependencyType: 'finish_to_start',
        lagDays: 0,
        source: 'estimate_preview',
      },
      {
        id: 'cycle-2',
        predecessorCandidateId: tasks[1]!.candidateId,
        successorCandidateId: tasks[0]!.candidateId,
        dependencyType: 'finish_to_start',
        lagDays: 0,
        source: 'estimate_preview',
      },
    ];

    const result = calculateEstimateCriticalPath(plan, dependencies);
    expect(result.warnings.some((warning) => warning.code === 'circular_dependencies')).toBe(true);
    expect(result.criticalTaskIds).toEqual([]);
  });

  it('does not return NaN or Infinity values', () => {
    const { plan, dependencies } = buildPlannedChain(2);
    const result = calculateEstimateCriticalPath(plan, dependencies);

    expect(Number.isFinite(result.projectDurationDays)).toBe(true);
    for (const value of Object.values(result.totalFloatByTaskId)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('does not mutate the input plan', () => {
    const { plan, dependencies } = buildPlannedChain(2);
    const before = JSON.stringify(plan);

    calculateEstimateCriticalPath(plan, dependencies);

    expect(JSON.stringify(plan)).toBe(before);
  });
});
