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

  it('defaults to 7 when both are missing', () => {
    expect(
      resolveProjectAvailableCrewSize({
        projectCrewSize: undefined,
        legacyAvailableCrewSize: undefined,
      }),
    ).toBe(DEFAULT_PROJECT_CREW_SIZE);
  });
});
