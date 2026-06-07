import { describe, expect, it } from 'vitest';
import type { CpmLogicLink } from '../cpmTypes';
import { mapLogicLinksToEdges } from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import { sanitizeLogicLinksForActivities } from '../scheduleAssumptions';

const VALID_CODES = new Set(['A', 'B', 'C']);

describe('sanitizeLogicLinksForActivities', () => {
  it('drops links whose endpoints are not in the activity set', () => {
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'MISSING',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'GHOST',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];

    expect(sanitizeLogicLinksForActivities(links, VALID_CODES)).toEqual([
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ]);
  });

  it('returns empty array when all links reference missing codes', () => {
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'OLD-A',
        successorActivityCode: 'OLD-B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];
    expect(sanitizeLogicLinksForActivities(links, VALID_CODES)).toEqual([]);
  });
});

describe('mapLogicLinksToEdges', () => {
  it('produces no edges when sanitized links are empty', () => {
    expect(mapLogicLinksToEdges([], null)).toEqual([]);
  });

  it('maps valid links to edges with stable ids', () => {
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];
    const edges = mapLogicLinksToEdges(links, null);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.id).toBe('edge-A-B');
    expect(edges[0]?.source).toBe('node-A');
    expect(edges[0]?.target).toBe('node-B');
  });

  it('omits edges for links filtered out by activity sanitization', () => {
    const links: CpmLogicLink[] = [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
      },
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'MISSING',
        relationshipType: 'FS',
        lagDays: 0,
      },
    ];
    const sanitized = sanitizeLogicLinksForActivities(links, VALID_CODES);
    expect(mapLogicLinksToEdges(sanitized, null)).toHaveLength(1);
  });
});
