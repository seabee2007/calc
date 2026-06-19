import { describe, expect, it } from 'vitest';
import {
  isDrivingRelationship,
  linkToEdge,
} from '../../ui/components/scheduling/EstimateLogicNetworkCanvas';
import { buildValidCpmDisplayFields, type CpmLogicLink, type CpmResult } from '../cpmTypes';

const RED = '#ef4444';
const AMBER = '#f59e0b';
const SLATE = '#64748b';

/**
 * All activities below are zero-float / critical. Dates encode a single clean
 * controlling chain A → B → C, with several extra links between critical
 * endpoints that are NOT driving (so they must stay non-red).
 */
function makeCpm(): CpmResult {
  const activities = [
    { activityCode: 'A', earlyStart: 0, earlyFinish: 3, lateStart: 0, lateFinish: 3, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'D', earlyStart: 0, earlyFinish: 3, lateStart: 0, lateFinish: 3, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'B', earlyStart: 3, earlyFinish: 6, lateStart: 3, lateFinish: 6, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'C', earlyStart: 6, earlyFinish: 10, lateStart: 6, lateFinish: 10, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'E', earlyStart: 0, earlyFinish: 4, lateStart: 0, lateFinish: 4, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'F', earlyStart: 4, earlyFinish: 8, lateStart: 4, lateFinish: 8, totalFloat: 0, freeFloat: 0, isCritical: true },
    { activityCode: 'G', earlyStart: 0, earlyFinish: 2, lateStart: 2, lateFinish: 4, totalFloat: 2, freeFloat: 2, isCritical: false },
  ];
  return {
    activities,
    projectDurationDays: 10,
    criticalPathActivityCodes: ['A', 'D', 'B', 'C', 'E', 'F'],
    warnings: [],
    ...buildValidCpmDisplayFields(['A', 'D', 'B', 'C', 'E', 'F'], {
      hasRunCpm: true,
      hasValidPrecedenceDiagram: true,
    }),
  };
}

function fs(pred: string, succ: string, lag = 0): CpmLogicLink {
  return { predecessorActivityCode: pred, successorActivityCode: succ, relationshipType: 'FS', lagDays: lag };
}

function edgeFor(link: CpmLogicLink, cpm: CpmResult, options?: { generated?: boolean }) {
  const finalLink = options?.generated ? { ...link, generated: true, source: 'resource_leveling' } : link;
  return linkToEdge(finalLink as CpmLogicLink, cpm, 'precedence-diagram');
}

function stroke(link: CpmLogicLink, cpm: CpmResult, options?: { generated?: boolean }): string {
  return edgeFor(link, cpm, options).style?.stroke as string;
}

describe('Resource-Leveled / CPM logic network critical edge classification', () => {
  const cpm = makeCpm();

  it('isDrivingRelationship is true only when the relationship leaves zero gap (FS)', () => {
    expect(isDrivingRelationship(cpm, fs('A', 'B'))).toBe(true); // B.ES 3 === A.EF 3
    expect(isDrivingRelationship(cpm, fs('A', 'C'))).toBe(false); // C.ES 6 !== A.EF 3
  });

  it('1. a link between two critical activities is NOT red unless it drives the target', () => {
    // A and C are both critical, but A→C is not driving (C starts at 6, A ends at 3).
    expect(stroke(fs('A', 'C'), cpm)).toBe(SLATE);
  });

  it('2. an FS critical edge requires target ES === source EF + lag', () => {
    expect(stroke(fs('A', 'B'), cpm)).toBe(RED); // driving
    expect(stroke(fs('B', 'C'), cpm)).toBe(RED); // driving
    expect(stroke(fs('A', 'B', 1), cpm)).toBe(SLATE); // lag breaks the tie (3 !== 3+1)
  });

  it('3. non-driving links between zero-float activities remain non-critical/muted', () => {
    // E (0–4) and B (3–6) are both critical, but E→B does not drive B.
    expect(stroke(fs('E', 'B'), cpm)).toBe(SLATE);
  });

  it('4. parallel critical paths are allowed when multiple predecessors truly drive a target', () => {
    // Both A (EF3) and D (EF3) drive B (ES3).
    expect(stroke(fs('A', 'B'), cpm)).toBe(RED);
    expect(stroke(fs('D', 'B'), cpm)).toBe(RED);
  });

  it('5. a resource dummy link is red only when it drives the leveled successor', () => {
    // E (EF4) drives F (ES4): driving dummy → red.
    expect(stroke(fs('E', 'F'), cpm, { generated: true })).toBe(RED);
    // G (EF2) does not drive F (ES4): non-driving dummy stays amber.
    expect(stroke(fs('G', 'F'), cpm, { generated: true })).toBe(AMBER);
  });

  it('SS / FF / SF relationships use the correct driving rule', () => {
    // B.ES 3, A.ES 0 → SS driving requires 3 === 0 + 3.
    expect(isDrivingRelationship(cpm, { predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'SS', lagDays: 3 })).toBe(true);
    expect(isDrivingRelationship(cpm, { predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'SS', lagDays: 0 })).toBe(false);
    // B.EF 6, A.EF 3 → FF driving requires 6 === 3 + 3.
    expect(isDrivingRelationship(cpm, { predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'FF', lagDays: 3 })).toBe(true);
    // B.EF 6, A.ES 0 → SF driving requires 6 === 0 + 6.
    expect(isDrivingRelationship(cpm, { predecessorActivityCode: 'A', successorActivityCode: 'B', relationshipType: 'SF', lagDays: 6 })).toBe(true);
  });

  it('edge data exposes onCriticalPath consistent with stroke', () => {
    const driving = edgeFor(fs('A', 'B'), cpm);
    const nonDriving = edgeFor(fs('A', 'C'), cpm);
    expect(driving.data?.onCriticalPath).toBe(true);
    expect(nonDriving.data?.onCriticalPath).toBe(false);
  });

  it('logic-network (live) mode never marks edges critical', () => {
    const edge = linkToEdge(fs('A', 'B'), cpm, 'logic-network');
    expect(edge.data?.onCriticalPath).toBe(false);
    expect(edge.style?.stroke).toBe(SLATE);
  });
});
