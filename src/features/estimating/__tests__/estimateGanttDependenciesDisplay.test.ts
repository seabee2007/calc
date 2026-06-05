import { describe, expect, it } from 'vitest';
import { buildFinishToStartDependenciesByProject } from '../application/estimateScheduleDependencies';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { planEstimateScheduleDates } from '../application/estimateScheduleDatePlanner';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateScheduleDependencyPreview } from '../application/estimateScheduleDependencies';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import {
  buildGanttTimelineRange,
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  extractGanttTasksFromPlan,
  getGanttTaskRows,
  type GanttRow,
  type GanttTimelineRange,
} from '../ui/estimateGanttDisplay';
import {
  buildGanttDependencyConnectors,
  formatDependencyTooltip,
  getTaskBarAnchorPoints,
  shouldDrawDependency,
} from '../ui/estimateGanttDependenciesDisplay';

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

function buildPlannedPreview(taskCount = 2) {
  const lineItems = Array.from({ length: taskCount }, (_, index) =>
    buildTask(0, {
      id: `line-${index}`,
      position: index,
      title: index === 0 ? 'Layout' : 'Excavation',
      description: index === 0 ? 'Layout' : 'Excavation',
    }),
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

  const dependencies = buildFinishToStartDependenciesByProject(plan);
  const rows = getGanttTaskRows(datePlanResult.plan, dependencies);
  const tasks = extractGanttTasksFromPlan(datePlanResult.plan);
  const range = buildGanttTimelineRange(tasks);

  return { datePlanResult, dependencies, rows, range };
}

function buildDependency(
  predecessorCandidateId: string,
  successorCandidateId: string,
): EstimateScheduleDependencyPreview {
  return {
    id: `estimate_preview:finish_to_start:${predecessorCandidateId}:${successorCandidateId}`,
    predecessorCandidateId,
    successorCandidateId,
    dependencyType: 'finish_to_start',
    lagDays: 0,
    source: 'estimate_preview',
  };
}

describe('buildGanttDependencyConnectors', () => {
  it('builds a connector from predecessor right edge to successor left edge', () => {
    const { dependencies, rows, range } = buildPlannedPreview(2);
    const connectors = buildGanttDependencyConnectors(dependencies, rows, range);

    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.startX).toBeLessThan(connectors[0]?.endX ?? 0);
    expect(connectors[0]?.path).toContain('M');
    expect(connectors[0]?.path).toContain('H');
    expect(connectors[0]?.path).toContain('V');
    expect(connectors[0]?.tooltip).toContain('→');
  });

  it('skips safely when predecessor row is missing', () => {
    const { dependencies, rows, range } = buildPlannedPreview(2);
    const missingPredecessor = buildDependency('missing-predecessor', dependencies[0]!.successorCandidateId);

    const connectors = buildGanttDependencyConnectors([missingPredecessor], rows, range);
    expect(connectors).toEqual([]);
  });

  it('skips safely when successor row is missing', () => {
    const { dependencies, rows, range } = buildPlannedPreview(2);
    const missingSuccessor = buildDependency(dependencies[0]!.predecessorCandidateId, 'missing-successor');

    const connectors = buildGanttDependencyConnectors([missingSuccessor], rows, range);
    expect(connectors).toEqual([]);
  });

  it('skips safely when task dates are missing', () => {
    const row: GanttRow = {
      id: 'task-1',
      kind: 'task',
      label: 'No dates',
      indentLevel: 2,
      task: {
        candidateId: 'task-1',
        title: 'No dates',
        plannedStartDate: null,
        plannedEndDate: null,
        durationDays: 1,
        weatherSensitive: false,
        inspectionRequired: false,
        divisionKey: '03',
        divisionLabel: 'Concrete',
        scopeKey: 'scope',
        scopeLabel: 'Scope',
      },
    };

    const range: GanttTimelineRange = {
      startDate: '2026-06-09',
      endDate: '2026-06-10',
      totalDays: 2,
      dayDates: ['2026-06-09', '2026-06-10'],
      isEmpty: false,
    };

    const dependency = buildDependency('task-1', 'task-2');
    const connectors = buildGanttDependencyConnectors([dependency], [row], range);

    expect(connectors).toEqual([]);
  });

  it('returns finite coordinates only', () => {
    const { dependencies, rows, range } = buildPlannedPreview(2);
    const connectors = buildGanttDependencyConnectors(dependencies, rows, range);

    for (const connector of connectors) {
      expect(Number.isFinite(connector.startX)).toBe(true);
      expect(Number.isFinite(connector.startY)).toBe(true);
      expect(Number.isFinite(connector.endX)).toBe(true);
      expect(Number.isFinite(connector.endY)).toBe(true);
      expect(connector.path).not.toContain('NaN');
      expect(connector.path).not.toContain('Infinity');
    }
  });

  it('returns empty connectors for empty dependencies', () => {
    const { rows, range } = buildPlannedPreview(2);
    expect(buildGanttDependencyConnectors([], rows, range)).toEqual([]);
  });
});

describe('getTaskBarAnchorPoints', () => {
  it('returns predecessor right and successor left anchor positions', () => {
    const { rows, range } = buildPlannedPreview(2);
    const taskRow = rows.find((row) => row.kind === 'task' && row.task);
    expect(taskRow).toBeTruthy();

    const anchors = getTaskBarAnchorPoints(taskRow!, 22, range, DEFAULT_GANTT_COLUMN_WIDTH_PX);
    expect(anchors).not.toBeNull();
    expect(anchors!.barRightPx).toBeGreaterThan(anchors!.barLeftPx);
    expect(Number.isFinite(anchors!.centerY)).toBe(true);
  });
});

describe('shouldDrawDependency', () => {
  it('returns false when predecessor anchors are missing', () => {
    const dependency = buildDependency('a', 'b');
    expect(shouldDrawDependency(dependency, null, {
      candidateId: 'b',
      title: 'B',
      centerY: 10,
      barLeftPx: 20,
      barRightPx: 40,
    })).toBe(false);
  });
});

describe('formatDependencyTooltip', () => {
  it('formats dependency tooltips safely', () => {
    expect(formatDependencyTooltip('Layout', 'Excavation')).toBe(
      'Layout → Excavation (finish-to-start)',
    );
    expect(formatDependencyTooltip('', '')).toBe('Task → Task (finish-to-start)');
    expect(formatDependencyTooltip('Layout', 'Excavation')).not.toContain('NaN');
    expect(formatDependencyTooltip('Layout', 'Excavation')).not.toContain('Infinity');
  });
});
