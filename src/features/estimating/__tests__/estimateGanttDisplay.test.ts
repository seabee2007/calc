import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  buildGanttTimelineRange,
  calculateGanttBarPosition,
  calculateGanttTodayMarkerPosition,
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  extractGanttTasksFromPlan,
  formatGanttDateLabel,
  getGanttTaskRows,
  hasPlannedGanttTasks,
  isTodayWithinGanttRange,
  type GanttTaskInput,
} from '../ui/estimateGanttDisplay';
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

function buildPlannedPlan(taskCount = 2) {
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
  });
}

describe('buildGanttTimelineRange', () => {
  it('builds a timeline from earliest start to latest finish', () => {
    const tasks: GanttTaskInput[] = [
      {
        candidateId: 'a',
        title: 'Task A',
        plannedStartDate: '2026-06-10',
        plannedEndDate: '2026-06-12',
        durationDays: 3,
        weatherSensitive: false,
        inspectionRequired: false,
        divisionKey: '03',
        divisionLabel: 'Concrete',
        scopeKey: 'scope-a',
        scopeLabel: 'Scope A',
      },
      {
        candidateId: 'b',
        title: 'Task B',
        plannedStartDate: '2026-06-09',
        plannedEndDate: '2026-06-15',
        durationDays: 5,
        weatherSensitive: false,
        inspectionRequired: false,
        divisionKey: '03',
        divisionLabel: 'Concrete',
        scopeKey: 'scope-a',
        scopeLabel: 'Scope A',
      },
    ];

    const range = buildGanttTimelineRange(tasks);

    expect(range.isEmpty).toBe(false);
    expect(range.startDate).toBe('2026-06-09');
    expect(range.endDate).toBe('2026-06-15');
    expect(range.totalDays).toBe(7);
    expect(range.dayDates[0]).toBe('2026-06-09');
    expect(range.dayDates[range.dayDates.length - 1]).toBe('2026-06-15');
  });

  it('returns safe empty output when input has no dated tasks', () => {
    const range = buildGanttTimelineRange([
      {
        candidateId: 'a',
        title: 'Task A',
        plannedStartDate: null,
        plannedEndDate: null,
        durationDays: 1,
        weatherSensitive: false,
        inspectionRequired: false,
        divisionKey: '03',
        divisionLabel: 'Concrete',
        scopeKey: 'scope-a',
        scopeLabel: 'Scope A',
      },
    ]);

    expect(range.isEmpty).toBe(true);
    expect(range.totalDays).toBe(0);
    expect(range.dayDates).toEqual([]);
  });
});

describe('calculateGanttBarPosition', () => {
  it('calculates bar left offset and width from planned dates', () => {
    const position = calculateGanttBarPosition(
      {
        plannedStartDate: '2026-06-10',
        plannedEndDate: '2026-06-12',
        durationDays: 3,
      },
      '2026-06-09',
      DEFAULT_GANTT_COLUMN_WIDTH_PX,
    );

    expect(position).not.toBeNull();
    expect(position?.dayOffset).toBe(1);
    expect(position?.spanDays).toBe(3);
    expect(position?.leftPx).toBe(DEFAULT_GANTT_COLUMN_WIDTH_PX);
    expect(position?.widthPx).toBe(DEFAULT_GANTT_COLUMN_WIDTH_PX * 3);
    expect(position?.showDurationLabel).toBe(true);
  });

  it('skips tasks with missing dates safely', () => {
    const position = calculateGanttBarPosition(
      {
        plannedStartDate: null,
        plannedEndDate: '2026-06-12',
        durationDays: 1,
      },
      '2026-06-09',
      DEFAULT_GANTT_COLUMN_WIDTH_PX,
    );

    expect(position).toBeNull();
  });
});

describe('today marker helpers', () => {
  it('detects when today is within the timeline range', () => {
    const range = buildGanttTimelineRange([
      {
        candidateId: 'a',
        title: 'Task A',
        plannedStartDate: '2026-06-09',
        plannedEndDate: '2026-06-12',
        durationDays: 4,
        weatherSensitive: false,
        inspectionRequired: false,
        divisionKey: '03',
        divisionLabel: 'Concrete',
        scopeKey: 'scope-a',
        scopeLabel: 'Scope A',
      },
    ]);

    expect(isTodayWithinGanttRange(range, '2026-06-10')).toBe(true);
    expect(isTodayWithinGanttRange(range, '2026-06-01')).toBe(false);
    expect(isTodayWithinGanttRange(range, '2026-06-20')).toBe(false);
  });

  it('calculates today marker position without NaN', () => {
    const marker = calculateGanttTodayMarkerPosition(
      '2026-06-09',
      DEFAULT_GANTT_COLUMN_WIDTH_PX,
      '2026-06-10',
    );

    expect(marker).not.toBeNull();
    expect(Number.isFinite(marker)).toBe(true);
    expect(marker).toBe(DEFAULT_GANTT_COLUMN_WIDTH_PX + DEFAULT_GANTT_COLUMN_WIDTH_PX / 2);
  });
});

describe('getGanttTaskRows', () => {
  it('preserves division and scope order from the planned plan', () => {
    const datePlanResult = buildPlannedPlan(2);
    const rows = getGanttTaskRows(datePlanResult.plan);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.kind).toBe('division');
    expect(rows.some((row) => row.kind === 'scope')).toBe(true);

    const taskRows = rows.filter((row) => row.kind === 'task');
    expect(taskRows.length).toBe(2);

    const divisionLabels = rows.filter((row) => row.kind === 'division').map((row) => row.label);
    const scopeLabels = rows.filter((row) => row.kind === 'scope').map((row) => row.label);
    expect(divisionLabels[0]).toBeTruthy();
    expect(scopeLabels[0]).toBeTruthy();
  });
});

describe('planned gantt extraction', () => {
  it('extracts dated tasks from a planned schedule plan', () => {
    const datePlanResult = buildPlannedPlan(1);
    const tasks = extractGanttTasksFromPlan(datePlanResult.plan);

    expect(tasks.length).toBe(1);
    expect(tasks[0]?.plannedStartDate).toBe('2026-06-09');
    expect(tasks[0]?.plannedEndDate).toBeTruthy();
    expect(hasPlannedGanttTasks(datePlanResult.plan)).toBe(true);
  });

  it('returns false for plans without planned dates', () => {
    expect(hasPlannedGanttTasks(null)).toBe(false);
  });
});

describe('formatGanttDateLabel', () => {
  it('formats date labels safely and avoids NaN or Infinity', () => {
    const values = [
      formatGanttDateLabel('2026-06-09'),
      formatGanttDateLabel(''),
      formatGanttDateLabel('invalid'),
      formatGanttDateLabel('2026-13-01'),
    ];

    for (const value of values) {
      expect(value).not.toContain('NaN');
      expect(value).not.toContain('Infinity');
    }

    expect(formatGanttDateLabel('2026-06-09')).not.toBe(ESTIMATE_BLANK);
    expect(formatGanttDateLabel('')).toBe(ESTIMATE_BLANK);
  });
});

describe('calculateGanttBarPosition numeric safety', () => {
  it('does not return NaN or Infinity for invalid numeric input', () => {
    const position = calculateGanttBarPosition(
      {
        plannedStartDate: '2026-06-09',
        plannedEndDate: '2026-06-09',
        durationDays: Number.NaN,
      },
      '2026-06-09',
      Number.NaN,
    );

    expect(position).not.toBeNull();
    expect(Number.isFinite(position?.leftPx)).toBe(true);
    expect(Number.isFinite(position?.widthPx)).toBe(true);
  });
});
