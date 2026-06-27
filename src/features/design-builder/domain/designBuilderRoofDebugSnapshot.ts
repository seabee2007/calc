import type {
  DesignGeometryPoint,
  DesignGeometryResult,
} from "../geometry/designGeometry";
import type {
  BuildingSystemMode,
  ResolvedRoofSystem,
  RoofSystemSettings,
  RoofVec3,
  SteelMemberSegment,
  TrussPlacement,
} from "../types";

type BoundsPoint = Pick<RoofVec3, "x" | "z">;

export type DesignBuilderRoofDebugBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  widthMeters: number;
  depthMeters: number;
};

export type DesignBuilderRoofDebugIssue = {
  path: string;
  code: "missing" | "non_finite";
  message: string;
};

export type DesignBuilderRoofDebugSnapshot = {
  sourcePath: DesignGeometryResult["sourcePath"] | "missing_geometry";
  buildingSystemMode: BuildingSystemMode | "unknown";
  slabTopMeters: number | null;
  footprint: {
    pointCount: number;
    bounds: DesignBuilderRoofDebugBounds | null;
  };
  settings: {
    enabled: boolean | null;
    roofType: RoofSystemSettings["roofType"] | null;
    supportSystem: RoofSystemSettings["supportSystem"] | null;
    ridgeDirection: RoofSystemSettings["ridgeDirection"] | null;
    eaveOverhangMeters: number | null;
    gableEndOverhangMeters: number | null;
    trussesEnabled: boolean | null;
    purlinsEnabled: boolean | null;
    gableEnabled: boolean | null;
    rakedConcreteCapEnabled: boolean | null;
  };
  resolvedRoof: {
    present: boolean;
    supported: boolean;
    unsupportedMessage: string | null;
    roofType: ResolvedRoofSystem["roofType"] | null;
    bearingSource: ResolvedRoofSystem["roofBearingSource"] | null;
    roofBeamTopY: number | null;
    roofPeakY: number | null;
    peakRiseMeters: number | null;
    structuralBearingBounds: DesignBuilderRoofDebugBounds | null;
    claddingBounds: DesignBuilderRoofDebugBounds | null;
    roofSheetBounds: DesignBuilderRoofDebugBounds | null;
    structuralRidgeLengthMeters: number | null;
    claddingRidgeLengthMeters: number | null;
    gableEndSegmentIds: string[];
    warnings: string[];
  };
  trusses: {
    count: number;
    stationMeters: number[];
    bounds: DesignBuilderRoofDebugBounds | null;
    first: DesignBuilderTrussDebugSummary | null;
    last: DesignBuilderTrussDebugSummary | null;
  };
  gableEnd: {
    count: number;
    cmuBlockCount: number;
    cmuBounds: DesignBuilderRoofDebugBounds | null;
    roofingClosureCount: number;
    segmentIds: string[];
  };
  rakedCaps: {
    count: number;
    volumeCubicMeters: number | null;
  };
  counts: {
    roofTopPlanes: number;
    claddingDisplayPlanes: number;
    purlins: number;
    fascia: number;
    soffit: number;
  };
  issues: DesignBuilderRoofDebugIssue[];
};

export type DesignBuilderTrussDebugSummary = {
  id: string;
  stationMeters: number;
  ridgeAxis: TrussPlacement["ridgeAxis"];
  bearingSpanMeters: number;
  topChordLengthMeters: {
    left: number | null;
    right: number | null;
  };
  eaveExtensionLengthMeters: {
    left: number | null;
    right: number | null;
  };
};

export function createDesignBuilderRoofDebugSnapshot(params: {
  geometryResult: DesignGeometryResult | null | undefined;
  roofSystem: RoofSystemSettings | null | undefined;
  slabTopMeters?: number | null;
}): DesignBuilderRoofDebugSnapshot {
  const geometry = params.geometryResult ?? null;
  const roof = geometry?.resolvedRoofSystem ?? null;
  const issues: DesignBuilderRoofDebugIssue[] = [];

  collectPointIssues(
    geometry?.exteriorFootprint ?? [],
    "geometry.exteriorFootprint",
    issues,
  );
  if (roof) {
    collectPointIssues(
      roof.structuralBearingPerimeter,
      "roof.structuralBearingPerimeter",
      issues,
    );
    collectPointIssues(
      roof.claddingPerimeter,
      "roof.claddingPerimeter",
      issues,
    );
    collectPointIssues(
      roof.roofSheetPerimeter,
      "roof.roofSheetPerimeter",
      issues,
    );
    collectOptionalPointIssue(roof.ridgeStart, "roof.ridgeStart", issues);
    collectOptionalPointIssue(roof.ridgeEnd, "roof.ridgeEnd", issues);
    collectOptionalPointIssue(
      roof.structuralRidgeStart,
      "roof.structuralRidgeStart",
      issues,
    );
    collectOptionalPointIssue(
      roof.structuralRidgeEnd,
      "roof.structuralRidgeEnd",
      issues,
    );
    collectOptionalPointIssue(
      roof.claddingRidgeStart,
      "roof.claddingRidgeStart",
      issues,
    );
    collectOptionalPointIssue(
      roof.claddingRidgeEnd,
      "roof.claddingRidgeEnd",
      issues,
    );
    roof.trussPlacements.forEach((truss, trussIndex) => {
      collectTrussPointIssues(
        truss,
        `roof.trussPlacements[${trussIndex}]`,
        issues,
      );
    });
  } else {
    issues.push({
      path: "geometry.resolvedRoofSystem",
      code: "missing",
      message: "No resolved roof system is available for this geometry result.",
    });
  }

  const trusses = roof?.trussPlacements ?? [];
  const gableEndBlocks =
    geometry?.blockInstances.filter(
      (block) => block.source === "gable_end_solver",
    ) ?? [];

  return {
    sourcePath: geometry?.sourcePath ?? "missing_geometry",
    buildingSystemMode: inferBuildingSystemMode(geometry),
    slabTopMeters: finiteOrNull(params.slabTopMeters),
    footprint: {
      pointCount: geometry?.exteriorFootprint.length ?? 0,
      bounds: bounds2d(geometry?.exteriorFootprint ?? []),
    },
    settings: {
      enabled: params.roofSystem?.enabled ?? null,
      roofType: params.roofSystem?.roofType ?? null,
      supportSystem: params.roofSystem?.supportSystem ?? null,
      ridgeDirection: params.roofSystem?.ridgeDirection ?? null,
      eaveOverhangMeters: finiteOrNull(params.roofSystem?.eaveOverhangMeters),
      gableEndOverhangMeters: finiteOrNull(
        params.roofSystem?.gableEndOverhangMeters,
      ),
      trussesEnabled: params.roofSystem?.steelTrusses.enabled ?? null,
      purlinsEnabled: params.roofSystem?.purlins.enabled ?? null,
      gableEnabled: params.roofSystem?.gable.enabled ?? null,
      rakedConcreteCapEnabled:
        params.roofSystem?.gable.rakedConcreteCapEnabled ?? null,
    },
    resolvedRoof: {
      present: roof !== null,
      supported: roof?.supported ?? false,
      unsupportedMessage: roof?.unsupportedMessage ?? null,
      roofType: roof?.roofType ?? null,
      bearingSource: roof?.roofBearingSource ?? null,
      roofBeamTopY: finiteOrNull(roof?.roofBeamTopY),
      roofPeakY: finiteOrNull(roof?.roofPeakY),
      peakRiseMeters:
        roof &&
        Number.isFinite(roof.roofPeakY) &&
        Number.isFinite(roof.roofBeamTopY)
          ? round(roof.roofPeakY - roof.roofBeamTopY)
          : null,
      structuralBearingBounds: bounds2d(roof?.structuralBearingPerimeter ?? []),
      claddingBounds: bounds2d(roof?.claddingPerimeter ?? []),
      roofSheetBounds: bounds2d(roof?.roofSheetPerimeter ?? []),
      structuralRidgeLengthMeters: finiteOrNull(
        roof?.structuralRidgeLengthMeters,
      ),
      claddingRidgeLengthMeters: finiteOrNull(roof?.claddingRidgeLengthMeters),
      gableEndSegmentIds: roof?.gableEndSegmentIds ?? [],
      warnings:
        roof?.warnings.map(
          (warning) => `${warning.code}: ${warning.message}`,
        ) ?? [],
    },
    trusses: {
      count: trusses.length,
      stationMeters: trusses.map((truss) => round(truss.stationMeters)),
      bounds: bounds2d(trusses.flatMap(trussBoundsPoints)),
      first: summarizeTruss(trusses[0]),
      last: summarizeTruss(trusses.at(-1)),
    },
    gableEnd: {
      count: roof?.gableEnds.length ?? 0,
      cmuBlockCount:
        roof?.gableEnds.reduce(
          (total, gableEnd) => total + gableEnd.cmuUnitPlacements.length,
          0,
        ) ?? 0,
      cmuBounds: bounds2d(gableEndBlocks.flatMap(cmuBlockPlanCorners)),
      roofingClosureCount: roof?.gableEndRoofingClosures.length ?? 0,
      segmentIds: roof?.gableEndSegmentIds ?? [],
    },
    rakedCaps: {
      count:
        geometry?.rakedCapPlacements?.length ??
        roof?.gableEnds.reduce(
          (total, gableEnd) => total + gableEnd.rakedCapPlacements.length,
          0,
        ) ??
        0,
      volumeCubicMeters: finiteOrNull(roof?.rakedCapVolumeCubicMeters),
    },
    counts: {
      roofTopPlanes: roof?.roofTopPlanes.length ?? 0,
      claddingDisplayPlanes: roof?.claddingDisplayPlanes.length ?? 0,
      purlins: roof?.purlinPlacements.length ?? 0,
      fascia: roof?.fasciaPlacements.length ?? 0,
      soffit: roof?.soffitPlacements.length ?? 0,
    },
    issues,
  };
}

function summarizeTruss(
  truss: TrussPlacement | undefined,
): DesignBuilderTrussDebugSummary | null {
  if (!truss) return null;
  return {
    id: truss.id,
    stationMeters: round(truss.stationMeters),
    ridgeAxis: truss.ridgeAxis,
    bearingSpanMeters: distance(truss.bearingLeft, truss.bearingRight),
    topChordLengthMeters: {
      left: memberLength(truss.members, "top_chord_left"),
      right: memberLength(truss.members, "top_chord_right"),
    },
    eaveExtensionLengthMeters: {
      left: memberLength(truss.members, "top_chord_left_eave_extension"),
      right: memberLength(truss.members, "top_chord_right_eave_extension"),
    },
  };
}

function inferBuildingSystemMode(
  geometry: DesignGeometryResult | null,
): BuildingSystemMode | "unknown" {
  if (!geometry) return "unknown";
  if (geometry.buildingSystemMode) return geometry.buildingSystemMode;
  if (
    geometry.frameSystem ||
    geometry.infillSystem ||
    geometry.isolatedFootings?.length
  ) {
    return "reinforced_concrete_frame_with_cmu_infill";
  }
  return "unknown";
}

function memberLength(
  members: SteelMemberSegment[],
  memberKind: SteelMemberSegment["memberKind"],
): number | null {
  const member = members.find((entry) => entry.memberKind === memberKind);
  return member ? distance(member.start, member.end) : null;
}

function trussBoundsPoints(truss: TrussPlacement): BoundsPoint[] {
  return [
    truss.bearingLeft,
    truss.bearingRight,
    truss.basePlateCenterLeft,
    truss.basePlateCenterRight,
    truss.apex,
    ...truss.members.flatMap((member) => [member.start, member.end]),
  ].filter((point): point is BoundsPoint => point !== undefined);
}

function cmuBlockPlanCorners(block: {
  x: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  actualLengthMeters?: number;
  depthMeters?: number;
}): BoundsPoint[] {
  const halfLength = (block.actualLengthMeters ?? block.lengthMeters) / 2;
  const halfDepth = (block.depthMeters ?? 0) / 2;
  const cos = Math.cos(block.rotationY);
  const sin = Math.sin(block.rotationY);
  return [
    { along: -halfLength, depth: -halfDepth },
    { along: halfLength, depth: -halfDepth },
    { along: halfLength, depth: halfDepth },
    { along: -halfLength, depth: halfDepth },
  ].map(({ along, depth }) => ({
    x: block.x + along * cos + depth * sin,
    z: block.z - along * sin + depth * cos,
  }));
}

function collectTrussPointIssues(
  truss: TrussPlacement,
  path: string,
  issues: DesignBuilderRoofDebugIssue[],
) {
  collectPointIssues(
    [truss.bearingLeft, truss.bearingRight, truss.apex],
    path,
    issues,
  );
  collectOptionalPointIssue(
    truss.basePlateCenterLeft,
    `${path}.basePlateCenterLeft`,
    issues,
  );
  collectOptionalPointIssue(
    truss.basePlateCenterRight,
    `${path}.basePlateCenterRight`,
    issues,
  );
  truss.members.forEach((member, index) => {
    collectPointIssues(
      [member.start, member.end],
      `${path}.members[${index}]`,
      issues,
    );
  });
}

function collectPointIssues(
  points: readonly (BoundsPoint | DesignGeometryPoint | RoofVec3)[],
  path: string,
  issues: DesignBuilderRoofDebugIssue[],
) {
  points.forEach((point, index) => {
    if (!isFinitePoint(point)) {
      issues.push({
        path: `${path}[${index}]`,
        code: "non_finite",
        message: "Point contains a non-finite coordinate.",
      });
    }
  });
}

function collectOptionalPointIssue(
  point: RoofVec3 | undefined,
  path: string,
  issues: DesignBuilderRoofDebugIssue[],
) {
  if (point && !isFinitePoint(point)) {
    issues.push({
      path,
      code: "non_finite",
      message: "Point contains a non-finite coordinate.",
    });
  }
}

function isFinitePoint(
  point: BoundsPoint | DesignGeometryPoint | RoofVec3,
): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.z) &&
    (!("y" in point) || Number.isFinite(point.y))
  );
}

function bounds2d(
  points: readonly BoundsPoint[],
): DesignBuilderRoofDebugBounds | null {
  const finitePoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.z),
  );
  if (finitePoints.length === 0) return null;
  const minX = Math.min(...finitePoints.map((point) => point.x));
  const maxX = Math.max(...finitePoints.map((point) => point.x));
  const minZ = Math.min(...finitePoints.map((point) => point.z));
  const maxZ = Math.max(...finitePoints.map((point) => point.z));
  return {
    minX: round(minX),
    maxX: round(maxX),
    minZ: round(minZ),
    maxZ: round(maxZ),
    widthMeters: round(maxX - minX),
    depthMeters: round(maxZ - minZ),
  };
}

function distance(start: RoofVec3, end: RoofVec3): number {
  return round(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z));
}

function finiteOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? round(value) : null;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
