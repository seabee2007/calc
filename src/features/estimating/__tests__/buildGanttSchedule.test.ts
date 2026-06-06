import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { buildGanttSchedule } from '../schedule/buildGanttSchedule';
import {
  DUPLICATE_GANTT_CODES_MESSAGE,
  prepareGanttExport,
} from '../schedule/ganttExportValidation';

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
    scopeName: lineIndex === 2 ? 'Masonry Scope' : 'Concrete Scope',
    trade: lineIndex === 2 ? 'Masonry' : 'Concrete',
    activity: 'Work',
    position: lineIndex,
    lineItem: {
      ...input,
      csiDivision: lineIndex === 2 ? '04' : '03',
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

describe('buildGanttSchedule', () => {
  it('builds schedule from schedule-enabled line items', () => {
    const result = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          activityCode: '03-01-01',
          divisionCode: '03',
          divisionName: 'Concrete',
        }),
      ],
      projectStartDate: '2026-06-01',
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].activityCode).toBe('03-01-01');
    expect(result.activities[0].plannedStart).toBe('2026-06-01');
    expect(result.logicLinks).toHaveLength(0);
    expect(result.plannedDurationDays).toBeGreaterThan(0);
  });

  it('schedules FS successor after predecessor finish plus lag', () => {
    const result = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          id: 'pred',
          activityCode: '03-01-01',
          divisionCode: '03',
        }),
        buildTaskFromLine(1, {
          id: 'succ',
          activityCode: '03-01-02',
          divisionCode: '03',
          predecessorActivityCode: '03-01-01',
          relationshipType: 'FS',
          lagDays: 0,
          position: 1,
        }),
      ],
      projectStartDate: '2026-06-02',
    });

    const predecessor = result.activities.find((activity) => activity.activityCode === '03-01-01');
    const successor = result.activities.find((activity) => activity.activityCode === '03-01-02');

    expect(predecessor?.plannedFinish).toBeTruthy();
    expect(successor?.plannedStart).toBeTruthy();
    expect(successor!.plannedStart > predecessor!.plannedFinish).toBe(true);
    expect(result.logicLinks).toHaveLength(1);
    expect(result.logicLinks[0].relationshipType).toBe('FS');
  });

  it('applies lag days to FS relationships', () => {
    const noLag = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          activityCode: '03-01-01',
          divisionCode: '03',
        }),
        buildTaskFromLine(1, {
          activityCode: '03-01-02',
          divisionCode: '03',
          predecessorActivityCode: '03-01-01',
          relationshipType: 'FS',
          lagDays: 0,
          position: 1,
        }),
      ],
      projectStartDate: '2026-06-02',
    });

    const withLag = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          activityCode: '03-01-01',
          divisionCode: '03',
        }),
        buildTaskFromLine(1, {
          activityCode: '03-01-02',
          divisionCode: '03',
          predecessorActivityCode: '03-01-01',
          relationshipType: 'FS',
          lagDays: 2,
          position: 1,
        }),
      ],
      projectStartDate: '2026-06-02',
    });

    const noLagSuccessor = noLag.activities.find((activity) => activity.activityCode === '03-01-02');
    const lagSuccessor = withLag.activities.find((activity) => activity.activityCode === '03-01-02');

    expect(lagSuccessor!.plannedStart > noLagSuccessor!.plannedStart).toBe(true);
  });

  it('warns when predecessor code is missing from activities', () => {
    const result = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          activityCode: '03-01-01',
          divisionCode: '03',
          predecessorActivityCode: '99-99-99',
        }),
      ],
      projectStartDate: '2026-06-01',
    });

    expect(result.warnings.some((warning) => warning.includes('missing predecessor'))).toBe(true);
  });

  it('blocks prepareGanttExport when duplicate activity codes exist', () => {
    const prepared = prepareGanttExport({
      lineItems: [
        buildTaskFromLine(0, { activityCode: '03-01-01', divisionCode: '03' }),
        buildTaskFromLine(1, {
          activityCode: '03-01-01',
          divisionCode: '03',
          position: 1,
        }),
      ],
      projectStartDate: '2026-06-01',
    });

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error).toBe('duplicate_codes');
      expect(prepared.message).toBe(DUPLICATE_GANTT_CODES_MESSAGE);
      expect(prepared.duplicates).toEqual(['03-01-01']);
    }
  });

  it('warns on circular dependency', () => {
    const result = buildGanttSchedule({
      lineItems: [
        buildTaskFromLine(0, {
          activityCode: '03-01-01',
          divisionCode: '03',
          predecessorActivityCode: '03-01-02',
        }),
        buildTaskFromLine(1, {
          activityCode: '03-01-02',
          divisionCode: '03',
          predecessorActivityCode: '03-01-01',
          position: 1,
        }),
      ],
      projectStartDate: '2026-06-01',
    });

    expect(result.warnings.some((warning) => warning.includes('Circular dependency'))).toBe(true);
    expect(result.activities).toHaveLength(2);
  });

  it('auto-backfills missing codes during prepareGanttExport', () => {
    const prepared = prepareGanttExport({
      lineItems: [buildTaskFromLine(0, { activityCode: undefined, divisionCode: '03' })],
      projectStartDate: '2026-06-01',
    });

    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.schedule.activities[0].activityCode).toMatch(/^\d{2}-\d{2}-\d{2}$/);
    }
  });
});
