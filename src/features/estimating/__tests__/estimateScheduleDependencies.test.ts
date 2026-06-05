import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import {
  applyDependencyPreviewToPlan,
  buildFinishToStartDependenciesByProject,
  buildFinishToStartDependenciesByScope,
} from '../application/estimateScheduleDependencies';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateSchedulePlan } from '../domain/estimateScheduleTypes';
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
    scopeName: lineIndex === 1 ? 'Formwork Scope' : 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: lineIndex,
    lineItem: {
      ...input,
      csiDivision: '03',
    },
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

function buildPlan(lineItems: EstimateDomainTask[]): EstimateSchedulePlan {
  return buildEstimateSchedulePlan({
    version: buildVersion(lineItems),
    estimateId: 'est-1',
    projectId: 'proj-1',
    generatedAtIso: '2026-06-04T12:00:00.000Z',
  });
}

function allTasks(plan: EstimateSchedulePlan) {
  return plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );
}

describe('buildFinishToStartDependenciesByProject', () => {
  it('creates a finish-to-start chain across all tasks', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
      buildTask(0, { id: 'line-2', title: 'Formwork', position: 2 }),
    ]);

    const dependencies = buildFinishToStartDependenciesByProject(plan);
    const tasks = allTasks(plan);

    expect(dependencies).toHaveLength(2);
    expect(dependencies[0]?.predecessorCandidateId).toBe(tasks[0]?.candidateId);
    expect(dependencies[0]?.successorCandidateId).toBe(tasks[1]?.candidateId);
    expect(dependencies[1]?.predecessorCandidateId).toBe(tasks[1]?.candidateId);
    expect(dependencies[1]?.successorCandidateId).toBe(tasks[2]?.candidateId);
    expect(dependencies[0]?.dependencyType).toBe('finish_to_start');
    expect(dependencies[0]?.lagDays).toBe(0);
    expect(dependencies[0]?.source).toBe('estimate_preview');
  });
});

describe('buildFinishToStartDependenciesByScope', () => {
  it('creates chains inside each scope only', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0, scopeName: 'Scope A' }),
      buildTask(0, {
        id: 'line-1',
        title: 'Excavation',
        position: 1,
        scopeName: 'Scope A',
      }),
      buildTask(0, {
        id: 'line-2',
        title: 'Formwork',
        position: 0,
        scopeName: 'Scope B',
      }),
      buildTask(0, {
        id: 'line-3',
        title: 'Pour',
        position: 1,
        scopeName: 'Scope B',
      }),
    ]);

    const dependencies = buildFinishToStartDependenciesByScope(plan);
    const scopeATasks = plan.divisions[0]?.scopes.find((scope) => scope.label.includes('Scope A'))
      ?.tasks;
    const scopeBTasks = plan.divisions[0]?.scopes.find((scope) => scope.label.includes('Scope B'))
      ?.tasks;

    expect(dependencies).toHaveLength(2);
    expect(dependencies[0]?.predecessorCandidateId).toBe(scopeATasks?.[0]?.candidateId);
    expect(dependencies[0]?.successorCandidateId).toBe(scopeATasks?.[1]?.candidateId);
    expect(dependencies[1]?.predecessorCandidateId).toBe(scopeBTasks?.[0]?.candidateId);
    expect(dependencies[1]?.successorCandidateId).toBe(scopeBTasks?.[1]?.candidateId);
  });
});

describe('applyDependencyPreviewToPlan', () => {
  it('returns no dependencies for none mode', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
    ]);

    const result = applyDependencyPreviewToPlan(plan, 'none');

    expect(result.dependencies).toEqual([]);
    expect(result.mode).toBe('none');
  });

  it('returns empty dependencies for an empty plan', () => {
    const emptyPlan: EstimateSchedulePlan = {
      meta: {
        projectId: 'proj-1',
        estimateId: 'est-1',
        estimateVersionId: 'ver-1',
        estimateVersionNumber: 1,
        generatedAtIso: '2026-06-04T12:00:00.000Z',
        scheduleEnabledTaskCount: 0,
        excludedTaskCount: 0,
      },
      divisions: [],
    };

    const result = applyDependencyPreviewToPlan(emptyPlan, 'finish_to_start_by_project');

    expect(result.dependencies).toEqual([]);
  });

  it('returns no dependencies for a single task', () => {
    const plan = buildPlan([buildTask(0, { title: 'Layout', position: 0 })]);

    const result = applyDependencyPreviewToPlan(plan, 'finish_to_start_by_project');

    expect(result.dependencies).toEqual([]);
  });

  it('uses stable dependency ids', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
    ]);
    const tasks = allTasks(plan);

    const first = applyDependencyPreviewToPlan(plan, 'finish_to_start_by_project');
    const second = applyDependencyPreviewToPlan(plan, 'finish_to_start_by_project');

    expect(first.dependencies[0]?.id).toBe(
      `estimate_preview:finish_to_start:${tasks[0]?.candidateId}:${tasks[1]?.candidateId}`,
    );
    expect(second.dependencies[0]?.id).toBe(first.dependencies[0]?.id);
  });

  it('does not mutate the input plan', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
    ]);
    const before = JSON.stringify(plan);

    applyDependencyPreviewToPlan(plan, 'finish_to_start_by_project');

    expect(JSON.stringify(plan)).toBe(before);
  });

  it('maps sequential planner control modes to preview modes', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
    ]);

    const byProject = applyDependencyPreviewToPlan(plan, 'sequential_by_project');
    const byScope = applyDependencyPreviewToPlan(plan, 'sequential_by_scope');

    expect(byProject.mode).toBe('finish_to_start_by_project');
    expect(byScope.mode).toBe('finish_to_start_by_scope');
    expect(byProject.dependencies).toHaveLength(1);
    expect(byScope.dependencies).toHaveLength(1);
  });

  it('works with planned schedule plans from date planning', () => {
    const plan = buildPlan([
      buildTask(0, { title: 'Layout', position: 0 }),
      buildTask(0, { id: 'line-1', title: 'Excavation', position: 1 }),
    ]);
    const planned = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-09',
      dependencyMode: 'sequential_by_project',
      includeWeekends: false,
    });

    const result = applyDependencyPreviewToPlan(
      planned.plan,
      'finish_to_start_by_project',
    );

    expect(result.dependencies).toHaveLength(1);
    expect(result.plan).not.toBe(planned.plan);
  });
});
