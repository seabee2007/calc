import { describe, expect, it } from 'vitest';
import { calculateResourceHistogram } from '../resources/resourceHistogramCalculator';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult } from '../cpmTypes';

function makeAct(
  code: string,
  durationDays: number,
  crewSize: number,
): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function makeCpm(
  code: string,
  earlyStart: number,
  earlyFinish: number,
): CpmActivityResult {
  return {
    activityCode: code,
    earlyStart,
    earlyFinish,
    lateStart: earlyStart,
    lateFinish: earlyFinish,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: true,
  };
}

describe('calculateResourceHistogram', () => {
  it('returns empty when no activities', () => {
    const result = calculateResourceHistogram({
      activities: [],
      cpmActivities: [],
      projectStartDate: '2025-01-01',
      availableCrewSize: 10,
    });
    expect(result).toHaveLength(0);
  });

  it('sums crew sizes for each active day', () => {
    // A: days 0-2 (ES=0, EF=3, crew=3)
    // B: days 1-3 (ES=1, EF=4, crew=2) → overlap on days 1-2 = crew 5
    const activities = [makeAct('A', 3, 3), makeAct('B', 3, 2)];
    const cpmActivities = [makeCpm('A', 0, 3), makeCpm('B', 1, 4)];
    const result = calculateResourceHistogram({
      activities,
      cpmActivities,
      projectStartDate: '2025-01-01',
      availableCrewSize: 10,
    });
    expect(result[0].requiredCrew).toBe(3);  // day 0: only A
    expect(result[1].requiredCrew).toBe(5);  // day 1: A+B
    expect(result[2].requiredCrew).toBe(5);  // day 2: A+B
    expect(result[3].requiredCrew).toBe(2);  // day 3: only B
  });

  it('flags overallocation when required > available', () => {
    const activities = [makeAct('A', 3, 6), makeAct('B', 3, 6)];
    const cpmActivities = [makeCpm('A', 0, 3), makeCpm('B', 0, 3)];
    const result = calculateResourceHistogram({
      activities,
      cpmActivities,
      projectStartDate: '2025-01-01',
      availableCrewSize: 10,
    });
    expect(result[0].isOverallocated).toBe(true);
    expect(result[0].requiredCrew).toBe(12);
  });

  it('does not flag overallocation when within available', () => {
    const activities = [makeAct('A', 2, 4)];
    const cpmActivities = [makeCpm('A', 0, 2)];
    const result = calculateResourceHistogram({
      activities,
      cpmActivities,
      projectStartDate: '2025-01-01',
      availableCrewSize: 10,
    });
    expect(result.every((d) => !d.isOverallocated)).toBe(true);
  });

  it('applies leveled offsets', () => {
    const activities = [makeAct('A', 2, 5)];
    const cpmActivities = [makeCpm('A', 0, 2)];
    const result = calculateResourceHistogram({
      activities,
      cpmActivities,
      projectStartDate: '2025-01-01',
      availableCrewSize: 10,
      leveledOffsets: { A: 3 },
    });
    // A should now be active on days 3-4, not 0-1
    expect(result[0].requiredCrew).toBe(0);
    expect(result[3].requiredCrew).toBe(5);
  });
});
