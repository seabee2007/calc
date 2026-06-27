import type { DesignGeometryResult } from "../geometry/designGeometry";
import type { StructuralBeam, StructuralColumn } from "../types";
import { beamSpanLengthMeters } from "./structuralFrameLayout";

export const DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS = 6;

export type DesignBuilderRcFrameSpanIssue = {
  beamId: string;
  beamKind: StructuralBeam["kind"];
  hostSegmentId: string | null;
  spanMeters: number;
  maxRecommendedSpanMeters: number;
  suggestedIntermediateSupportCount: number;
};

export type DesignBuilderRcFrameDebugSnapshot = {
  columnCount: number;
  footingCount: number;
  beamCount: number;
  maxRecommendedSpanMeters: number;
  longestBeamSpanMeters: number;
  longestRoofBeamSpanMeters: number;
  spanIssues: DesignBuilderRcFrameSpanIssue[];
  columns: Array<{
    id: string;
    hostNodeId: string | null;
    x: number;
    z: number;
  }>;
};

export function createDesignBuilderRcFrameDebugSnapshot(params: {
  geometryResult: DesignGeometryResult | null | undefined;
  maxRecommendedSpanMeters?: number;
}): DesignBuilderRcFrameDebugSnapshot {
  const geometry = params.geometryResult ?? null;
  const frameSystem = geometry?.frameSystem ?? null;
  const beams = frameSystem?.beams ?? [];
  const maxRecommendedSpanMeters =
    params.maxRecommendedSpanMeters ?? DEFAULT_RECOMMENDED_RC_FRAME_SPAN_METERS;

  return {
    columnCount: frameSystem?.columns.length ?? 0,
    footingCount: geometry?.isolatedFootings?.length ?? 0,
    beamCount: beams.length,
    maxRecommendedSpanMeters: round(maxRecommendedSpanMeters),
    longestBeamSpanMeters: round(longestSpan(beams)),
    longestRoofBeamSpanMeters: round(
      longestSpan(beams.filter((beam) => beam.kind === "roof_beam")),
    ),
    spanIssues: beams
      .map((beam) => spanIssueForBeam(beam, maxRecommendedSpanMeters))
      .filter(
        (issue): issue is DesignBuilderRcFrameSpanIssue => issue !== null,
      ),
    columns: (frameSystem?.columns ?? []).map(columnSummary),
  };
}

function spanIssueForBeam(
  beam: StructuralBeam,
  maxRecommendedSpanMeters: number,
): DesignBuilderRcFrameSpanIssue | null {
  const spanMeters = beamSpanLengthMeters(beam);
  if (spanMeters <= maxRecommendedSpanMeters) return null;
  return {
    beamId: beam.id,
    beamKind: beam.kind,
    hostSegmentId: beam.hostSegmentId ?? null,
    spanMeters: round(spanMeters),
    maxRecommendedSpanMeters: round(maxRecommendedSpanMeters),
    suggestedIntermediateSupportCount: Math.max(
      0,
      Math.ceil(spanMeters / maxRecommendedSpanMeters) - 1,
    ),
  };
}

function columnSummary(column: StructuralColumn) {
  return {
    id: column.id,
    hostNodeId: column.hostNodeId ?? null,
    x: round(column.position.x),
    z: round(column.position.z),
  };
}

function longestSpan(beams: readonly StructuralBeam[]): number {
  return beams.reduce(
    (longest, beam) => Math.max(longest, beamSpanLengthMeters(beam)),
    0,
  );
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
