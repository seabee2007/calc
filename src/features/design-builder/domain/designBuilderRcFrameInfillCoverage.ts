import type { SegmentFrame, DesignGeometryResult } from "../geometry/designGeometry";
import type { CmuInfillPanel, StructuralBeam } from "../types";

export type DesignBuilderRcFrameExpectedInfillBaySummary = {
  bayId: string;
  hostSegmentId: string;
  bayIndex: number;
  startStationMeters: number;
  endStationMeters: number;
  clearWidthMeters: number;
  matchedPanelId: string | null;
  matchedBoundsPanelId: string | null;
  nearestPanelId: string | null;
  nearestPanelStationMismatchMeters: number | null;
};

export type DesignBuilderRcFrameInfillPanelCoverage = {
  panelId: string;
  hostSegmentId: string;
  matchedExpectedBayId: string | null;
  nearestExpectedBayId: string | null;
  nearestExpectedBayStationMismatchMeters: number | null;
};

export type DesignBuilderRcFrameInfillBoundsCoverage = {
  panelId: string;
  hostSegmentId: string;
  matchedExpectedBayId: string | null;
  nearestExpectedBayId: string | null;
  nearestExpectedBayStationMismatchMeters: number | null;
};

export type DesignBuilderRcFrameInfillCoverage = {
  expectedAboveGradeBays: DesignBuilderRcFrameExpectedInfillBaySummary[];
  panelCoverage: DesignBuilderRcFrameInfillPanelCoverage[];
  boundsCoverage: DesignBuilderRcFrameInfillBoundsCoverage[];
};

export function createDesignBuilderRcFrameInfillCoverage(params: {
  geometry: DesignGeometryResult | null;
  aboveGradePanels: readonly CmuInfillPanel[];
  aboveGradeBounds: readonly {
    panelId: string;
    hostSegmentId: string;
    startStationMeters: number;
    endStationMeters: number;
  }[];
}): DesignBuilderRcFrameInfillCoverage {
  const expectedAboveGradeBays = expectedAboveGradeBaysForGeometry(
    params.geometry,
    params.aboveGradePanels,
    params.aboveGradeBounds,
  );
  return {
    expectedAboveGradeBays,
    panelCoverage: params.aboveGradePanels.map((panel) =>
      panelCoverageForRange(panel.id, panel.hostSegmentId, panel, expectedAboveGradeBays),
    ),
    boundsCoverage: params.aboveGradeBounds.map((bounds) =>
      boundsCoverageForRange(
        bounds.panelId,
        bounds.hostSegmentId,
        bounds,
        expectedAboveGradeBays,
      ),
    ),
  };
}

function expectedAboveGradeBaysForGeometry(
  geometry: DesignGeometryResult | null,
  aboveGradePanels: readonly CmuInfillPanel[],
  aboveGradeBounds: readonly {
    panelId: string;
    hostSegmentId: string;
    startStationMeters: number;
    endStationMeters: number;
  }[],
): DesignBuilderRcFrameExpectedInfillBaySummary[] {
  const beams = geometry?.frameSystem?.beams ?? [];
  const gableEndSegmentIds = new Set(
    geometry?.resolvedRoofSystem?.gableEndSegmentIds ?? [],
  );
  const framesBySegment = new Map(
    (geometry?.wallCmuLayout.segmentFrames ?? []).map((frame) => [
      frame.segmentId,
      frame,
    ]),
  );
  const candidateBeams = beams
    .filter((beam) => {
      if (!beam.hostSegmentId) return false;
      if (gableEndSegmentIds.has(beam.hostSegmentId)) return false;
      return beam.kind === "roof_beam" || beam.kind === "plinth_beam";
    })
    .sort((a, b) => {
      const segmentCompare = (a.hostSegmentId ?? "").localeCompare(
        b.hostSegmentId ?? "",
      );
      if (segmentCompare !== 0) return segmentCompare;
      return (
        startStationForBeam(a, framesBySegment) -
        startStationForBeam(b, framesBySegment)
      );
    });
  const roofBeamSegmentIds = new Set(
    candidateBeams
      .filter((beam) => beam.kind === "roof_beam")
      .map((beam) => beam.hostSegmentId)
      .filter((segmentId): segmentId is string => segmentId != null),
  );
  const expectedRanges: Array<{
    bayId: string;
    hostSegmentId: string;
    startStationMeters: number;
    endStationMeters: number;
  }> = [];
  for (const beam of candidateBeams) {
    if (!beam.hostSegmentId) continue;
    if (
      beam.kind === "plinth_beam" &&
      roofBeamSegmentIds.has(beam.hostSegmentId)
    ) {
      continue;
    }
    const frame = framesBySegment.get(beam.hostSegmentId);
    if (!frame) continue;
    const startStation = stationForPoint(beam.startPoint, frame);
    const endStation = stationForPoint(beam.endPoint, frame);
    const rangeStart = Math.max(0, Math.min(startStation, endStation));
    const rangeEnd = Math.min(
      frame.lengthMeters,
      Math.max(startStation, endStation),
    );
    if (rangeEnd - rangeStart <= 0.05) continue;
    expectedRanges.push({
      bayId: `${beam.hostSegmentId}:${beam.id}`,
      hostSegmentId: beam.hostSegmentId,
      startStationMeters: rangeStart,
      endStationMeters: rangeEnd,
    });
  }
  const panelMatches = new Set<string>();
  const boundsMatches = new Set<string>();
  const baysBySegment = new Map<string, number>();
  return expectedRanges.map((range) => {
    const bayIndex = baysBySegment.get(range.hostSegmentId) ?? 0;
    baysBySegment.set(range.hostSegmentId, bayIndex + 1);
    const matchingPanel = firstUnmatchedRangeMatch(
      aboveGradePanels.filter((panel) => panel.hostSegmentId === range.hostSegmentId),
      range,
      panelMatches,
    );
    if (matchingPanel) panelMatches.add(matchingPanel.id);
    const matchingBounds = firstUnmatchedRangeMatch(
      aboveGradeBounds.filter((bounds) => bounds.hostSegmentId === range.hostSegmentId),
      range,
      boundsMatches,
    );
    if (matchingBounds) boundsMatches.add(matchingBounds.panelId);
    const nearestPanel = nearestPanelForRange(
      aboveGradePanels.filter((panel) => panel.hostSegmentId === range.hostSegmentId),
      range,
    );
    return {
      bayId: range.bayId,
      hostSegmentId: range.hostSegmentId,
      bayIndex,
      startStationMeters: round(range.startStationMeters),
      endStationMeters: round(range.endStationMeters),
      clearWidthMeters: round(range.endStationMeters - range.startStationMeters),
      matchedPanelId: matchingPanel?.id ?? null,
      matchedBoundsPanelId: matchingBounds?.panelId ?? null,
      nearestPanelId: nearestPanel?.panelId ?? null,
      nearestPanelStationMismatchMeters:
        nearestPanel != null ? round(nearestPanel.mismatchMeters) : null,
    };
  });
}

function panelCoverageForRange(
  panelId: string,
  hostSegmentId: string,
  range: { startStationMeters: number; endStationMeters: number },
  expectedBays: readonly DesignBuilderRcFrameExpectedInfillBaySummary[],
): DesignBuilderRcFrameInfillPanelCoverage {
  const matchingBay =
    expectedBays.find((bay) => bay.matchedPanelId === panelId) ?? null;
  const nearestBay = nearestExpectedBayForRange(
    expectedBays.filter((bay) => bay.hostSegmentId === hostSegmentId),
    range,
  );
  return {
    panelId,
    hostSegmentId,
    matchedExpectedBayId: matchingBay?.bayId ?? null,
    nearestExpectedBayId: nearestBay?.bayId ?? null,
    nearestExpectedBayStationMismatchMeters:
      nearestBay != null ? round(nearestBay.mismatchMeters) : null,
  };
}

function boundsCoverageForRange(
  panelId: string,
  hostSegmentId: string,
  range: { startStationMeters: number; endStationMeters: number },
  expectedBays: readonly DesignBuilderRcFrameExpectedInfillBaySummary[],
): DesignBuilderRcFrameInfillBoundsCoverage {
  const matchingBay =
    expectedBays.find((bay) => bay.matchedBoundsPanelId === panelId) ?? null;
  const nearestBay = nearestExpectedBayForRange(
    expectedBays.filter((bay) => bay.hostSegmentId === hostSegmentId),
    range,
  );
  return {
    panelId,
    hostSegmentId,
    matchedExpectedBayId: matchingBay?.bayId ?? null,
    nearestExpectedBayId: nearestBay?.bayId ?? null,
    nearestExpectedBayStationMismatchMeters:
      nearestBay != null ? round(nearestBay.mismatchMeters) : null,
  };
}

function startStationForBeam(
  beam: StructuralBeam,
  framesBySegment: ReadonlyMap<string, SegmentFrame>,
): number {
  const segmentId = beam.hostSegmentId;
  if (!segmentId) return 0;
  const frame = framesBySegment.get(segmentId);
  if (!frame) return 0;
  return stationForPoint(beam.startPoint, frame);
}

function firstUnmatchedRangeMatch<
  T extends {
    panelId?: string;
    id?: string;
    startStationMeters: number;
    endStationMeters: number;
  },
>(
  candidates: readonly T[],
  range: { startStationMeters: number; endStationMeters: number },
  matchedIds: ReadonlySet<string>,
): T | null {
  return (
    candidates.find((candidate) => {
      const id = candidate.id ?? candidate.panelId;
      if (!id || matchedIds.has(id)) return false;
      return rangesMatch(candidate, range);
    }) ?? null
  );
}

function nearestPanelForRange(
  panels: readonly CmuInfillPanel[],
  range: { startStationMeters: number; endStationMeters: number },
): { panelId: string; mismatchMeters: number } | null {
  const nearest = panels
    .map((panel) => ({
      panelId: panel.id,
      mismatchMeters: rangeMismatchMeters(panel, range),
    }))
    .sort((a, b) => a.mismatchMeters - b.mismatchMeters)[0];
  return nearest ?? null;
}

function nearestExpectedBayForRange(
  expectedBays: readonly DesignBuilderRcFrameExpectedInfillBaySummary[],
  range: { startStationMeters: number; endStationMeters: number },
): { bayId: string; mismatchMeters: number } | null {
  const nearest = expectedBays
    .map((bay) => ({
      bayId: bay.bayId,
      mismatchMeters: rangeMismatchMeters(bay, range),
    }))
    .sort((a, b) => a.mismatchMeters - b.mismatchMeters)[0];
  return nearest ?? null;
}

function rangesMatch(
  candidate: { startStationMeters: number; endStationMeters: number },
  expected: { startStationMeters: number; endStationMeters: number },
): boolean {
  return rangeMismatchMeters(candidate, expected) <= 0.015;
}

function rangeMismatchMeters(
  candidate: { startStationMeters: number; endStationMeters: number },
  expected: { startStationMeters: number; endStationMeters: number },
): number {
  return Math.max(
    Math.abs(candidate.startStationMeters - expected.startStationMeters),
    Math.abs(candidate.endStationMeters - expected.endStationMeters),
  );
}

function stationForPoint(
  point: { x: number; z: number },
  frame: SegmentFrame,
): number {
  return (
    (point.x - frame.centerlineStart.x) * frame.tangent.x +
    (point.z - frame.centerlineStart.z) * frame.tangent.z
  );
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
