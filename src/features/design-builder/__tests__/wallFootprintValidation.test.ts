import { describe, expect, it } from 'vitest';
import { createEmptyWallLayout } from '../domain/wallLayoutRules';
import {
  repairFootprintToExactOrthogonalRectangle,
  validateStrictOrthogonalFootprint,
} from '../domain/wallFootprintValidation';
import type { DesignWallLayoutParameters } from '../types';

function closedLayout(points: Array<{ id: string; x: number; z: number }>): DesignWallLayoutParameters {
  return {
    ...createEmptyWallLayout(),
    nodes: points,
    segments: [
      { id: 's0', startNodeId: points[0]!.id, endNodeId: points[1]!.id, wallHeightMeters: 2.8, wallThicknessMeters: 0.19, wallRole: 'exterior' },
      { id: 's1', startNodeId: points[1]!.id, endNodeId: points[2]!.id, wallHeightMeters: 2.8, wallThicknessMeters: 0.19, wallRole: 'exterior' },
      { id: 's2', startNodeId: points[2]!.id, endNodeId: points[3]!.id, wallHeightMeters: 2.8, wallThicknessMeters: 0.19, wallRole: 'exterior' },
      { id: 's3', startNodeId: points[3]!.id, endNodeId: points[0]!.id, wallHeightMeters: 2.8, wallThicknessMeters: 0.19, wallRole: 'exterior' },
    ],
    isFootprintClosed: true,
  };
}

describe('strict footprint validation and repair', () => {
  it('reports skewed closed rectangular footprint issues', () => {
    const layout = closedLayout([
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 15, z: 0 },
      { id: 'c', x: 15, z: 17.7 },
      { id: 'd', x: 0, z: 17.5 },
    ]);

    const codes = validateStrictOrthogonalFootprint(layout).map((warning) => warning.code);

    expect(codes).toContain('closed_footprint_non_orthogonal');
    expect(codes).toContain('opposite_wall_lengths_mismatch');
    expect(codes).toContain('opposite_wall_not_parallel');
    expect(codes).toContain('closure_corner_not_exact');
  });

  it('repairs a skewed four-sided footprint from the ordered segment loop', () => {
    const layout = closedLayout([
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 15, z: 0 },
      { id: 'c', x: 15, z: 17.7 },
      { id: 'd', x: 0, z: 17.5 },
    ]);

    const repaired = repairFootprintToExactOrthogonalRectangle({
      ...layout,
      nodes: [layout.nodes[2]!, layout.nodes[0]!, layout.nodes[3]!, layout.nodes[1]!],
    });

    expect(repaired).not.toBeNull();
    expect(validateStrictOrthogonalFootprint(repaired!)).toEqual([]);
    const repairedD = repaired!.nodes.find((node) => node.id === 'd')!;
    expect(repairedD.x).toBeCloseTo(0, 6);
    expect(repairedD.z).toBeCloseTo(17.7, 6);
  });
});
