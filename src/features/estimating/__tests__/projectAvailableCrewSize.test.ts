import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_CREW_SIZE,
  resolveProjectAvailableCrewSize,
} from '../scheduling/resources/projectAvailableCrewSize';

describe('resolveProjectAvailableCrewSize', () => {
  it('uses project crew size when present', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: 12,
        legacyAvailableCrewSize: 4,
      }),
    ).toBe(12);
  });

  it('falls back to legacy schedule available crew size', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: undefined,
        legacyAvailableCrewSize: 9,
      }),
    ).toBe(9);
  });

  it('defaults to 10 when both are missing', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: undefined,
        legacyAvailableCrewSize: undefined,
      }),
    ).toBe(DEFAULT_PROJECT_CREW_SIZE);
    expect(DEFAULT_PROJECT_CREW_SIZE).toBe(10);
  });

  it('does not treat legacy available crew size of 1 as activity default bleed-through when project crew is saved', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: 8,
        legacyAvailableCrewSize: 1,
      }),
    ).toBe(8);
  });
});
