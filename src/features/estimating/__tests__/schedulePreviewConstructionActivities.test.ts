import { describe, expect, it } from 'vitest';
import { buildConstructionActivitySchedulePlan } from '../application/buildConstructionActivitySchedulePlan';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { buildConstructionActivityScheduleCandidateId } from '../application/estimateScheduleCandidateId';
import {
  collectSchedulePlanCandidates,
  extractSchedulePreviewSummary,
  hasSchedulableSchedulePreview,
} from '../ui/estimateScheduleDisplay';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'act-001',
    projectId: 'proj-001',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-30-01',
    title: 'Place Slab on Grade',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 42,
    calculatedManDays: 5.25,
    calculatedDurationDays: 2,
    effectiveDurationDays: 2,
    sortOrder: 1,
    ...overrides,
  };
}

function buildPlan(activities: ProjectConstructionActivity[]) {
  return buildConstructionActivitySchedulePlan({
    activities,
    estimateId: 'est-1',
    projectId: 'proj-1',
    estimateVersionId: 'ver-1',
    estimateVersionNumber: 1,
    generatedAtIso: '2026-06-10T12:00:00.000Z',
  });
}

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

function buildLegacyVersion(lineItems: EstimateDomainTask[]): EstimateDomainVersion {
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

describe('buildConstructionActivitySchedulePlan', () => {
  it('returns an empty plan when there are zero construction activities', () => {
    const plan = buildPlan([]);

    expect(plan.meta.scheduleEnabledTaskCount).toBe(0);
    expect(plan.meta.excludedTaskCount).toBe(0);
    expect(plan.divisions).toHaveLength(0);
    expect(hasSchedulableSchedulePreview(plan)).toBe(false);
  });

  it('excludes construction activities with scheduleEnabled false', () => {
    const plan = buildPlan([
      makeActivity({ id: 'enabled', scheduleEnabled: true }),
      makeActivity({
        id: 'disabled',
        activityCode: '03-30-02',
        scheduleEnabled: false,
      }),
    ]);

    const candidates = collectSchedulePlanCandidates(plan);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source.estimateLineItemId).toBe('enabled');
    expect(plan.meta.scheduleEnabledTaskCount).toBe(1);
    expect(plan.meta.excludedTaskCount).toBe(1);
  });

  it('includes schedule-enabled construction activities in grouped divisions', () => {
    const plan = buildPlan([
      makeActivity({ id: 'act-a', divisionCode: '03', divisionName: 'Concrete' }),
      makeActivity({
        id: 'act-b',
        activityCode: '04-10-01',
        divisionCode: '04',
        divisionName: 'Masonry',
        title: 'Install CMU',
      }),
    ]);

    expect(plan.divisions).toHaveLength(2);
    expect(collectSchedulePlanCandidates(plan)).toHaveLength(2);
    expect(
      collectSchedulePlanCandidates(plan).every((candidate) =>
        candidate.candidateId.startsWith('ver-1:ca:'),
      ),
    ).toBe(true);
  });

  it('calculates summary cards from construction activities only', () => {
    const plan = buildPlan([
      makeActivity({
        calculatedManHours: 40,
        calculatedManDays: 5,
        effectiveDurationDays: 2,
        crewSize: 4,
      }),
      makeActivity({
        id: 'act-002',
        activityCode: '03-30-02',
        scheduleEnabled: false,
        calculatedManHours: 999,
      }),
    ]);

    const summary = extractSchedulePreviewSummary(plan);
    expect(summary.schedulableTasks).toBe(1);
    expect(summary.excludedTasks).toBe(1);
    expect(summary.totalLaborHours).toBe(40);
    expect(summary.totalDurationDays).toBe(2);
  });

  it('does not include estimate line items in the construction activity plan', () => {
    const legacyPlan = buildEstimateSchedulePlan({
      version: buildLegacyVersion([buildTaskFromLine(0)]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });
    const constructionPlan = buildPlan([makeActivity()]);

    const legacyIds = collectSchedulePlanCandidates(legacyPlan).map(
      (candidate) => candidate.candidateId,
    );
    const constructionIds = collectSchedulePlanCandidates(constructionPlan).map(
      (candidate) => candidate.candidateId,
    );

    expect(legacyIds.some((id) => id.includes(':ca:'))).toBe(false);
    expect(constructionIds.every((id) => id.includes(':ca:'))).toBe(true);
    expect(constructionIds).toEqual([
      buildConstructionActivityScheduleCandidateId('ver-1', 'act-001'),
    ]);
  });

  it('updates draft preview dates when project start date changes', () => {
    const plan = buildPlan([makeActivity({ effectiveDurationDays: 3 })]);
    const first = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-10',
      dependencyMode: 'sequential_by_project',
      includeWeekends: false,
    });
    const second = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-20',
      dependencyMode: 'sequential_by_project',
      includeWeekends: false,
    });

    expect(first.plannedProjectStart).toBe('2026-06-10');
    expect(second.plannedProjectStart).toBe('2026-06-20');
    expect(second.plannedProjectFinish).not.toBe(first.plannedProjectFinish);
  });

  it('respects includeWeekends when planning draft preview dates', () => {
    const plan = buildPlan([makeActivity({ effectiveDurationDays: 2 })]);
    const weekdaysOnly = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-12',
      dependencyMode: 'none',
      includeWeekends: false,
    });
    const includeWeekends = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-12',
      dependencyMode: 'none',
      includeWeekends: true,
    });

    expect(weekdaysOnly.plannedProjectFinish).not.toBe(includeWeekends.plannedProjectFinish);
  });
});

describe('schedule preview source selection', () => {
  it('defaults to empty construction activity plan instead of legacy line items', () => {
    const legacyVersion = buildLegacyVersion([buildTaskFromLine(0), buildTaskFromLine(1)]);
    const legacyPlan = buildEstimateSchedulePlan({
      version: legacyVersion,
      estimateId: 'est-1',
      projectId: 'proj-1',
    });
    const defaultPlan = buildPlan([]);

    expect(collectSchedulePlanCandidates(legacyPlan).length).toBeGreaterThan(0);
    expect(collectSchedulePlanCandidates(defaultPlan)).toHaveLength(0);
  });

  it('uses legacy estimate schedule only when explicitly requested', () => {
    const constructionActivities: ProjectConstructionActivity[] = [];
    const useLegacyEstimateSchedule = true;
    const legacyAvailable = true;

    const shouldUseLegacy =
      constructionActivities.length === 0 &&
      useLegacyEstimateSchedule &&
      legacyAvailable;

    expect(shouldUseLegacy).toBe(true);

    const legacyPlan = buildEstimateSchedulePlan({
      version: buildLegacyVersion([buildTaskFromLine(0)]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });
    expect(hasSchedulableSchedulePreview(legacyPlan)).toBe(true);
  });
});
