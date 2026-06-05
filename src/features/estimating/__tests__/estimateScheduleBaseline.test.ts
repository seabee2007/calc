import { describe, expect, it } from 'vitest';
import {
  buildEstimateScheduleBaseline,
  buildEstimateScheduleBaselineTaskMap,
} from '../application/estimateScheduleBaseline';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import type { PlannedEstimateSchedulePlan } from '../application/estimateScheduleDatePlanner';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

function buildTask(lineIndex = 0, overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
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

function buildPlannedPlan(taskCount = 2): PlannedEstimateSchedulePlan {
  const lineItems = Array.from({ length: taskCount }, (_, index) =>
    buildTask(0, { id: `line-${index}`, position: index }),
  );
  const plan = buildEstimateSchedulePlan({
    version: buildVersion(lineItems),
    estimateId: 'est-1',
    projectId: 'proj-1',
    generatedAtIso: '2026-06-04T12:00:00.000Z',
  });

  return planEstimateScheduleDates(plan, {
    projectStartDate: '2026-06-09',
    dependencyMode: 'sequential_by_project',
    includeWeekends: false,
  }).plan;
}

describe('buildEstimateScheduleBaseline', () => {
  it('builds a baseline from a planned schedule', () => {
    const plan = buildPlannedPlan(2);
    const baseline = buildEstimateScheduleBaseline(plan);

    expect(baseline.baselineId).toBe('estimate_schedule_baseline:ver-1');
    expect(baseline.estimateVersionId).toBe('ver-1');
    expect(baseline.generatedAtIso).toBe('2026-06-04T12:00:00.000Z');
    expect(baseline.projectStartDate).toBe('2026-06-09');
    expect(baseline.projectFinishDate).toBeTruthy();
    expect(baseline.taskBaselines).toHaveLength(2);
    expect(baseline.taskBaselines[0]?.baselineStartDate).toBeTruthy();
    expect(baseline.taskBaselines[0]?.baselineEndDate).toBeTruthy();
    expect(baseline.taskBaselines[0]?.estimateLineItemId).toBeTruthy();
    expect(baseline.taskBaselines[0]?.divisionKey).toBeTruthy();
    expect(baseline.taskBaselines[0]?.scopeKey).toBeTruthy();
  });

  it('skips tasks without planned dates', () => {
    const plan = buildPlannedPlan(1);
    plan.divisions[0]!.scopes[0]!.tasks.push({
      ...plan.divisions[0]!.scopes[0]!.tasks[0]!,
      candidateId: 'missing-dates',
      plannedStartDate: '',
      plannedEndDate: '',
    });

    const baseline = buildEstimateScheduleBaseline(plan);
    expect(baseline.taskBaselines).toHaveLength(1);
    expect(baseline.taskBaselines.some((task) => task.candidateId === 'missing-dates')).toBe(false);
  });

  it('returns a safe baseline for an empty plan', () => {
    const baseline = buildEstimateScheduleBaseline(null);

    expect(baseline.baselineId).toBe('');
    expect(baseline.taskBaselines).toEqual([]);
    expect(baseline.projectStartDate).toBeNull();
    expect(baseline.projectFinishDate).toBeNull();
    expect(baseline.totalDurationDays).toBe(0);
  });

  it('calculates baseline duration safely', () => {
    const plan = buildPlannedPlan(2);
    const baseline = buildEstimateScheduleBaseline(plan);

    expect(baseline.totalDurationDays).toBeGreaterThan(0);
    expect(Number.isFinite(baseline.totalDurationDays)).toBe(true);
    for (const task of baseline.taskBaselines) {
      expect(task.durationDays).toBeGreaterThan(0);
      expect(Number.isFinite(task.durationDays)).toBe(true);
    }
  });

  it('does not mutate the input plan', () => {
    const plan = buildPlannedPlan(2);
    const before = JSON.stringify(plan);

    buildEstimateScheduleBaseline(plan);

    expect(JSON.stringify(plan)).toBe(before);
  });

  it('does not return NaN or Infinity values', () => {
    const plan = buildPlannedPlan(2);
    const baseline = buildEstimateScheduleBaseline(plan);

    expect(Number.isFinite(baseline.totalDurationDays)).toBe(true);
    expect(String(baseline.totalDurationDays)).not.toContain('NaN');
    expect(String(baseline.totalDurationDays)).not.toContain('Infinity');

    for (const task of baseline.taskBaselines) {
      expect(Number.isFinite(task.durationDays)).toBe(true);
    }
  });

  it('builds a lookup map for baseline tasks', () => {
    const plan = buildPlannedPlan(2);
    const baseline = buildEstimateScheduleBaseline(plan);
    const map = buildEstimateScheduleBaselineTaskMap(baseline);

    expect(map.size).toBe(2);
    for (const task of baseline.taskBaselines) {
      expect(map.get(task.candidateId)?.baselineStartDate).toBe(task.baselineStartDate);
    }
  });
});
