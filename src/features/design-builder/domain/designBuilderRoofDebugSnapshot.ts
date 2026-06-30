import type { DesignGeometryResult } from "../geometry/designGeometry";
import {
  collectResolvedRoofGeometryIssues,
  dedupeDesignWarnings,
  summarizeRoofGeometryIssues,
  type RoofGeometryValidationIssue,
} from "./roofGeometryValidation";
import {
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
} from "./roofFramingResolver";
import { validateStrictOrthogonalFootprint } from "./wallFootprintValidation";
import type {
  BuildingSystemMode,
  DesignWallLayoutParameters,
  DesignWarning,
  PurlinPlacement,
  ResolvedRoofSystem,
  RoofPlane,
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

export type DesignBuilderRoofDebugVerticalBounds = {
  minY: number;
  maxY: number;
  heightMeters: number;
};

export type DesignBuilderRoofDebugBounds3D = {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
};

export type DesignBuilderRoofDebugIssue = {
  path: string;
  code: "missing" | "non_finite";
  message: string;
};

export type DesignBuilderRoofPlaneDebug = {
  id: string;
  cornerCount: number;
  corners: RoofVec3[];
  normal: RoofVec3;
  minY: number;
  maxY: number;
  pitchDeg: number;
  areaM2: number;
  isFinite: boolean;
};

export type DesignBuilderTrussDebug = {
  id: string;
  stationMeters: number;
  spanMeters: number;
  bearingLeft: RoofVec3;
  bearingRight: RoofVec3;
  apex: RoofVec3;
  webProfileId?: string;
  maxTopChordLengthM: number;
  hasBearingAtRidgePoint: boolean;
};

export type DesignBuilderPurlinDebug = {
  id: string;
  slopePlaneId: string;
  rowIndex: number;
  start: RoofVec3;
  end: RoofVec3;
  lengthM: number;
  startInsidePlane: boolean;
  endInsidePlane: boolean;
  distanceAboveRoofPlaneM: number | null;
};

export type DesignBuilderRoofDebugScene = {
  source: "three-render-debug-snapshot";
  roofCladdingMeshBounds: DesignBuilderRoofDebugBounds3D[];
  trussMeshBounds: DesignBuilderRoofDebugBounds3D[];
  purlinMeshBounds: DesignBuilderRoofDebugBounds3D[];
};

export type DesignBuilderRoofRenderDebugSnapshotLike = {
  groups?: Record<
    string,
    {
      bounds?: Omit<DesignBuilderRoofDebugBounds3D, "id"> | null;
    }
  >;
};

export type DesignBuilderRoofDebugSnapshot = {
  sourcePath: DesignGeometryResult["sourcePath"] | "missing_geometry";
  buildingSystemMode: BuildingSystemMode | "unknown";
  slabTopMeters: number | null;
  summary: {
    supported: boolean;
    warningCodes: string[];
    roofPlaneCount: number;
    claddingDisplayPlaneCount: number;
    trussCount: number;
    purlinCount: number;
    hasNonFiniteGeometry: boolean;
    hasFlatCladdingDespitePitch: boolean;
    maxPurlinPlaneOffsetM: number | null;
    maxCladdingOverrunM: number | null;
  };
  input: {
    wallNodes: Array<{ id: string; x: number; z: number }>;
    wallSegments: Array<{ id: string; startNodeId: string; endNodeId: string }>;
    segmentLengthsM: number[];
    adjacentAnglesDeg: number[];
    oppositeLengthDeltasM: number[];
    isStrictRectangle: boolean;
  };
  roof: {
    supported: boolean;
    warnings: DesignWarning[];
    validationIssues: RoofGeometryValidationIssue[];
    structuralRidgeStart?: RoofVec3;
    structuralRidgeEnd?: RoofVec3;
    claddingRidgeStart?: RoofVec3;
    claddingRidgeEnd?: RoofVec3;
    structuralRidgeLengthMeters: number;
    claddingRidgeLengthMeters: number;
    roofTopPlanes: DesignBuilderRoofPlaneDebug[];
    claddingDisplayPlanes: DesignBuilderRoofPlaneDebug[];
    trussCount: number;
    trussStations: number[];
    trussPlacements: DesignBuilderTrussDebug[];
    purlinCount: number;
    purlinPlacements: DesignBuilderPurlinDebug[];
  };
  scene?: DesignBuilderRoofDebugScene;
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
    cmuVerticalBounds: DesignBuilderRoofDebugVerticalBounds | null;
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
  wallLayout?: DesignWallLayoutParameters | null;
  renderSnapshot?: DesignBuilderRoofRenderDebugSnapshotLike | null;
}): DesignBuilderRoofDebugSnapshot {
  const geometry = params.geometryResult ?? null;
  const roof = geometry?.resolvedRoofSystem ?? null;
  const legacyIssues: DesignBuilderRoofDebugIssue[] = [];

  collectPointIssues(
    geometry?.exteriorFootprint ?? [],
    "geometry.exteriorFootprint",
    legacyIssues,
  );
  if (roof) {
    collectResolvedRoofPointIssues(roof, legacyIssues);
  } else {
    legacyIssues.push({
      path: "geometry.resolvedRoofSystem",
      code: "missing",
      message: "No resolved roof system is available for this geometry result.",
    });
  }

  const validation = roof
    ? collectResolvedRoofGeometryIssues(roof)
    : {
        issues: [],
        metrics: {
          hasNonFiniteGeometry: false,
          hasFlatCladdingDespitePitch: false,
          maxPurlinPlaneOffsetM: null,
          maxCladdingOverrunM: null,
          badPlaneIds: [],
          badPurlinIds: [],
        },
      };
  const trusses = sortedTrusses(roof?.trussPlacements ?? []);
  const purlins = sortedPurlins(roof?.purlinPlacements ?? []);
  const gableEndBlocks =
    geometry?.blockInstances.filter(
      (block) => block.source === "gable_end_solver",
    ) ?? [];
  const warnings = sortedWarnings(
    dedupeDesignWarnings([
      ...(roof?.warnings ?? []),
      ...summarizeRoofGeometryIssues(validation.issues),
    ]),
  );
  const warningCodes = [...new Set(warnings.map((warning) => warning.code))].sort();

  return {
    sourcePath: geometry?.sourcePath ?? "missing_geometry",
    buildingSystemMode: inferBuildingSystemMode(geometry),
    slabTopMeters: finiteOrNull(params.slabTopMeters),
    summary: {
      supported: roof?.supported ?? false,
      warningCodes,
      roofPlaneCount: roof?.roofTopPlanes.length ?? 0,
      claddingDisplayPlaneCount: roof?.claddingDisplayPlanes.length ?? 0,
      trussCount: trusses.length,
      purlinCount: purlins.length,
      hasNonFiniteGeometry:
        validation.metrics.hasNonFiniteGeometry ||
        legacyIssues.some((issue) => issue.code === "non_finite"),
      hasFlatCladdingDespitePitch: validation.metrics.hasFlatCladdingDespitePitch,
      maxPurlinPlaneOffsetM: validation.metrics.maxPurlinPlaneOffsetM,
      maxCladdingOverrunM: validation.metrics.maxCladdingOverrunM,
    },
    input: buildInputDebug(params.wallLayout ?? null),
    roof: {
      supported: roof?.supported ?? false,
      warnings,
      validationIssues: sortedValidationIssues(validation.issues),
      structuralRidgeStart: cloneVec3(roof?.structuralRidgeStart),
      structuralRidgeEnd: cloneVec3(roof?.structuralRidgeEnd),
      claddingRidgeStart: cloneVec3(roof?.claddingRidgeStart),
      claddingRidgeEnd: cloneVec3(roof?.claddingRidgeEnd),
      structuralRidgeLengthMeters: finiteOrZero(roof?.structuralRidgeLengthMeters),
      claddingRidgeLengthMeters: finiteOrZero(roof?.claddingRidgeLengthMeters),
      roofTopPlanes: sortedPlanes(roof?.roofTopPlanes ?? []).map(summarizeRoofPlane),
      claddingDisplayPlanes: sortedPlanes(roof?.claddingDisplayPlanes ?? []).map(summarizeRoofPlane),
      trussCount: trusses.length,
      trussStations: trusses.map((truss) => round(truss.stationMeters)),
      trussPlacements: trusses.map(summarizeTrussDetailed),
      purlinCount: purlins.length,
      purlinPlacements: purlins.map((purlin) => summarizePurlinDetailed(roof, purlin)),
    },
    scene: buildSceneDebug(params.renderSnapshot ?? null),
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
      gableEndSegmentIds: [...(roof?.gableEndSegmentIds ?? [])].sort(),
      warnings: warnings.map(
        (warning) => `${warning.code}: ${warning.message}`,
      ),
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
      cmuVerticalBounds: cmuBlockVerticalBounds(gableEndBlocks),
      roofingClosureCount: roof?.gableEndRoofingClosures.length ?? 0,
      segmentIds: [...(roof?.gableEndSegmentIds ?? [])].sort(),
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
    issues: legacyIssues.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export const buildRoofDebugSnapshot = createDesignBuilderRoofDebugSnapshot;

function buildInputDebug(layout: DesignWallLayoutParameters | null): DesignBuilderRoofDebugSnapshot["input"] {
  if (!layout) {
    return {
      wallNodes: [],
      wallSegments: [],
      segmentLengthsM: [],
      adjacentAnglesDeg: [],
      oppositeLengthDeltasM: [],
      isStrictRectangle: false,
    };
  }
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const segmentLengths = layout.segments.map((segment) => {
    const start = nodeById.get(segment.startNodeId);
    const end = nodeById.get(segment.endNodeId);
    return start && end ? round(planDistance(start, end)) : 0;
  });
  const adjacentAngles = layout.segments.map((segment, index) => {
    const next = layout.segments[(index + 1) % layout.segments.length];
    return next ? round(angleBetweenSegmentsDeg(segment, next, nodeById)) : 0;
  });
  const oppositeDeltas =
    layout.segments.length === 4
      ? [
          round(Math.abs(segmentLengths[0]! - segmentLengths[2]!)),
          round(Math.abs(segmentLengths[1]! - segmentLengths[3]!)),
        ]
      : [];
  return {
    wallNodes: layout.nodes
      .map((node) => ({ id: node.id, x: round(node.x), z: round(node.z) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    wallSegments: layout.segments
      .map((segment) => ({
        id: segment.id,
        startNodeId: segment.startNodeId,
        endNodeId: segment.endNodeId,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    segmentLengthsM: segmentLengths,
    adjacentAnglesDeg: adjacentAngles,
    oppositeLengthDeltasM: oppositeDeltas,
    isStrictRectangle: validateStrictOrthogonalFootprint(layout).length === 0,
  };
}

function summarizeRoofPlane(plane: RoofPlane): DesignBuilderRoofPlaneDebug {
  const ys = plane.corners.map((corner) => corner.y);
  return {
    id: plane.id,
    cornerCount: plane.corners.length,
    corners: plane.corners.map(roundVec3),
    normal: roundVec3(plane.normal),
    minY: round(Math.min(...ys)),
    maxY: round(Math.max(...ys)),
    pitchDeg: round((roofPlanePitchRadians(plane) * 180) / Math.PI),
    areaM2: round(roofPlaneArea(plane)),
    isFinite: plane.corners.every(isFinitePoint) && isFinitePoint(plane.normal),
  };
}

function summarizeTrussDetailed(truss: TrussPlacement): DesignBuilderTrussDebug {
  const topChordLengths = truss.members
    .filter((member) => member.memberKind.startsWith("top_chord"))
    .map((member) => distance(member.start, member.end));
  return {
    id: truss.id,
    stationMeters: round(truss.stationMeters),
    spanMeters: round(truss.spanMeters ?? distance(truss.bearingLeft, truss.bearingRight)),
    bearingLeft: roundVec3(truss.bearingLeft),
    bearingRight: roundVec3(truss.bearingRight),
    apex: roundVec3(truss.apex),
    webProfileId: truss.webProfileId,
    maxTopChordLengthM: round(topChordLengths.length ? Math.max(...topChordLengths) : 0),
    hasBearingAtRidgePoint:
      planDistance(truss.bearingLeft, truss.apex) <= 0.02 ||
      planDistance(truss.bearingRight, truss.apex) <= 0.02,
  };
}

function summarizePurlinDetailed(
  roof: ResolvedRoofSystem | null,
  purlin: PurlinPlacement,
): DesignBuilderPurlinDebug {
  const sourcePlane = roof?.roofTopPlanes.find((plane) => plane.id === purlin.slopePlaneId) ?? null;
  const center = {
    x: (purlin.start.x + purlin.end.x) / 2,
    y: (purlin.start.y + purlin.end.y) / 2,
    z: (purlin.start.z + purlin.end.z) / 2,
  };
  const sourceY = sourcePlane
    ? elevationOnRoofPlaneAtPoint(sourcePlane, center.x, center.z)
    : null;
  const normal = sourcePlane ? normalizeOutwardRoofNormal(sourcePlane.normal) : null;
  return {
    id: purlin.id,
    slopePlaneId: purlin.slopePlaneId,
    rowIndex: purlin.rowIndex,
    start: roundVec3(purlin.start),
    end: roundVec3(purlin.end),
    lengthM: distance(purlin.start, purlin.end),
    startInsidePlane: sourcePlane ? pointInRoofPlaneFootprint(sourcePlane, purlin.start, 0.02) : false,
    endInsidePlane: sourcePlane ? pointInRoofPlaneFootprint(sourcePlane, purlin.end, 0.02) : false,
    distanceAboveRoofPlaneM:
      sourceY != null && normal
        ? round(
            distanceAlongRoofNormal(
              { x: center.x, y: sourceY, z: center.z },
              center,
              normal,
            ),
          )
        : null,
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

function cmuBlockVerticalBounds(
  blocks: readonly Array<{ y: number; heightMeters?: number; physicalHeightMeters?: number }>,
): DesignBuilderRoofDebugVerticalBounds | null {
  const ranges = blocks
    .map((block) => {
      const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
      return {
        minY: block.y - height / 2,
        maxY: block.y + height / 2,
      };
    })
    .filter((range) => Number.isFinite(range.minY) && Number.isFinite(range.maxY));
  if (ranges.length === 0) return null;
  const minY = Math.min(...ranges.map((range) => range.minY));
  const maxY = Math.max(...ranges.map((range) => range.maxY));
  return {
    minY: round(minY),
    maxY: round(maxY),
    heightMeters: round(maxY - minY),
  };
}

function collectResolvedRoofPointIssues(
  roof: ResolvedRoofSystem,
  issues: DesignBuilderRoofDebugIssue[],
) {
  collectPointIssues(
    roof.structuralBearingPerimeter,
    "roof.structuralBearingPerimeter",
    issues,
  );
  collectPointIssues(roof.claddingPerimeter, "roof.claddingPerimeter", issues);
  collectPointIssues(roof.roofSheetPerimeter, "roof.roofSheetPerimeter", issues);
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
  points: readonly (BoundsPoint | RoofVec3)[],
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

function buildSceneDebug(
  renderSnapshot: DesignBuilderRoofRenderDebugSnapshotLike | null,
): DesignBuilderRoofDebugScene | undefined {
  if (!renderSnapshot?.groups) return undefined;
  return {
    source: "three-render-debug-snapshot",
    roofCladdingMeshBounds: sceneBoundsForGroups(renderSnapshot, [
      "roofCladdingGroup",
      "gableEndRoofingClosureGroup",
    ]),
    trussMeshBounds: sceneBoundsForGroups(renderSnapshot, [
      "anchorBoltGroup",
      "basePlateGroup",
      "trussChordGroup",
      "trussWebGroup",
    ]),
    purlinMeshBounds: sceneBoundsForGroups(renderSnapshot, ["purlinGroup"]),
  };
}

function sceneBoundsForGroups(
  renderSnapshot: DesignBuilderRoofRenderDebugSnapshotLike,
  groupNames: string[],
): DesignBuilderRoofDebugBounds3D[] {
  return groupNames
    .flatMap((name) => {
      const bounds = renderSnapshot.groups?.[name]?.bounds;
      return bounds ? [{ id: name, ...roundBounds3d(bounds) }] : [];
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sortedPlanes(planes: readonly RoofPlane[]): RoofPlane[] {
  return [...planes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedTrusses(trusses: readonly TrussPlacement[]): TrussPlacement[] {
  return [...trusses].sort((left, right) => {
    if (left.stationMeters !== right.stationMeters) {
      return left.stationMeters - right.stationMeters;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortedPurlins(purlins: readonly PurlinPlacement[]): PurlinPlacement[] {
  return [...purlins].sort((left, right) => {
    const planeCompare = left.slopePlaneId.localeCompare(right.slopePlaneId);
    if (planeCompare !== 0) return planeCompare;
    if (left.rowIndex !== right.rowIndex) return left.rowIndex - right.rowIndex;
    return left.id.localeCompare(right.id);
  });
}

function sortedWarnings(warnings: readonly DesignWarning[]): DesignWarning[] {
  return [...warnings].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);
    if (codeCompare !== 0) return codeCompare;
    return left.message.localeCompare(right.message);
  });
}

function sortedValidationIssues(
  issues: readonly RoofGeometryValidationIssue[],
): RoofGeometryValidationIssue[] {
  return [...issues].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);
    if (codeCompare !== 0) return codeCompare;
    return (left.sourceId ?? "").localeCompare(right.sourceId ?? "");
  });
}

function angleBetweenSegmentsDeg(
  left: DesignWallLayoutParameters["segments"][number],
  right: DesignWallLayoutParameters["segments"][number],
  nodeById: ReadonlyMap<string, DesignWallLayoutParameters["nodes"][number]>,
): number {
  const leftStart = nodeById.get(left.startNodeId);
  const leftEnd = nodeById.get(left.endNodeId);
  const rightStart = nodeById.get(right.startNodeId);
  const rightEnd = nodeById.get(right.endNodeId);
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return 0;
  const leftVector = { x: leftEnd.x - leftStart.x, z: leftEnd.z - leftStart.z };
  const rightVector = { x: rightEnd.x - rightStart.x, z: rightEnd.z - rightStart.z };
  const leftLength = Math.hypot(leftVector.x, leftVector.z) || 1;
  const rightLength = Math.hypot(rightVector.x, rightVector.z) || 1;
  const dot =
    (leftVector.x * rightVector.x + leftVector.z * rightVector.z) /
    (leftLength * rightLength);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function roofPlanePitchRadians(plane: RoofPlane): number {
  const normal = normalizeOutwardRoofNormal(plane.normal);
  return Math.acos(Math.min(1, Math.max(0, Math.abs(normal.y))));
}

function roofPlaneArea(plane: RoofPlane): number {
  if (plane.corners.length < 3) return 0;
  let area = 0;
  const origin = plane.corners[0]!;
  for (let index = 1; index < plane.corners.length - 1; index += 1) {
    area += triangleArea(origin, plane.corners[index]!, plane.corners[index + 1]!);
  }
  return area;
}

function triangleArea(a: RoofVec3, b: RoofVec3, c: RoofVec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  return (
    Math.hypot(
      ab.y * ac.z - ab.z * ac.y,
      ab.z * ac.x - ab.x * ac.z,
      ab.x * ac.y - ab.y * ac.x,
    ) / 2
  );
}

function pointInRoofPlaneFootprint(
  plane: RoofPlane,
  point: Pick<RoofVec3, "x" | "z">,
  toleranceMeters: number,
): boolean {
  if (plane.corners.length < 3) return false;
  const signedDistances = plane.corners.map((start, index) => {
    const end = plane.corners[(index + 1) % plane.corners.length]!;
    const edgeX = end.x - start.x;
    const edgeZ = end.z - start.z;
    const edgeLength = Math.hypot(edgeX, edgeZ) || 1;
    return ((point.x - start.x) * edgeZ - (point.z - start.z) * edgeX) / edgeLength;
  });
  const hasPositive = signedDistances.some((distanceValue) => distanceValue > toleranceMeters);
  const hasNegative = signedDistances.some((distanceValue) => distanceValue < -toleranceMeters);
  return !(hasPositive && hasNegative);
}

function isFinitePoint(point: BoundsPoint | RoofVec3): boolean {
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

function roundBounds3d(
  bounds: Omit<DesignBuilderRoofDebugBounds3D, "id">,
): Omit<DesignBuilderRoofDebugBounds3D, "id"> {
  return {
    minX: round(bounds.minX),
    maxX: round(bounds.maxX),
    minY: round(bounds.minY),
    maxY: round(bounds.maxY),
    minZ: round(bounds.minZ),
    maxZ: round(bounds.maxZ),
    widthMeters: round(bounds.widthMeters),
    heightMeters: round(bounds.heightMeters),
    depthMeters: round(bounds.depthMeters),
  };
}

function distance(start: RoofVec3, end: RoofVec3): number {
  return round(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z));
}

function planDistance(start: BoundsPoint, end: BoundsPoint): number {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function cloneVec3(point: RoofVec3 | undefined): RoofVec3 | undefined {
  return point ? roundVec3(point) : undefined;
}

function roundVec3(point: RoofVec3): RoofVec3 {
  return {
    x: round(point.x),
    y: round(point.y),
    z: round(point.z),
  };
}

function finiteOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? round(value!) : 0;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? round(value!) : null;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
