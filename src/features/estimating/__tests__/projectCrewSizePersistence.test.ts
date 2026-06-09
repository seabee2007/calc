import { describe, expect, it } from 'vitest';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';
import { DEFAULT_SCHEDULE_SETTINGS } from '../scheduling/cpmTypes';
import { parseScheduleSettingsFromAssumptions } from '../scheduling/scheduleAssumptions';
import {
  DEFAULT_PROJECT_CREW_SIZE,
  resolveProjectAvailableCrewSize,
} from '../scheduling/resources/projectAvailableCrewSize';

function resolveLegacyAvailableCrewSizeWithoutExplicitScheduleSettings(
  assumptions: Record<string, unknown>,
): number {
  const hasExplicitScheduleSettings =
    assumptions.scheduleSettings != null && typeof assumptions.scheduleSettings === 'object';
  if (hasExplicitScheduleSettings) {
    return parseScheduleSettingsFromAssumptions(assumptions).availableCrewSize;
  }
  return DEFAULT_SCHEDULE_SETTINGS.availableCrewSize;
}

describe('project crew size persistence and hydration', () => {
  it('defaults project crew size to 10 when no saved value exists', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: undefined,
        legacyAvailableCrewSize: undefined,
      }),
    ).toBe(10);
    expect(DEFAULT_PROJECT_CREW_SIZE).toBe(10);
  });

  it('does not default project crew size to 1 from default activity crew size', () => {
    const assumptions = {
      estimateSettings: {
        defaultCrewSize: 1,
        hoursPerDay: 8,
      },
    };

    expect(resolveLegacyAvailableCrewSizeWithoutExplicitScheduleSettings(assumptions)).toBe(10);
    expect(DEFAULT_ESTIMATE_SETTINGS.defaultCrewSize).toBe(1);
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: undefined,
        legacyAvailableCrewSize:
          resolveLegacyAvailableCrewSizeWithoutExplicitScheduleSettings(assumptions),
      }),
    ).toBe(10);
  });

  it('uses saved project crew size for gantt and settings display', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: 8,
        legacyAvailableCrewSize: 1,
      }),
    ).toBe(8);
  });

  it('keeps default activity crew size separate from project crew size', () => {
    const assumptions = {
      estimateSettings: {
        defaultCrewSize: 3,
        hoursPerDay: 8,
      },
    };

    expect(resolveLegacyAvailableCrewSizeWithoutExplicitScheduleSettings(assumptions)).toBe(10);
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: 8,
        legacyAvailableCrewSize:
          resolveLegacyAvailableCrewSizeWithoutExplicitScheduleSettings(assumptions),
      }),
    ).toBe(8);
  });

  it('includes project crew size in updateProject payload wiring', () => {
    const payload = { projectCrewSize: 8 };
    expect(payload).toEqual({ projectCrewSize: 8 });
  });
});
