import { describe, expect, it } from 'vitest';
import { constructionActivitiesToScheduleActivities } from '../adapters/constructionActivitiesToScheduleActivities';
import type { ProjectConstructionActivity } from '../../domain/constructionActivityTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    ...overrides,
  };
}

// ── Adapter output shape ───────────────────────────────────────────────────────

describe('constructionActivitiesToScheduleActivities — output shape', () => {
  it('maps a schedule-enabled activity to a ScheduleActivity', () => {
    const result = constructionActivitiesToScheduleActivities([makeActivity()]);
    expect(result.activities).toHaveLength(1);
    const act = result.activities[0];
    expect(act.activityCode).toBe('03-30-01');
    expect(act.activityDescription).toBe('Place Slab on Grade');
    expect(act.divisionCode).toBe('03');
    expect(act.divisionName).toBe('Concrete');
    expect(act.durationDays).toBe(2);
    expect(act.laborHours).toBe(42);
    expect(act.crewSize).toBe(4);
    expect(act.runtimeActivityId).toBe('act-001');
    expect(result.warnings).toHaveLength(0);
  });

  it('uses effectiveDurationDays (override-aware duration)', () => {
    const activity = makeActivity({
      calculatedDurationDays: 2,
      durationDaysOverride: 3,
      effectiveDurationDays: 3,
    });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].durationDays).toBe(3);
  });

  it('falls back to calculatedDurationDays when effectiveDurationDays is absent', () => {
    const activity = makeActivity({ effectiveDurationDays: undefined, calculatedDurationDays: 4 });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].durationDays).toBe(4);
  });

  it('rounds up fractional durations', () => {
    const activity = makeActivity({ effectiveDurationDays: 1.3 });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].durationDays).toBe(2);
  });

  it('uses runtimeActivityId equal to activity.id', () => {
    const activity = makeActivity({ id: 'unique-id-xyz' });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].runtimeActivityId).toBe('unique-id-xyz');
  });

  it('sets predecessorActivityCode to undefined — relationships come from logic links', () => {
    const { activities } = constructionActivitiesToScheduleActivities([makeActivity()]);
    expect(activities[0].predecessorActivityCode).toBeUndefined();
  });

  it('defaults relationshipType to FS', () => {
    const { activities } = constructionActivitiesToScheduleActivities([makeActivity()]);
    expect(activities[0].relationshipType).toBe('FS');
  });

  it('defaults lagDays to 0', () => {
    const { activities } = constructionActivitiesToScheduleActivities([makeActivity()]);
    expect(activities[0].lagDays).toBe(0);
  });
});

// ── Guardrails: scheduleEnabled filter ───────────────────────────────────────

describe('constructionActivitiesToScheduleActivities — scheduleEnabled filter', () => {
  it('excludes activities where scheduleEnabled === false', () => {
    const activity = makeActivity({ scheduleEnabled: false });
    const { activities } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities).toHaveLength(0);
  });

  it('includes only enabled activities from a mixed list', () => {
    const list = [
      makeActivity({ id: 'a1', activityCode: '03-30-01', scheduleEnabled: true }),
      makeActivity({ id: 'a2', activityCode: '03-30-02', scheduleEnabled: false }),
      makeActivity({ id: 'a3', activityCode: '03-30-03', scheduleEnabled: true }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(list);
    expect(activities).toHaveLength(2);
    expect(activities.map((a) => a.activityCode)).toEqual(['03-30-01', '03-30-03']);
  });

  it('returns empty result for empty input', () => {
    const result = constructionActivitiesToScheduleActivities([]);
    expect(result.activities).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty result when all activities are schedule-disabled', () => {
    const list = [
      makeActivity({ scheduleEnabled: false }),
      makeActivity({ scheduleEnabled: false }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(list);
    expect(activities).toHaveLength(0);
  });
});

// ── Warnings ─────────────────────────────────────────────────────────────────

describe('constructionActivitiesToScheduleActivities — warnings', () => {
  it('warns when duration is zero and defaults to 1 day', () => {
    const activity = makeActivity({
      calculatedDurationDays: 0,
      effectiveDurationDays: 0,
    });
    const { activities, warnings } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].durationDays).toBe(1);
    expect(warnings.some((w) => w.activityCode === '03-30-01')).toBe(true);
  });

  it('warns when crewSize is missing and defaults to 1', () => {
    const activity = makeActivity({ crewSize: 0 });
    const { activities, warnings } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities[0].crewSize).toBe(1);
    expect(warnings.some((w) => w.activityCode === '03-30-01')).toBe(true);
  });

  it('skips and warns on activities missing activityCode', () => {
    const activity = makeActivity({ activityCode: undefined, code: undefined });
    const { activities, warnings } = constructionActivitiesToScheduleActivities([activity]);
    expect(activities).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });
});

// ── Multi-activity rollup ─────────────────────────────────────────────────────

describe('constructionActivitiesToScheduleActivities — multiple activities', () => {
  it('converts all schedule-enabled activities in order', () => {
    const list = [
      makeActivity({ id: 'a1', activityCode: '31-23-01', title: 'Clear and Grub', divisionCode: '31' }),
      makeActivity({ id: 'a2', activityCode: '31-23-02', title: 'Excavate Footings', divisionCode: '31' }),
      makeActivity({ id: 'a3', activityCode: '03-30-01', title: 'Place Slab on Grade', divisionCode: '03' }),
    ];
    const { activities } = constructionActivitiesToScheduleActivities(list);
    expect(activities).toHaveLength(3);
    expect(activities.map((a) => a.activityCode)).toEqual(['31-23-01', '31-23-02', '03-30-01']);
  });

  it('aggregates warnings from all activities', () => {
    const list = [
      makeActivity({ id: 'a1', activityCode: '03-30-01', crewSize: 0, effectiveDurationDays: 0 }),
      makeActivity({ id: 'a2', activityCode: '03-30-02', crewSize: 0 }),
    ];
    const { warnings } = constructionActivitiesToScheduleActivities(list);
    // a1: duration warning + crew warning = 2; a2: crew warning = 1
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Backward compat: existing CPM data shape ─────────────────────────────────

describe('constructionActivitiesToScheduleActivities — CPM compatibility', () => {
  it('produces a result shape compatible with validateCpmReadiness input', () => {
    const result = constructionActivitiesToScheduleActivities([makeActivity()]);
    // validateCpmReadiness expects { activities: ScheduleActivity[], logicLinks: CpmLogicLink[] }
    // This test confirms the shape is correct without importing the validator
    expect(result).toHaveProperty('activities');
    expect(result).toHaveProperty('warnings');
    const act = result.activities[0];
    expect(typeof act.activityCode).toBe('string');
    expect(typeof act.durationDays).toBe('number');
    expect(typeof act.crewSize).toBe('number');
    expect(act.durationDays).toBeGreaterThanOrEqual(1);
    expect(act.crewSize).toBeGreaterThanOrEqual(1);
  });

  it('produces activityCodes usable as graph keys', () => {
    const result = constructionActivitiesToScheduleActivities([makeActivity()]);
    const act = result.activities[0];
    // getActivityGraphKey prefers runtimeActivityId
    const graphKey = act.runtimeActivityId ?? act.activityCode;
    expect(graphKey).toBe('act-001');
  });
});
