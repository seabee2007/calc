import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { roundToTwo } from '../domain/estimateMath';
import {
  sampleEstimateVersion,
  sampleExpectedDivisionTotals,
  sampleExpectedLineDirectCosts,
  sampleExpectedScopeTotals,
  sampleExpectedSnapshotTotals,
} from '../__fixtures__/sampleEstimateVersion';

describe('buildEstimateSnapshot', () => {
  it('builds expected line-level and overall totals from fixture data', () => {
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.lineItems).toHaveLength(3);
    expect(snapshot.totals).toEqual(sampleExpectedSnapshotTotals);
    expect(snapshot.lineItems.find((line) => line.id === 'slab_pour')?.costs.directCost).toBe(
      sampleExpectedLineDirectCosts.slab_pour,
    );
    expect(snapshot.lineItems.find((line) => line.id === 'wall_formwork')?.costs.directCost).toBe(
      sampleExpectedLineDirectCosts.wall_formwork,
    );
    expect(snapshot.lineItems.find((line) => line.id === 'grout_fill')?.costs.directCost).toBe(
      sampleExpectedLineDirectCosts.grout_fill,
    );
  });

  it('keeps direct totals, division totals, and scope totals consistent with task sums', () => {
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);

    const summedLineDirectCost = roundToTwo(
      snapshot.lineItems.reduce((sum, line) => sum + line.costs.directCost, 0),
    );
    expect(snapshot.totals.directCost).toBe(summedLineDirectCost);

    const divisionTotals = snapshot.lineItems.reduce<Record<string, number>>((totals, line) => {
      const key = line.csiDivision ?? 'UNASSIGNED_DIVISION';
      const nextValue = (totals[key] ?? 0) + line.costs.directCost;
      totals[key] = roundToTwo(nextValue);
      return totals;
    }, {});

    const scopeTotals = snapshot.lineItems.reduce<Record<string, number>>((totals, line) => {
      const key = line.csiSection ?? 'UNASSIGNED_SCOPE';
      const nextValue = (totals[key] ?? 0) + line.costs.directCost;
      totals[key] = roundToTwo(nextValue);
      return totals;
    }, {});

    expect(divisionTotals).toEqual(sampleExpectedDivisionTotals);
    expect(scopeTotals).toEqual(sampleExpectedScopeTotals);
    expect(roundToTwo(Object.values(divisionTotals).reduce((sum, value) => sum + value, 0))).toBe(
      snapshot.totals.directCost,
    );
    expect(roundToTwo(Object.values(scopeTotals).reduce((sum, value) => sum + value, 0))).toBe(
      snapshot.totals.directCost,
    );
  });
});
