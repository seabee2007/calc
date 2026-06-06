import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import { isGanttExportReady } from '../schedule/ganttExportValidation';

function buildTaskFromLine(
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
    activity: 'Work',
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

describe('gantt export readiness', () => {
  it('is disabled when no schedule-enabled activities exist', () => {
    expect(
      isGanttExportReady({
        lineItems: [],
        plannedPlan: null,
      }),
    ).toBe(false);
  });

  it('is enabled when planned schedule has tasks', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([buildTaskFromLine(0, { activityCode: '03-01-01', divisionCode: '03' })]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });
    const datePlanResult = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-01',
      dependencyMode: 'none',
      includeWeekends: false,
    });

    expect(
      isGanttExportReady({
        lineItems: [buildTaskFromLine(0, { activityCode: '03-01-01', divisionCode: '03' })],
        plannedPlan: datePlanResult.plan,
      }),
    ).toBe(true);
  });
});
