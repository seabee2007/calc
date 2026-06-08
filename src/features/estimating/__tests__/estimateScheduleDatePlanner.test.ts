import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateSchedulePlan } from '../domain/estimateScheduleTypes';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

const BASE_OPTIONS = {
  projectStartDate: '2026-06-09',
  dependencyMode: 'none' as const,
};

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

function allPlannedTasks(result: ReturnType<typeof planEstimateScheduleDates>) {
  return result.plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );
}

describe('planEstimateScheduleDates', () => {
  it('assigns start and end dates for one task', () => {
    const plan = buildPlan([buildTask(0)]);
    const result = planEstimateScheduleDates(plan, BASE_OPTIONS);
    const task = allPlannedTasks(result)[0];

    expect(task.plannedStartDate).toBe('2026-06-09');
    expect(task.plannedEndDate).toBeTruthy();
    expect(task.plannedStartDate <= task.plannedEndDate).toBe(true);
    expect(result.plannedProjectStart).toBe('2026-06-09');
    expect(result.plannedProjectFinish).toBe(task.plannedEndDate);
    expect(result.totalPlannedDurationDays).toBeGreaterThan(0);
  });

  it('chains tasks sequentially across the project', () => {
    const plan = buildPlan([
      buildTask(0, { position: 0 }),
      buildTask(1, { id: 'line-1', position: 1 }),
    ]);

    const result = planEstimateScheduleDates(plan, {
      ...BASE_OPTIONS,
      dependencyMode: 'sequential_by_project',
    });
    const tasks = allPlannedTasks(result);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].plannedStartDate).toBe('2026-06-09');
    expect(tasks[0].plannedEndDate).toBe('2026-06-09');
    expect(tasks[1].plannedStartDate).toBe('2026-06-10');
    expect(tasks[1].plannedStartDate > tasks[0].plannedEndDate).toBe(true);
  });

  it('chains tasks within each scope only', () => {
    const plan = buildPlan([
      buildTask(0, { position: 0, scopeName: 'Scope A' }),
      buildTask(1, { id: 'line-1', position: 0, scopeName: 'Scope B' }),
    ]);

    const result = planEstimateScheduleDates(plan, {
      ...BASE_OPTIONS,
      dependencyMode: 'sequential_by_scope',
    });
    const tasks = allPlannedTasks(result);

    expect(tasks[0].plannedStartDate).toBe('2026-06-09');
    expect(tasks[1].plannedStartDate).toBe('2026-06-09');
  });

  it('starts all tasks on the same day in none mode', () => {
    const plan = buildPlan([
      buildTask(0, { position: 0 }),
      buildTask(1, { id: 'line-1', position: 1 }),
    ]);

    const result = planEstimateScheduleDates(plan, BASE_OPTIONS);
    const tasks = allPlannedTasks(result);

    expect(tasks.every((task) => task.plannedStartDate === '2026-06-09')).toBe(true);
  });

  it('skips weekends by default when spanning multiple working days', () => {
    const plan = buildPlan([
      buildTask(0, {
        lineItem: {
          ...sampleEstimateVersion.lineItems[0],
          labor: {
            ...sampleEstimateVersion.lineItems[0].labor!,
            crewSize: 1,
            hoursPerDay: 8,
          },
        },
        calculatedValues: {
          metrics: {
            laborHours: 16,
            adjustedLaborHours: 16,
            manDays: 2,
            crewDays: 2,
            durationDays: 2,
          },
          costs: { directCost: 100 },
        },
      }),
    ]);

    const result = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-05',
      dependencyMode: 'none',
    });
    const task = allPlannedTasks(result)[0];

    expect(task.plannedStartDate).toBe('2026-06-05');
    expect(task.plannedEndDate).toBe('2026-06-08');
  });

  it('includes weekends when includeWeekends is true', () => {
    const plan = buildPlan([
      buildTask(0, {
        lineItem: {
          ...sampleEstimateVersion.lineItems[0],
          labor: {
            ...sampleEstimateVersion.lineItems[0].labor!,
            crewSize: 1,
            hoursPerDay: 8,
          },
        },
        calculatedValues: {
          metrics: {
            laborHours: 16,
            adjustedLaborHours: 16,
            manDays: 2,
            crewDays: 2,
            durationDays: 2,
          },
          costs: { directCost: 100 },
        },
      }),
    ]);

    const result = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-04',
      dependencyMode: 'none',
      includeWeekends: true,
    });
    const task = allPlannedTasks(result)[0];

    expect(task.plannedStartDate).toBe('2026-06-04');
    expect(task.plannedEndDate).toBe('2026-06-05');
  });

  it('uses a minimum duration of one day', () => {
    const plan = buildPlan([
      buildTask(0, {
        calculatedValues: {
          metrics: {
            laborHours: 0,
            adjustedLaborHours: 0,
            manDays: 0,
            crewDays: 0,
            durationDays: 0,
          },
          costs: { directCost: 100 },
        },
      }),
    ]);

    const result = planEstimateScheduleDates(plan, BASE_OPTIONS);
    const task = allPlannedTasks(result)[0];

    expect(task.plannedStartDate).toBe('2026-06-09');
    expect(task.plannedEndDate).toBe('2026-06-09');
    expect(result.warnings.some((warning) => warning.code === 'missing_duration')).toBe(true);
  });

  it('returns safe output for an empty plan', () => {
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

    const result = planEstimateScheduleDates(emptyPlan, BASE_OPTIONS);

    expect(result.plan.divisions).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.totalPlannedDurationDays).toBe(0);
    expect(result.plannedProjectStart).toBe('2026-06-09');
    expect(result.plannedProjectFinish).toBeNull();
  });

  it('does not mutate the input plan', () => {
    const plan = buildPlan([buildTask(0)]);
    const snapshot = JSON.parse(JSON.stringify(plan));

    planEstimateScheduleDates(plan, {
      ...BASE_OPTIONS,
      dependencyMode: 'sequential_by_project',
    });

    expect(plan).toEqual(snapshot);
    expect(plan.divisions[0]?.scopes[0]?.tasks[0]?.plannedStartDate).toBeNull();
  });
});
