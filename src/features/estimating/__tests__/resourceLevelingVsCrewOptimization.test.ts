import { describe, expect, it } from 'vitest';
import {
  CREW_OPTIMIZATION_BUTTON_LABEL,
  type ScheduleActivityCrewCompressionPolicy,
} from '../scheduling/crewOptimizationTypes';
import {
  CREW_OPTIMIZATION_FUTURE_NOTE,
  RESOURCE_LEVELING_BALANCED_MESSAGE,
  RESOURCE_LEVELING_SCOPE_NOTE,
} from '../ui/components/scheduling/resourceLevelingModalCopy';

describe('resource leveling vs crew optimization product distinction', () => {
  it('documents future crew compression fields without implementing optimization', () => {
    const policy: ScheduleActivityCrewCompressionPolicy = {
      canCompressWithCrew: true,
      minimumDurationDays: 1,
      maximumCrewSize: 12,
      productivityLossFactor: 1,
      compressionNotes: 'Labor-driven earthwork',
    };

    expect(policy.canCompressWithCrew).toBe(true);
    expect(CREW_OPTIMIZATION_BUTTON_LABEL).toBe('Optimize Crew Plan');
  });

  it('states resource leveling does not change crew or duration', () => {
    expect(RESOURCE_LEVELING_SCOPE_NOTE).toContain('does not change crew sizes');
    expect(RESOURCE_LEVELING_SCOPE_NOTE).toContain('shorten activity durations');
  });

  it('explains balanced schedule when demand is under available crew', () => {
    expect(RESOURCE_LEVELING_BALANCED_MESSAGE).toContain('within the available crew limit');
  });

  it('points crew acceleration to a separate future feature', () => {
    expect(CREW_OPTIMIZATION_FUTURE_NOTE).toContain('Optimize Crew Plan');
    expect(CREW_OPTIMIZATION_FUTURE_NOTE).toContain('not resource leveling');
  });
});
