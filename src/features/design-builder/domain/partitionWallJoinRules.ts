import type { SegmentFrame } from "../geometry/designGeometry";
import type { DesignWallLayoutParameters } from "../types";

export type PartitionWallCourseEndpointTrim = {
  trimMeters: number;
  ownerCourseParity: 0 | 1;
};

export type PartitionWallCourseJoinTrim = {
  start?: PartitionWallCourseEndpointTrim;
  end?: PartitionWallCourseEndpointTrim;
};

type PartitionSegmentRef = {
  segment: DesignWallLayoutParameters["segments"][number];
  index: number;
  frame?: SegmentFrame;
};

function connectedDirectionAtNode(
  segment: DesignWallLayoutParameters["segments"][number],
  nodeId: string,
  nodesById: Map<string, { x: number; z: number }>,
): { x: number; z: number } | null {
  const start = nodesById.get(segment.startNodeId);
  const end = nodesById.get(segment.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return null;
  return segment.startNodeId === nodeId
    ? { x: dx / length, z: dz / length }
    : { x: -dx / length, z: -dz / length };
}

function isStraightThroughPartitionJoint(params: {
  refs: readonly PartitionSegmentRef[];
  nodeId: string;
  nodesById: Map<string, { x: number; z: number }>;
}): boolean {
  if (params.refs.length !== 2) return false;
  const directions = params.refs
    .map((ref) =>
      connectedDirectionAtNode(ref.segment, params.nodeId, params.nodesById),
    )
    .filter(
      (direction): direction is { x: number; z: number } => direction != null,
    );
  if (directions.length !== 2) return false;
  const dot =
    directions[0]!.x * directions[1]!.x + directions[0]!.z * directions[1]!.z;
  return dot < -0.95;
}

export function resolvePartitionWallCourseJoinTrims(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: readonly SegmentFrame[];
}): Map<string, PartitionWallCourseJoinTrim> {
  const trims = new Map<string, PartitionWallCourseJoinTrim>();
  const framesById = new Map(
    params.segmentFrames.map((frame) => [frame.segmentId, frame]),
  );
  const nodesById = new Map(
    params.layout.nodes.map((node) => [node.id, { x: node.x, z: node.z }]),
  );
  const refsByNodeId = new Map<string, PartitionSegmentRef[]>();

  params.layout.segments.forEach((segment, index) => {
    if (segment.wallRole !== "partition") return;
    const ref = { segment, index, frame: framesById.get(segment.id) };
    refsByNodeId.set(segment.startNodeId, [
      ...(refsByNodeId.get(segment.startNodeId) ?? []),
      ref,
    ]);
    refsByNodeId.set(segment.endNodeId, [
      ...(refsByNodeId.get(segment.endNodeId) ?? []),
      ref,
    ]);
  });

  refsByNodeId.forEach((refs, nodeId) => {
    if (refs.length < 2) return;
    if (isStraightThroughPartitionJoint({ refs, nodeId, nodesById })) return;

    const orderedRefs = [...refs].sort((a, b) => a.index - b.index);
    const incomingOwner =
      orderedRefs.find((ref) => ref.segment.endNodeId === nodeId) ??
      orderedRefs[0];
    if (!incomingOwner) return;

    orderedRefs.forEach((ref) => {
      const frame = ref.frame;
      const wallThicknessMeters =
        frame?.wallThicknessMeters ?? ref.segment.wallThicknessMeters ?? 0;
      const trimMeters = Math.max(0, wallThicknessMeters / 2);
      if (trimMeters <= 0) return;

      const current = trims.get(ref.segment.id) ?? {};
      const endpointTrim: PartitionWallCourseEndpointTrim = {
        trimMeters,
        ownerCourseParity:
          ref.segment.id === incomingOwner.segment.id ? 0 : 1,
      };
      if (ref.segment.startNodeId === nodeId) {
        current.start = endpointTrim;
      } else {
        current.end = endpointTrim;
      }
      trims.set(ref.segment.id, current);
    });
  });

  return trims;
}
