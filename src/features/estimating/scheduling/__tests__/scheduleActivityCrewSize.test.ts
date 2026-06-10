import { describe, expect, it } from 'vitest';
import { resolveScheduleActivityCrewSize } from '../resources/scheduleActivityCrewSize';

describe('resolveScheduleActivityCrewSize', () => {
  it('uses saved crew size when present and valid', () => {
    expect(
      resolveScheduleActivityCrewSize({
        crewSize: 7,
        laborHours: 616,
        manDays: 77,
        durationDays: 11,
        hoursPerDay: 8,
      }),
    ).toEqual({ crewSize: 7, source: 'saved' });
  });

  it('derives fallback crew from man-hours, duration, and hours per day', () => {
    expect(
      resolveScheduleActivityCrewSize({
        crewSize: 0,
        laborHours: 616,
        durationDays: 11,
        hoursPerDay: 8,
      }),
    ).toEqual({ crewSize: 7, source: 'fallback' });
  });

  it('rejects man-days misassigned as crew size and uses fallback instead', () => {
    expect(
      resolveScheduleActivityCrewSize({
        crewSize: 33,
        laborHours: 616,
        manDays: 33,
        durationDays: 11,
        hoursPerDay: 8,
      }),
    ).toEqual({ crewSize: 7, source: 'fallback' });
  });

  it('defaults to one crew when no labor or crew inputs exist', () => {
    expect(
      resolveScheduleActivityCrewSize({
        crewSize: 0,
        laborHours: 0,
        durationDays: 5,
      }),
    ).toEqual({ crewSize: 1, source: 'default' });
  });
});
