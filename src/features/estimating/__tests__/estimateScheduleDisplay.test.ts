import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import type { EstimateSchedulePlan } from '../domain/estimateScheduleTypes';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  extractScheduleDatePlanSummary,
  extractSchedulePreviewSummary,
  formatScheduleDurationDays,
  formatScheduleGroupLabel,
  formatScheduleLaborHours,
  formatSchedulePlannedDate,
  formatScheduleWarningLabel,
  formatScheduleWarningList,
} from '../ui/estimateScheduleDisplay';
import { ESTIMATE_BLANK } from '../ui/estimateFormatters';

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

function buildPlan(lineItems: EstimateDomainTask[]): EstimateSchedulePlan {
  return buildEstimateSchedulePlan({
    version: buildVersion(lineItems),
    estimateId: 'est-1',
    projectId: 'proj-1',
    generatedAtIso: '2026-06-04T12:00:00.000Z',
  });
}

describe('extractSchedulePreviewSummary', () => {
  it('extracts summary totals from a schedule plan', () => {
    const summary = extractSchedulePreviewSummary(buildPlan([buildTask(0), buildTask(1, { id: 'line-1', position: 1 })]));

    expect(summary.schedulableTasks).toBe(2);
    expect(summary.excludedTasks).toBe(0);
    expect(summary.totalLaborHours).toBeGreaterThan(0);
    expect(summary.totalManDays).toBeGreaterThan(0);
    expect(summary.totalCrewDays).toBeGreaterThan(0);
    expect(summary.totalDurationDays).toBeGreaterThan(0);
    expect(summary.schedulableTasksDisplay).toBe('2');
    expect(summary.totalLaborHoursDisplay).not.toBe(ESTIMATE_BLANK);
  });

  it('returns safe zeros for an empty plan', () => {
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

    const summary = extractSchedulePreviewSummary(emptyPlan);

    expect(summary.schedulableTasks).toBe(0);
    expect(summary.excludedTasks).toBe(0);
    expect(summary.totalLaborHours).toBe(0);
    expect(summary.totalManDays).toBe(0);
    expect(summary.totalCrewDays).toBe(0);
    expect(summary.totalDurationDays).toBe(0);
    expect(summary.totalLaborHoursDisplay).toBe(ESTIMATE_BLANK);
  });

  it('returns safe zeros when plan is null', () => {
    const summary = extractSchedulePreviewSummary(null);
    expect(summary.schedulableTasks).toBe(0);
    expect(summary.totalDurationDays).toBe(0);
  });
});

describe('formatScheduleWarningLabel', () => {
  it('formats known warning labels safely', () => {
    expect(formatScheduleWarningLabel('missing_duration')).toBe('Missing duration');
    expect(formatScheduleWarningLabel('weather_sensitive')).toBe('Weather sensitive');
  });

  it('formats warning lists with messages', () => {
    const lines = formatScheduleWarningList([
      { code: 'material_only_line', message: 'Line has no labor hours.' },
      { code: 'inspection_required', message: '' },
    ]);

    expect(lines[0]).toContain('Material only');
    expect(lines[0]).toContain('Line has no labor hours.');
    expect(lines[1]).toBe('Inspection required');
  });
});

describe('schedule display formatting', () => {
  it('does not return NaN or Infinity for labor and duration formatting', () => {
    const values = [
      formatScheduleLaborHours(Number.NaN),
      formatScheduleLaborHours(Number.POSITIVE_INFINITY),
      formatScheduleDurationDays(Number.NaN),
      formatScheduleDurationDays(Number.POSITIVE_INFINITY),
      formatScheduleDurationDays(-5),
    ];

    for (const value of values) {
      expect(value).not.toContain('NaN');
      expect(value).not.toContain('Infinity');
    }
  });

  it('displays group labels safely', () => {
    expect(formatScheduleGroupLabel('03', 'Concrete')).toBe('Concrete');
    expect(formatScheduleGroupLabel('03', '')).toBe('03');
    expect(formatScheduleGroupLabel('', '')).toBe(ESTIMATE_BLANK);
  });
});

describe('extractSchedulePreviewSummary excluded count', () => {
  it('includes excluded tasks from plan meta', () => {
    const plan = buildPlan([
      buildTask(0),
      buildTask(1, { id: 'line-1', position: 1, scheduleEnabled: false }),
    ]);

    const summary = extractSchedulePreviewSummary(plan);
    expect(summary.schedulableTasks).toBe(1);
    expect(summary.excludedTasks).toBe(1);
    expect(summary.excludedTasksDisplay).toBe('1');
  });
});

describe('formatSchedulePlannedDate', () => {
  it('formats valid planned dates safely', () => {
    const formatted = formatSchedulePlannedDate('2026-06-09');
    expect(formatted).not.toBe(ESTIMATE_BLANK);
    expect(formatted).toContain('2026');
    expect(formatted).not.toContain('NaN');
    expect(formatted).not.toContain('Infinity');
  });

  it('shows blank for empty planned dates', () => {
    expect(formatSchedulePlannedDate(null)).toBe(ESTIMATE_BLANK);
    expect(formatSchedulePlannedDate('')).toBe(ESTIMATE_BLANK);
    expect(formatSchedulePlannedDate('   ')).toBe(ESTIMATE_BLANK);
    expect(formatSchedulePlannedDate('not-a-date')).toBe(ESTIMATE_BLANK);
    expect(formatSchedulePlannedDate('2026-13-40')).toBe(ESTIMATE_BLANK);
  });
});

describe('extractScheduleDatePlanSummary', () => {
  it('formats planned schedule summary safely', () => {
    const plan = buildPlan([buildTask(0), buildTask(1, { id: 'line-1', position: 1 })]);
    const datePlanResult = planEstimateScheduleDates(plan, {
      projectStartDate: '2026-06-09',
      dependencyMode: 'sequential_by_project',
      includeWeekends: false,
    });

    const summary = extractScheduleDatePlanSummary(datePlanResult, plan);

    expect(summary.plannedProjectStartDisplay).not.toBe(ESTIMATE_BLANK);
    expect(summary.plannedProjectFinishDisplay).not.toBe(ESTIMATE_BLANK);
    expect(summary.totalPlannedDurationDaysDisplay).toContain('days');
    expect(summary.scheduledTaskCountDisplay).toBe('2');
    expect(summary.totalPlannedDurationDays).toBeGreaterThan(0);
  });

  it('returns safe output when date plan result is null', () => {
    const plan = buildPlan([buildTask(0)]);
    const summary = extractScheduleDatePlanSummary(null, plan);

    expect(summary.plannedProjectStartDisplay).toBe(ESTIMATE_BLANK);
    expect(summary.plannedProjectFinishDisplay).toBe(ESTIMATE_BLANK);
    expect(summary.totalPlannedDurationDaysDisplay).toBe(ESTIMATE_BLANK);
    expect(summary.scheduledTaskCountDisplay).toBe('1');
    expect(summary.excludedTaskCountDisplay).toBe('0');
  });

  it('does not return NaN or Infinity in summary displays', () => {
    const summary = extractScheduleDatePlanSummary(
      {
        plan: {
          meta: {
            projectId: 'proj-1',
            estimateId: 'est-1',
            estimateVersionId: 'ver-1',
            estimateVersionNumber: 1,
            generatedAtIso: '2026-06-04T12:00:00.000Z',
            scheduleEnabledTaskCount: 1,
            excludedTaskCount: 0,
          },
          divisions: [],
        },
        warnings: [],
        totalPlannedDurationDays: Number.NaN,
        plannedProjectStart: '2026-06-09',
        plannedProjectFinish: '2026-06-09',
      },
      null,
    );

    const displays = [
      summary.plannedProjectStartDisplay,
      summary.plannedProjectFinishDisplay,
      summary.totalPlannedDurationDaysDisplay,
      summary.scheduledTaskCountDisplay,
      summary.excludedTaskCountDisplay,
    ];

    for (const value of displays) {
      expect(value).not.toContain('NaN');
      expect(value).not.toContain('Infinity');
    }

    expect(summary.totalPlannedDurationDays).toBe(0);
    expect(summary.totalPlannedDurationDaysDisplay).toBe(ESTIMATE_BLANK);
  });
});
