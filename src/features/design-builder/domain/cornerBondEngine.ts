import type {
  DesignWallBondStrategy,
  DesignWallCornerType,
  DesignWallLayoutParameters,
  GeneratedWallCorner,
} from '../types';
import { createWallLayoutId } from './wallLayoutRules';

export function classifyCornerType(connectedSegmentCount: number): DesignWallCornerType {
  if (connectedSegmentCount <= 1) return 'end';
  if (connectedSegmentCount === 2) return 'outside';
  if (connectedSegmentCount === 3) return 'tee';
  return 'cross';
}

export function defaultBondStrategy(cornerType: DesignWallCornerType): DesignWallBondStrategy {
  if (cornerType === 'end') return 'butt';
  if (cornerType === 'inside') return 'interlock';
  if (cornerType === 'tee') return 'pilaster';
  if (cornerType === 'cross') return 'pilaster';
  return 'interlock';
}

export function generateWallCorners(layout: DesignWallLayoutParameters): GeneratedWallCorner[] {
  const degree = new Map<string, string[]>();
  layout.segments.forEach((segment) => {
    degree.set(segment.startNodeId, [...(degree.get(segment.startNodeId) ?? []), segment.id]);
    degree.set(segment.endNodeId, [...(degree.get(segment.endNodeId) ?? []), segment.id]);
  });

  return layout.nodes
    .map((node) => {
      const connectedWallSegmentIds = degree.get(node.id) ?? [];
      if (connectedWallSegmentIds.length === 0) return null;
      const cornerType = classifyCornerType(connectedWallSegmentIds.length);
      const override = layout.cornerOverrides.find((item) => item.nodeId === node.id);
      const bondStrategy = override?.bondStrategy ?? defaultBondStrategy(cornerType);
      return {
        id: createWallLayoutId('corner'),
        nodeId: node.id,
        connectedWallSegmentIds,
        cornerType,
        bondStrategy,
      } satisfies GeneratedWallCorner;
    })
    .filter((corner): corner is GeneratedWallCorner => corner != null);
}

export function cornerWarnings(corners: readonly GeneratedWallCorner[]): string[] {
  const warnings: string[] = [];
  corners.forEach((corner) => {
    if (corner.cornerType === 'outside' && corner.bondStrategy === 'butt') {
      warnings.push(`Node ${corner.nodeId} uses a butt corner on an exterior corner. Verify structural intent.`);
    }
    if (corner.cornerType === 'cross') {
      warnings.push(`Node ${corner.nodeId} has a cross intersection. Cross bond logic is conceptual in this milestone.`);
    }
  });
  return warnings;
}

export function reserveCornerBlockLength(
  bondStrategy: DesignWallBondStrategy,
  moduleLengthMeters: number,
): number {
  if (bondStrategy === 'interlock') return moduleLengthMeters;
  if (bondStrategy === 'pilaster') return moduleLengthMeters * 1.5;
  return 0;
}
