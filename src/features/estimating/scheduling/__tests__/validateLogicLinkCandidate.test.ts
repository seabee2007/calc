import { describe, expect, it, vi } from 'vitest';
import type { CpmLogicLink } from '../cpmTypes';
import * as calculateCpmModule from '../cpm/calculateCpm';
import { validateLogicLinkCandidate } from '../logic/validateLogicLinkCandidate';

function link(
  pred: string,
  succ: string,
  relationshipType: CpmLogicLink['relationshipType'] = 'FS',
  lagDays = 0,
): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType,
    lagDays,
  };
}

const activities = [
  { activityCode: 'A', durationDays: 5 },
  { activityCode: 'B', durationDays: 5 },
  { activityCode: 'C', durationDays: 5 },
];

describe('validateLogicLinkCandidate', () => {
  it('accepts a valid link', () => {
    const result = validateLogicLinkCandidate({
      link: link('A', 'B'),
      activities,
      existingLinks: [],
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects invalid relationship type', () => {
    const result = validateLogicLinkCandidate({
      link: {
        ...link('A', 'B'),
        relationshipType: 'XX' as CpmLogicLink['relationshipType'],
      },
      activities,
      existingLinks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-relationship-type');
    }
  });

  it('rejects invalid lag days', () => {
    const result = validateLogicLinkCandidate({
      link: { ...link('A', 'B'), lagDays: Number.NaN },
      activities,
      existingLinks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-lag');
    }
  });

  it('rejects missing predecessor activity', () => {
    const result = validateLogicLinkCandidate({
      link: link('MISSING', 'B'),
      activities,
      existingLinks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-predecessor-activity');
    }
  });

  it('rejects missing successor activity', () => {
    const result = validateLogicLinkCandidate({
      link: link('A', 'MISSING'),
      activities,
      existingLinks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-successor-activity');
    }
  });

  it('rejects self links', () => {
    const result = validateLogicLinkCandidate({
      link: link('A', 'A'),
      activities,
      existingLinks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('self-link');
    }
  });

  it('rejects duplicate graph links', () => {
    const result = validateLogicLinkCandidate({
      link: link('A', 'B'),
      activities,
      existingLinks: [link('A', 'B', 'SS', 2)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('duplicate-link');
    }
  });

  it('rejects direct reverse links', () => {
    const result = validateLogicLinkCandidate({
      link: link('A', 'B'),
      activities,
      existingLinks: [link('B', 'A')],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('reverse-link');
    }
  });

  it('rejects links that would create a cycle against draft links', () => {
    const existingLinks = [link('A', 'B'), link('B', 'C')];
    const result = validateLogicLinkCandidate({
      link: link('C', 'A'),
      activities,
      existingLinks,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('would-create-cycle');
    }
  });

  it('rejects links that would over-constrain the network', () => {
    vi.spyOn(calculateCpmModule, 'calculateCpm').mockReturnValue({
      activities: [
        {
          activityCode: 'B',
          earlyStart: 10,
          earlyFinish: 15,
          lateStart: 8,
          lateFinish: 13,
          totalFloat: -2,
          freeFloat: 0,
          isCritical: false,
        },
      ],
      projectDurationDays: 15,
      criticalPathActivityCodes: ['B'],
      warnings: [],
    });

    const result = validateLogicLinkCandidate({
      link: link('A', 'B'),
      activities,
      existingLinks: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('would-over-constrain-network');
    }

    vi.restoreAllMocks();
  });
});
