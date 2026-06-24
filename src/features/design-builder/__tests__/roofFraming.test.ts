import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { deriveDesignSceneBounds } from '../domain/designSceneBounds';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import {
  buildPurlinRowStationFractions,
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  ROOF_SHEET_EAVE_OVERHANG_METERS,
  PURLIN_TO_CHORD_CLEARANCE_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  resolveEvenStations,
  resolveTrussTopChordUpperPoint,
  TRUSS_CHORD_PROFILE_METERS,
  trussMemberLength,
  validateRidgeCapPlacement,
  validateTrussPlacement,
  distancePointToTrussPlaneForTests,
} from '../domain/roofFramingResolver';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview, metersToFeet } from '../quantity/designQuantityFormulas';
import { buildPurlinMesh, createMemberBetween, createFoldedRidgeCapGroup, memberWorldEndpoints } from '../geometry/roofRenderingGeometry';
import type { RoofSystemSettings, SteelMemberSegment, TrussPlacement } from '../types';
import * as THREE from 'three';

function frameInfillGeometry(roofSystem: RoofSystemSettings, layout?: import('../types').DesignWallLayoutParameters) {
  const basePreset = createFiveBySixCmuBuildingPreset();
  if (layout) {
    basePreset.wallLayout = layout;
  }
  const preset = applyAutoFrameLayout(basePreset);
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
  return generateDesignGeometry(
    buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      foundationSettings: foundation,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      roofSystem,
    }),
  );
}

function roofFromGeometry(geometry: ReturnType<typeof frameInfillGeometry>) {
  const roof = geometry.resolvedRoofSystem!;
  expect(roof.supported).toBe(true);
  return roof;
}

function rectangularLayout(lengthMeters: number, widthMeters: number): import('../types').DesignWallLayoutParameters {
  return createOutsideFaceRectangleLayout({
    lengthMeters,
    widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
}

function hipRoofSystem(overrides: Partial<RoofSystemSettings> = {}): RoofSystemSettings {
  return {
    ...createDefaultRoofSystemSettings(),
    roofType: 'hip',
    supportSystem: 'steel_hip_framing',
    gable: { ...createDefaultRoofSystemSettings().gable, enabled: false, rakedConcreteCapEnabled: false },
    ...overrides,
  };
}

function minCladdingEaveSurfaceY(roof: ReturnType<typeof roofFromGeometry>): number {
  return Math.min(...roof.roofTopPlanes.flatMap((plane) => plane.corners.map((corner) => corner.y)));
}

function expectPointClose(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
  precision = 3,
) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function hipMemberLength(member: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }): number {
  return Math.hypot(
    member.end.x - member.start.x,
    member.end.y - member.start.y,
    member.end.z - member.start.z,
  );
}

function purlinLength(purlin: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }): number {
  return hipMemberLength(purlin);
}

function triangleArea3d(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): number {
  const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const ac = new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z);
  return ab.cross(ac).length() / 2;
}

function roofPlaneArea3d(plane: { corners: { x: number; y: number; z: number }[] }): number {
  if (plane.corners.length === 3) {
    return triangleArea3d(plane.corners[0]!, plane.corners[1]!, plane.corners[2]!);
  }
  if (plane.corners.length === 4) {
    return (
      triangleArea3d(plane.corners[0]!, plane.corners[1]!, plane.corners[2]!) +
      triangleArea3d(plane.corners[0]!, plane.corners[2]!, plane.corners[3]!)
    );
  }
  return 0;
}

function averagePoints(points: { x: number; y: number; z: number }[]) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function eaveAndHighCorners(plane: { corners: { x: number; y: number; z: number }[] }) {
  const minY = Math.min(...plane.corners.map((corner) => corner.y));
  const eave = plane.corners.filter((corner) => Math.abs(corner.y - minY) < 0.01);
  const high = plane.corners.filter((corner) => Math.abs(corner.y - minY) >= 0.01);
  return eave.length >= 2 && high.length >= 1 ? { eave, high } : null;
}

function nearestCornerByPlan(
  corners: { x: number; y: number; z: number }[],
  point: { x: number; z: number },
) {
  return [...corners].sort(
    (a, b) =>
      Math.hypot(a.x - point.x, a.z - point.z) -
      Math.hypot(b.x - point.x, b.z - point.z),
  )[0]!;
}

function countHipMembersByKind(roof: ReturnType<typeof roofFromGeometry>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of roof.hipFramingMembers) {
    counts.set(member.memberKind, (counts.get(member.memberKind) ?? 0) + 1);
  }
  return counts;
}

function bearingTopCenter(bearing: { x: number; y: number; z: number }) {
  return {
    x: bearing.x,
    y: bearing.y + TRUSS_CHORD_PROFILE_METERS / 2,
    z: bearing.z,
  };
}

function planStationFromSpanCenter(
  point: { x: number; z: number },
  bearing: { x: number; z: number },
  oppositeBearing: { x: number; z: number },
) {
  const center = {
    x: (bearing.x + oppositeBearing.x) / 2,
    z: (bearing.z + oppositeBearing.z) / 2,
  };
  const outward = {
    x: bearing.x - center.x,
    z: bearing.z - center.z,
  };
  const outwardLength = Math.hypot(outward.x, outward.z) || 1;
  return ((point.x - center.x) * outward.x + (point.z - center.z) * outward.z) / outwardLength;
}

function planProjectionT(member: SteelMemberSegment, point: { x: number; z: number }): number {
  const span = {
    x: member.end.x - member.start.x,
    z: member.end.z - member.start.z,
  };
  const spanLenSq = span.x * span.x + span.z * span.z || 1;
  return ((point.x - member.start.x) * span.x + (point.z - member.start.z) * span.z) / spanLenSq;
}

function expectSamePlanSlope(
  primary: SteelMemberSegment,
  extension: SteelMemberSegment,
) {
  const primaryRun = Math.hypot(primary.end.x - primary.start.x, primary.end.z - primary.start.z) || 1;
  const extensionRun = Math.hypot(extension.end.x - extension.start.x, extension.end.z - extension.start.z) || 1;
  const primarySlope = (primary.end.y - primary.start.y) / primaryRun;
  const extensionSlope = (extension.end.y - extension.start.y) / extensionRun;
  expect(extensionSlope).toBeCloseTo(primarySlope, 3);
}

function supportingTopChordMember(
  truss: TrussPlacement,
  memberKind: 'top_chord_left' | 'top_chord_right',
  point: { x: number; z: number },
): SteelMemberSegment {
  const extensionKind =
    memberKind === 'top_chord_left'
      ? 'top_chord_left_eave_extension'
      : 'top_chord_right_eave_extension';
  const extension = truss.members.find((member) => member.memberKind === extensionKind);
  if (extension) {
    const t = planProjectionT(extension, point);
    if (t >= -0.001 && t <= 1.001) {
      return extension;
    }
  }
  return truss.members.find((member) => member.memberKind === memberKind)!;
}

describe('Roof framing — trusses, purlins, corrugated metal', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());

  it('every gable truss has two top chords and one bottom chord', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    expect(roof.trussPlacements.length).toBeGreaterThanOrEqual(2);
    for (const truss of roof.trussPlacements) {
      expect(truss.members.filter((member) => member.memberKind === 'top_chord_left')).toHaveLength(1);
      expect(truss.members.filter((member) => member.memberKind === 'top_chord_right')).toHaveLength(1);
      expect(truss.members.filter((member) => member.memberKind === 'bottom_chord')).toHaveLength(1);
    }
  });

  it('truss web members are mirrored about the truss centerline', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      const diagonals = truss.members.filter((member) => member.memberKind === 'diagonal_web');
      const verticals = truss.members.filter((member) => member.memberKind === 'vertical_web');
      expect(diagonals).toHaveLength(2);
      expect(verticals).toHaveLength(1);
      expect(trussMemberLength(diagonals[0]!)).toBeCloseTo(trussMemberLength(diagonals[1]!), 3);

      const spanMid = {
        x: (truss.bearingLeft.x + truss.bearingRight.x) / 2,
        y: (truss.bearingLeft.y + truss.bearingRight.y) / 2,
        z: (truss.bearingLeft.z + truss.bearingRight.z) / 2,
      };
      const spanDir = {
        x: truss.bearingRight.x - truss.bearingLeft.x,
        z: truss.bearingRight.z - truss.bearingLeft.z,
      };
      const spanLen = Math.hypot(spanDir.x, spanDir.z) || 1;
      const spanUnit = { x: spanDir.x / spanLen, z: spanDir.z / spanLen };
      const stationAlongSpan = (point: { x: number; z: number }) =>
        (point.x - spanMid.x) * spanUnit.x + (point.z - spanMid.z) * spanUnit.z;

      const bottomPoints = diagonals.map((member) =>
        member.start.y <= member.end.y ? member.start : member.end,
      );
      expect(Math.abs(stationAlongSpan(bottomPoints[0]!))).toBeCloseTo(
        Math.abs(stationAlongSpan(bottomPoints[1]!)),
        3,
      );
      expect(Math.sign(stationAlongSpan(bottomPoints[0]!))).toBe(-Math.sign(stationAlongSpan(bottomPoints[1]!)));
    }
  });

  it('every widened truss apex stays below the raised cladding ridge seam', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      expect(truss.apex.y).toBeGreaterThanOrEqual(roof.roofPeakY);
      expect(truss.apex.y).toBeLessThan(roof.ridgeCapPlacement!.start.y);
    }
  });

  it('truss bearing points align with base plates on Roof Beam top', () => {
    const settings = createDefaultRoofSystemSettings();
    const roof = roofFromGeometry(frameInfillGeometry(settings));
    const plateTop = roof.roofBeamTopY + settings.steelTrusses.basePlateThicknessMeters;
    for (const truss of roof.trussPlacements) {
      expect(truss.bearingLeft.y).toBeCloseTo(plateTop, 3);
      expect(truss.bearingRight.y).toBeCloseTo(plateTop, 3);
    }
  });

  it('no truss member extends below Roof Beam top elevation', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      expect(() => validateTrussPlacement(truss, roof.roofBeamTopY)).not.toThrow();
      for (const member of truss.members) {
        if (
          member.memberKind === 'top_chord_left' ||
          member.memberKind === 'top_chord_right' ||
          member.memberKind === 'top_chord_left_eave_extension' ||
          member.memberKind === 'top_chord_right_eave_extension'
        ) {
          continue;
        }
        expect(Math.min(member.start.y, member.end.y)).toBeGreaterThanOrEqual(roof.roofBeamTopY - 0.002);
      }
    }
  });

  it('splits side eave overhang into outward chord extensions from structural bearing tops', () => {
    const noOverhangSettings = { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0 };
    const noOverhang = roofFromGeometry(frameInfillGeometry(noOverhangSettings));
    for (const truss of noOverhang.trussPlacements) {
      expect(truss.members.filter((member) => member.memberKind === 'top_chord_left_eave_extension')).toHaveLength(0);
      expect(truss.members.filter((member) => member.memberKind === 'top_chord_right_eave_extension')).toHaveLength(0);
    }

    const overhangSettings = { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0.3 };
    const roof = roofFromGeometry(frameInfillGeometry(overhangSettings));
    const comparison = roofFromGeometry(frameInfillGeometry(noOverhangSettings));
    const supportOutset = overhangSettings.steelTrusses.basePlateLengthMeters / 2;
    expect(roof.roofPitchRadians).toBeCloseTo(comparison.roofPitchRadians, 6);
    expect(roof.structuralRidgeStart).toEqual(comparison.structuralRidgeStart);
    expect(roof.structuralRidgeEnd).toEqual(comparison.structuralRidgeEnd);

    for (const [index, truss] of roof.trussPlacements.entries()) {
      const comparisonTruss = comparison.trussPlacements[index]!;
      expect(truss.apex.y).toBeGreaterThanOrEqual(roof.roofPeakY);
      expect(truss.apex.y).toBeLessThan(roof.ridgeCapPlacement!.start.y);
      expect(truss.bearingLeft).toEqual(comparisonTruss.bearingLeft);
      expect(truss.bearingRight).toEqual(comparisonTruss.bearingRight);

      const leftBearingTop = bearingTopCenter(truss.bearingLeft);
      const rightBearingTop = bearingTopCenter(truss.bearingRight);
      const leftPrimary = truss.members.find((member) => member.memberKind === 'top_chord_left')!;
      const rightPrimary = truss.members.find((member) => member.memberKind === 'top_chord_right')!;
      expect(leftPrimary.end).toEqual(truss.apex);
      expect(rightPrimary.end).toEqual(truss.apex);
      expect(leftPrimary.start.y).toBeCloseTo(leftBearingTop.y, 3);
      expect(rightPrimary.start.y).toBeCloseTo(rightBearingTop.y, 3);

      const leftBearingStation = planStationFromSpanCenter(truss.bearingLeft, truss.bearingLeft, truss.bearingRight);
      const rightBearingStation = planStationFromSpanCenter(truss.bearingRight, truss.bearingRight, truss.bearingLeft);
      expect(
        planStationFromSpanCenter(leftPrimary.start, truss.bearingLeft, truss.bearingRight) - leftBearingStation,
      ).toBeCloseTo(supportOutset, 3);
      expect(
        planStationFromSpanCenter(rightPrimary.start, truss.bearingRight, truss.bearingLeft) - rightBearingStation,
      ).toBeCloseTo(supportOutset, 3);

      const bottomChord = truss.members.find((member) => member.memberKind === 'bottom_chord')!;
      expect(bottomChord.start.y).toBeCloseTo(leftBearingTop.y, 3);
      expect(bottomChord.end.y).toBeCloseTo(rightBearingTop.y, 3);
      expect(planStationFromSpanCenter(bottomChord.start, truss.bearingLeft, truss.bearingRight) - leftBearingStation)
        .toBeCloseTo(supportOutset, 3);
      expect(planStationFromSpanCenter(bottomChord.end, truss.bearingRight, truss.bearingLeft) - rightBearingStation)
        .toBeCloseTo(supportOutset, 3);

      const leftExtensions = truss.members.filter(
        (member) => member.memberKind === 'top_chord_left_eave_extension',
      );
      const rightExtensions = truss.members.filter(
        (member) => member.memberKind === 'top_chord_right_eave_extension',
      );
      expect(leftExtensions).toHaveLength(1);
      expect(rightExtensions).toHaveLength(1);

      const leftExtension = leftExtensions[0]!;
      const rightExtension = rightExtensions[0]!;
      expectPointClose(leftExtension.end, leftPrimary.start);
      expectPointClose(rightExtension.end, rightPrimary.start);
      expectSamePlanSlope(leftPrimary, leftExtension);
      expectSamePlanSlope(rightPrimary, rightExtension);
      expect(planStationFromSpanCenter(leftExtension.start, truss.bearingLeft, truss.bearingRight)).toBeGreaterThan(
        planStationFromSpanCenter(truss.bearingLeft, truss.bearingLeft, truss.bearingRight),
      );
      expect(planStationFromSpanCenter(rightExtension.start, truss.bearingRight, truss.bearingLeft)).toBeGreaterThan(
        planStationFromSpanCenter(truss.bearingRight, truss.bearingRight, truss.bearingLeft),
      );
      expect(() =>
        validateTrussPlacement(
          truss,
          roof.roofBeamTopY,
          overhangSettings.steelTrusses.basePlateThicknessMeters,
        ),
      ).not.toThrow();
    }

    expect(roof.purlinPlacements.length).toBeGreaterThan(0);
    expect(minCladdingEaveSurfaceY(roof)).toBeLessThan(roof.roofBeamTopY);
  });

  it('no truss member lies outside its assigned truss plane', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      for (const member of truss.members) {
        if (member.memberKind === 'top_chord_left' || member.memberKind === 'top_chord_right') {
          continue;
        }
        expect(distancePointToTrussPlaneForTests(member.start, truss.bearingLeft, truss.planeNormal)).toBeLessThan(
          0.002,
        );
        expect(distancePointToTrussPlaneForTests(member.end, truss.bearingLeft, truss.planeNormal)).toBeLessThan(
          0.002,
        );
      }
    }
  });

  it('trusses are perpendicular to the ridge', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    expect(roof.ridgeStart).toBeDefined();
    expect(roof.ridgeEnd).toBeDefined();
    const ridgeDir = {
      x: roof.ridgeEnd!.x - roof.ridgeStart!.x,
      z: roof.ridgeEnd!.z - roof.ridgeStart!.z,
    };
    const ridgeLen = Math.hypot(ridgeDir.x, ridgeDir.z) || 1;
    const ridgeUnit = { x: ridgeDir.x / ridgeLen, z: ridgeDir.z / ridgeLen };
    const first = roof.trussPlacements[0]!;
    const spanDir = {
      x: first.bearingRight.x - first.bearingLeft.x,
      z: first.bearingRight.z - first.bearingLeft.z,
    };
    const spanLen = Math.hypot(spanDir.x, spanDir.z) || 1;
    const spanUnit = { x: spanDir.x / spanLen, z: spanDir.z / spanLen };
    expect(Math.abs(spanUnit.x * ridgeUnit.x + spanUnit.z * ridgeUnit.z)).toBeLessThan(0.08);
  });

  it('purlins are parallel to the ridge', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    expect(roof.ridgeStart).toBeDefined();
    expect(roof.ridgeEnd).toBeDefined();
    const ridgeDir = {
      x: roof.ridgeEnd!.x - roof.ridgeStart!.x,
      z: roof.ridgeEnd!.z - roof.ridgeStart!.z,
    };
    const ridgeLen = Math.hypot(ridgeDir.x, ridgeDir.z) || 1;
    const ridgeUnit = { x: ridgeDir.x / ridgeLen, z: ridgeDir.z / ridgeLen };
    for (const purlin of roof.purlinPlacements) {
      const purlinDir = {
        x: purlin.end.x - purlin.start.x,
        z: purlin.end.z - purlin.start.z,
      };
      const purlinLen = Math.hypot(purlinDir.x, purlinDir.z) || 1;
      const purlinUnit = { x: purlinDir.x / purlinLen, z: purlinDir.z / purlinLen };
      expect(Math.abs(Math.abs(purlinUnit.x * ridgeUnit.x + purlinUnit.z * ridgeUnit.z) - 1)).toBeLessThan(0.08);
    }
  });

  it('every purlin sits on a truss top chord within tolerance', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const truss = roof.trussPlacements[Math.floor(roof.trussPlacements.length / 2)]!;
    for (const purlin of roof.purlinPlacements) {
      const plane = roof.roofTopPlanes.find((item) => item.id === purlin.slopePlaneId)!;
      const memberKind = purlin.slopePlaneId.endsWith('-2') || purlin.slopePlaneId.endsWith('-3')
        ? 'top_chord_right'
        : 'top_chord_left';
      const normal = normalizeOutwardRoofNormal(plane.normal);
      const center = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
      const topChord = supportingTopChordMember(truss, memberKind, center);
      const span = {
        x: topChord.end.x - topChord.start.x,
        z: topChord.end.z - topChord.start.z,
      };
      const spanLenSq = span.x * span.x + span.z * span.z || 1;
      const toCenter = { x: center.x - topChord.start.x, z: center.z - topChord.start.z };
      const t = Math.max(0, Math.min(1, (toCenter.x * span.x + toCenter.z * span.z) / spanLenSq));
      const chordCenter = {
        x: topChord.start.x + span.x * t,
        y: topChord.start.y + (topChord.end.y - topChord.start.y) * t,
        z: topChord.start.z + span.z * t,
      };
      const chordTop = resolveTrussTopChordUpperPoint({ chordCenter, outwardNormal: normal });
      const purlinBottom = {
        x: center.x - (normal.x * PURLIN_PROFILE_DEPTH_METERS) / 2,
        y: center.y - (normal.y * PURLIN_PROFILE_DEPTH_METERS) / 2,
        z: center.z - (normal.z * PURLIN_PROFILE_DEPTH_METERS) / 2,
      };
      const gap = distanceAlongRoofNormal(purlinBottom, chordTop, normal);
      expect(gap).toBeGreaterThanOrEqual(-0.006);
      expect(gap).toBeLessThanOrEqual(0.003);
    }
  });

  it('purlins are clocked perpendicular to the roof cladding with full top-flange contact', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const material = new THREE.MeshStandardMaterial();
    for (const purlin of roof.purlinPlacements) {
      const start = new THREE.Vector3(purlin.start.x, purlin.start.y, purlin.start.z);
      const end = new THREE.Vector3(purlin.end.x, purlin.end.y, purlin.end.z);
      const mesh = buildPurlinMesh({
        start,
        end,
        planeNormal: new THREE.Vector3(purlin.planeNormal.x, purlin.planeNormal.y, purlin.planeNormal.z),
        material,
      });

      const localTopNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion).normalize();
      expect(localTopNormal.x).toBeCloseTo(purlin.planeNormal.x, 3);
      expect(localTopNormal.y).toBeCloseTo(purlin.planeNormal.y, 3);
      expect(localTopNormal.z).toBeCloseTo(purlin.planeNormal.z, 3);

      for (const center of [purlin.start, purlin.end]) {
        const topFacePoint = {
          x: center.x + (purlin.planeNormal.x * PURLIN_PROFILE_DEPTH_METERS) / 2,
          y: center.y + (purlin.planeNormal.y * PURLIN_PROFILE_DEPTH_METERS) / 2,
          z: center.z + (purlin.planeNormal.z * PURLIN_PROFILE_DEPTH_METERS) / 2,
        };
        const sheetUnderside = {
          x: topFacePoint.x + purlin.planeNormal.x * PURLIN_TO_SHEET_CLEARANCE_METERS,
          y: topFacePoint.y + purlin.planeNormal.y * PURLIN_TO_SHEET_CLEARANCE_METERS,
          z: topFacePoint.z + purlin.planeNormal.z * PURLIN_TO_SHEET_CLEARANCE_METERS,
        };
        const gap = distanceAlongRoofNormal(topFacePoint, sheetUnderside, purlin.planeNormal);
        expect(gap).toBeCloseTo(PURLIN_TO_SHEET_CLEARANCE_METERS, 3);
      }
    }
  });

  it('no purlin hangs below its supporting truss top chord', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const truss = roof.trussPlacements[Math.floor(roof.trussPlacements.length / 2)]!;
    for (const purlin of roof.purlinPlacements) {
      const memberKind = purlin.slopePlaneId.endsWith('-2') || purlin.slopePlaneId.endsWith('-3')
        ? 'top_chord_right'
        : 'top_chord_left';
      const normal = normalizeOutwardRoofNormal(purlin.planeNormal);
      const center = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
      const topChord = supportingTopChordMember(truss, memberKind, center);
      const span = {
        x: topChord.end.x - topChord.start.x,
        z: topChord.end.z - topChord.start.z,
      };
      const spanLenSq = span.x * span.x + span.z * span.z || 1;
      const toCenter = { x: center.x - topChord.start.x, z: center.z - topChord.start.z };
      const t = Math.max(0, Math.min(1, (toCenter.x * span.x + toCenter.z * span.z) / spanLenSq));
      const chordCenter = {
        x: topChord.start.x + span.x * t,
        y: topChord.start.y + (topChord.end.y - topChord.start.y) * t,
        z: topChord.start.z + span.z * t,
      };
      const chordTop = resolveTrussTopChordUpperPoint({ chordCenter, outwardNormal: normal });
      const purlinBottom = {
        x: center.x - (normal.x * PURLIN_PROFILE_DEPTH_METERS) / 2,
        y: center.y - (normal.y * PURLIN_PROFILE_DEPTH_METERS) / 2,
        z: center.z - (normal.z * PURLIN_PROFILE_DEPTH_METERS) / 2,
      };
      expect(distanceAlongRoofNormal(purlinBottom, chordTop, normal)).toBeGreaterThanOrEqual(-0.006);
    }
  });

  it('steel-member render transforms match resolved start/end coordinates', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const truss = roof.trussPlacements[0]!;
    const member = truss.members[0]!;
    const slabOffsetY = preset.slab.slabThicknessMeters;
    const { start, end } = memberWorldEndpoints(member, slabOffsetY);
    const material = new THREE.MeshStandardMaterial();
    const mesh = createMemberBetween(start, end, 0.04, 0.04, material);
    expect(mesh.position.x).toBeCloseTo((start.x + end.x) / 2, 4);
    expect(mesh.position.y).toBeCloseTo((start.y + end.y) / 2, 4);
    expect(mesh.position.z).toBeCloseTo((start.z + end.z) / 2, 4);
    const up = new THREE.Vector3(0, 1, 0);
    const direction = end.clone().sub(start).normalize();
    const expected = new THREE.Quaternion().setFromUnitVectors(up, direction);
    expect(mesh.quaternion.x).toBeCloseTo(expected.x, 3);
    expect(mesh.quaternion.y).toBeCloseTo(expected.y, 3);
    expect(mesh.quaternion.z).toBeCloseTo(expected.z, 3);
    expect(mesh.quaternion.w).toBeCloseTo(expected.w, 3);
  });

  it('gable roof resolves truss planes perpendicular to ridge', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const first = roof.trussPlacements[0]!;
    const spanDx = Math.abs(first.bearingRight.x - first.bearingLeft.x);
    const spanDz = Math.abs(first.bearingRight.z - first.bearingLeft.z);
    expect(Math.max(spanDx, spanDz)).toBeGreaterThan(Math.min(spanDx, spanDz));
  });

  it('end trusses land at both roof-bearing ends along the ridge', () => {
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      steelTrusses: { ...createDefaultRoofSystemSettings().steelTrusses, maxSpacingMeters: 2.4 },
    };
    const roof = roofFromGeometry(frameInfillGeometry(roofSystem));
    expect(roof.ridgeStart).toBeDefined();
    expect(roof.ridgeEnd).toBeDefined();
    const ridgeStart = roof.structuralRidgeStart ?? roof.ridgeStart!;
    const ridgeEnd = roof.structuralRidgeEnd ?? roof.ridgeEnd!;
    const ridgeLength = roof.structuralRidgeLengthMeters;
    const ridgeUnitX = (ridgeEnd.x - ridgeStart.x) / (ridgeLength || 1);
    const ridgeUnitZ = (ridgeEnd.z - ridgeStart.z) / (ridgeLength || 1);
    const stationAlongRidge = (point: { x: number; z: number }) =>
      (point.x - ridgeStart.x) * ridgeUnitX + (point.z - ridgeStart.z) * ridgeUnitZ;
    const stations = roof.trussPlacements.map((truss) => stationAlongRidge(truss.bearingLeft));
    expect(Math.min(...stations)).toBeCloseTo(0, 2);
    expect(Math.max(...stations)).toBeCloseTo(ridgeLength, 2);
  });

  it('corrugated sheet area uses resolved sloped surface area plus waste', () => {
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      corrugatedMetal: { ...createDefaultRoofSystemSettings().corrugatedMetal, wastePercent: 10 },
    };
    const geometry = frameInfillGeometry(roofSystem);
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem,
    });
    const line = preview.find((entry) => entry.id === 'corrugated-metal-roofing');
    const roof = geometry.resolvedRoofSystem!;
    expect(line).toBeDefined();
    expect(line!.quantity).toBeCloseTo(roof.roofSurfaceAreaSquareMeters * 10.7639 * 1.1, 0);
  });

  it('exposes steel-trusses quantity for frame infill quantity summary', () => {
    const roofSystem = createDefaultRoofSystemSettings();
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem!;
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem,
    });

    const trussLine = preview.find((line) => line.id === 'steel-trusses');
    expect(trussLine).toBeDefined();
    expect(trussLine!.quantity).toBe(roof.trussCount);
    expect(trussLine!.quantity).toBeGreaterThan(0);
    expect(preview.some((line) => line.id === 'steel-roof-trusses')).toBe(false);
  });

  it('hip roof generates structural framing members without gable trusses or raked caps', () => {
    const roofSystem = hipRoofSystem();
    const geometry = frameInfillGeometry(roofSystem);
    expect(geometry.resolvedRoofSystem?.trussPlacements.length).toBe(0);
    expect(geometry.resolvedRoofSystem?.hipFramingMembers.length).toBeGreaterThan(0);
    expect(geometry.resolvedRoofSystem?.hipFramingMembers.every((member) => member.source === 'hip_roof_framing_solver')).toBe(true);
    expect(geometry.rakedCapPlacements?.length ?? 0).toBe(0);
  });

  it('rectangular 10 m by 6 m hip resolves ridge, hips, commons, jacks, and ridge-end support frames', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));
    const counts = countHipMembersByKind(roof);

    expect(roof.roofTopPlanes).toHaveLength(4);
    expect(roof.roofTopPlanes.filter((plane) => plane.corners.length === 4)).toHaveLength(2);
    expect(roof.roofTopPlanes.filter((plane) => plane.corners.length === 3)).toHaveLength(2);
    expect(roof.trussPlacements).toHaveLength(0);
    expect(counts.get('ridge')).toBe(1);
    expect(counts.get('hip')).toBe(4);
    expect(counts.get('ridge_end_frame')).toBe(4);
    expect(counts.get('ridge_end_frame_bottom')).toBe(2);
    expect(counts.get('ridge_end_frame_web')).toBe(2);
    expect(counts.get('common')).toBeGreaterThan(0);
    expect(counts.get('jack')).toBeGreaterThan(0);
    const ridgeEndFrameBottoms = roof.hipFramingMembers.filter(
      (member) => member.memberKind === 'ridge_end_frame_bottom',
    );
    expect(ridgeEndFrameBottoms).toHaveLength(2);
    for (const frameBottom of ridgeEndFrameBottoms) {
      expect(frameBottom.lengthMeters).toBeGreaterThan(4);
    }
    expect(roof.hipFramingMembers.every((member) => member.lengthMeters > 0.15)).toBe(true);
    for (const member of roof.hipFramingMembers) {
      expect(member.lengthMeters).toBeCloseTo(hipMemberLength(member), 6);
    }
  });

  it('evenly distributes requested interior hip mini trusses without moving ridge-end mini trusses', () => {
    const interiorTrussCount = 3;
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({
        eaveOverhangMeters: 0,
        peakHeightAboveRoofBeamMeters: 1.5,
        steelTrusses: {
          ...createDefaultRoofSystemSettings().steelTrusses,
          hipInteriorTrussCount: interiorTrussCount,
        },
      }),
      rectangularLayout(14, 6),
    ));
    const counts = countHipMembersByKind(roof);
    const ridgeStart = roof.ridgeStart!;
    const ridgeEnd = roof.ridgeEnd!;
    const ridgeVector = {
      x: ridgeEnd.x - ridgeStart.x,
      z: ridgeEnd.z - ridgeStart.z,
    };
    const ridgeLength = Math.hypot(ridgeVector.x, ridgeVector.z);
    const ridgeUnit = {
      x: ridgeVector.x / ridgeLength,
      z: ridgeVector.z / ridgeLength,
    };
    const stationAlongRidge = (point: { x: number; z: number }) =>
      (point.x - ridgeStart.x) * ridgeUnit.x + (point.z - ridgeStart.z) * ridgeUnit.z;

    const endWebs = roof.hipFramingMembers.filter(
      (member) =>
        member.memberKind === 'ridge_end_frame_web' &&
        member.id.startsWith('hip-ridge-end-frame-'),
    );
    const interiorWebs = roof.hipFramingMembers
      .filter(
        (member) =>
          member.memberKind === 'ridge_end_frame_web' &&
          member.id.startsWith('hip-ridge-interior-frame-'),
      )
      .sort((a, b) => stationAlongRidge(a.end) - stationAlongRidge(b.end));

    expect(counts.get('ridge_end_frame')).toBe(2 * (2 + interiorTrussCount));
    expect(counts.get('ridge_end_frame_bottom')).toBe(2 + interiorTrussCount);
    expect(counts.get('ridge_end_frame_web')).toBe(2 + interiorTrussCount);
    expect(endWebs).toHaveLength(2);
    expect(interiorWebs).toHaveLength(interiorTrussCount);
    expect(stationAlongRidge(endWebs.find((member) => member.id.endsWith('start-web'))!.end)).toBeCloseTo(0, 3);
    expect(stationAlongRidge(endWebs.find((member) => member.id.endsWith('end-web'))!.end)).toBeCloseTo(ridgeLength, 3);

    for (const [index, web] of interiorWebs.entries()) {
      expect(stationAlongRidge(web.end)).toBeCloseTo(
        (ridgeLength * (index + 1)) / (interiorTrussCount + 1),
        3,
      );
    }
  });

  it('extends hip mini-truss top chords to the eave purlin line while keeping bottom chords on the roof beam', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({
        eaveOverhangMeters: 0.3,
        peakHeightAboveRoofBeamMeters: 1.5,
        steelTrusses: {
          ...createDefaultRoofSystemSettings().steelTrusses,
          hipInteriorTrussCount: 2,
        },
      }),
      rectangularLayout(14, 6),
    ));

    const topChords = roof.hipFramingMembers.filter((member) => member.memberKind === 'ridge_end_frame');
    const bottomChords = roof.hipFramingMembers.filter((member) => member.memberKind === 'ridge_end_frame_bottom');
    const claddingSideEaveAbsZ = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.z)));
    const structuralSideBearingAbsZ = Math.max(
      ...roof.structuralBearingPerimeter.map((point) => Math.abs(point.z)),
    );

    expect(topChords).toHaveLength(8);
    for (const chord of topChords) {
      expect(Math.abs(Math.abs(chord.start.z) - claddingSideEaveAbsZ)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(chord.start.z) - structuralSideBearingAbsZ)).toBeGreaterThan(0.1);
    }

    expect(bottomChords).toHaveLength(4);
    for (const chord of bottomChords) {
      expect(Math.abs(Math.abs(chord.start.z) - structuralSideBearingAbsZ)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(chord.end.z) - structuralSideBearingAbsZ)).toBeLessThan(0.01);
    }
  });

  it('keeps hip end jack rafters while adding lower side-eave corner supports', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const endJacks = roof.hipFramingMembers.filter((member) => member.id.startsWith('hip-jack-end-'));
    const cornerSupports = roof.hipFramingMembers.filter(
      (member) => member.memberKind === 'hip_corner_support',
    );
    const sideLegs = roof.hipFramingMembers.filter(
      (member) => member.memberKind === 'ridge_end_frame',
    );
    const sideEaveAbsZ = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.z)));
    const endEaveAbsX = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.x)));
    const ridgeEndAbsX = Math.max(
      Math.abs(roof.ridgeStart?.x ?? 0),
      Math.abs(roof.ridgeEnd?.x ?? 0),
    );

    expect(endJacks).toHaveLength(4);
    for (const jack of endJacks) {
      expect(Math.abs(Math.abs(jack.start.x) - endEaveAbsX)).toBeLessThan(0.01);
      expect(Math.abs(jack.start.z)).toBeLessThan(sideEaveAbsZ);
      expect(Math.abs(jack.end.z)).toBeLessThan(sideEaveAbsZ);
    }

    expect(cornerSupports).toHaveLength(4);
    for (const support of cornerSupports) {
      expect(Math.abs(support.end.x - support.start.x)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(support.start.z) - sideEaveAbsZ)).toBeLessThan(0.01);
      expect(Math.abs(support.start.x)).toBeLessThan(endEaveAbsX - 0.01);
      expect(Math.abs(support.end.z)).toBeLessThan(sideEaveAbsZ);
    }

    expect(sideLegs).toHaveLength(4);
    for (const sideLeg of sideLegs) {
      expect(Math.abs(sideLeg.end.x - sideLeg.start.x)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(sideLeg.start.x) - ridgeEndAbsX)).toBeLessThan(0.01);
      expect(Math.abs(Math.abs(sideLeg.start.z) - sideEaveAbsZ)).toBeLessThan(0.01);
      expect(Math.abs(sideLeg.end.z)).toBeLessThan(0.01);
    }
  });

  it('hip steel framing sits on the roof beam and below the purlin and cladding stack', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    for (const member of roof.hipFramingMembers) {
      expect(Math.min(member.start.y, member.end.y)).toBeGreaterThanOrEqual(
        roof.roofBeamTopY + TRUSS_CHORD_PROFILE_METERS / 2 - 0.003,
      );
      for (const endpoint of [member.start, member.end]) {
        const surface = roof.roofTopPlanes
          .map((plane) => {
            const surfaceY = elevationOnRoofPlaneAtPoint(plane, endpoint.x, endpoint.z);
            return surfaceY == null ? null : { plane, surface: { x: endpoint.x, y: surfaceY, z: endpoint.z } };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry != null)
          .sort((a, b) => b.surface.y - a.surface.y)[0];

        expect(surface).toBeDefined();
        const normal = normalizeOutwardRoofNormal(surface!.plane.normal);
        const steelTop = offsetPointAlongRoofNormal(endpoint, normal, TRUSS_CHORD_PROFILE_METERS / 2);
        const purlinBottom = offsetPointAlongRoofNormal(
          surface!.surface,
          normal,
          TRUSS_CHORD_PROFILE_METERS / 2 + PURLIN_TO_CHORD_CLEARANCE_METERS,
        );
        expect(distanceAlongRoofNormal(steelTop, purlinBottom, normal)).toBeGreaterThanOrEqual(-0.003);
      }
    }
  });

  it('square pyramid hip resolves four hips to an apex with no ridge or ridge-end support frames', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0 }),
      rectangularLayout(6, 6),
    ));
    const counts = countHipMembersByKind(roof);

    expect(roof.peakPoint).toBeDefined();
    expect(roof.ridgeStart).toBeUndefined();
    expect(roof.ridgeEnd).toBeUndefined();
    expect(counts.get('ridge') ?? 0).toBe(0);
    expect(counts.get('ridge_end_frame') ?? 0).toBe(0);
    expect(counts.get('ridge_end_frame_bottom') ?? 0).toBe(0);
    expect(counts.get('ridge_end_frame_web') ?? 0).toBe(0);
    expect(counts.get('hip')).toBe(4);
    expect(roof.trussPlacements).toHaveLength(0);
  });

  it('hip purlins are clipped on all four planes and triangular end rows shorten toward the ridge endpoints', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    expect(new Set(roof.purlinPlacements.map((purlin) => purlin.slopePlaneId)).size).toBe(4);
    const triangularPlaneIds = new Set(
      roof.roofTopPlanes.filter((plane) => plane.corners.length === 3).map((plane) => plane.id),
    );
    const triangularPurlins = roof.purlinPlacements.filter((purlin) => triangularPlaneIds.has(purlin.slopePlaneId));
    expect(triangularPurlins.length).toBeGreaterThan(1);
    const lengthsByRow = [...triangularPurlins]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map((purlin) => purlinLength(purlin));
    expect(lengthsByRow[0]).toBeGreaterThan(lengthsByRow[lengthsByRow.length - 1]!);
    expect(lengthsByRow[lengthsByRow.length - 1]!).toBeGreaterThan(0.15);
  });

  it('hip estimate uses actual hip member and clipped purlin lengths', () => {
    const roofSystem = hipRoofSystem({ eaveOverhangMeters: 0, peakHeightAboveRoofBeamMeters: 1.5 });
    const geometry = frameInfillGeometry(roofSystem, rectangularLayout(10, 6));
    const roof = geometry.resolvedRoofSystem!;
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem,
    });

    const expectedHipLength = roof.hipFramingMembers.reduce((sum, member) => sum + member.lengthMeters, 0);
    const expectedPurlinLength = roof.purlinPlacements.reduce((sum, purlin) => sum + purlinLength(purlin), 0);
    const hipLine = preview.find((line) => line.id === 'hip-steel-framing');
    const frameLine = preview.find((line) => line.id === 'hip-ridge-end-support-frames');
    const purlinLine = preview.find((line) => line.id === 'steel-purlins');

    expect(hipLine?.quantity).toBeCloseTo(metersToFeet(expectedHipLength), 2);
    expect(frameLine?.quantity).toBe(2);
    expect(purlinLine?.quantity).toBeCloseTo(metersToFeet(expectedPurlinLength), 2);
    expect(preview.some((line) => line.id === 'steel-trusses')).toBe(false);
  });

  it('rectangular hip resolves ridge caps on all hip ridges with the top ridge last', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    expect(roof.ridgeCapPlacement).toBeNull();
    expect(roof.ridgeCapPlacements).toHaveLength(5);
    const topRidgeCap = roof.ridgeCapPlacements[roof.ridgeCapPlacements.length - 1]!;
    expect(Math.abs(topRidgeCap.start.y - topRidgeCap.end.y)).toBeLessThan(0.01);
    expect(Math.hypot(topRidgeCap.end.x - topRidgeCap.start.x, topRidgeCap.end.z - topRidgeCap.start.z)).toBeCloseTo(
      roof.claddingRidgeLengthMeters,
      2,
    );
    for (const hipCap of roof.ridgeCapPlacements.slice(0, -1)) {
      expect(Math.abs(hipCap.start.y - hipCap.end.y)).toBeGreaterThan(0.5);
    }
    for (const cap of roof.ridgeCapPlacements) {
      expect(cap.adjacentPlaneIds).toHaveLength(2);
      for (const endpoint of [cap.start, cap.end]) {
        expect(endpoint.y).toBeGreaterThan(roof.roofBeamTopY - 0.4);
        expect(endpoint.y).toBeLessThan(roof.roofPeakY + 0.25);
      }
    }
  });

  it('rectangular hip cladding display keeps all four sheet planes visible', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    expect(roof.claddingDisplayPlanes).toHaveLength(4);
    expect(roof.claddingDisplayPlanes.filter((plane) => plane.corners.length === 4)).toHaveLength(2);
    expect(roof.claddingDisplayPlanes.filter((plane) => plane.corners.length === 3)).toHaveLength(2);
    for (const plane of roof.claddingDisplayPlanes) {
      expect(roofPlaneArea3d(plane)).toBeGreaterThan(1);
    }
  });

  it('rectangular hip cladding display welds shared hip sheet seams', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const displayBySourceId = new Map(
      roof.claddingDisplayPlanes.map((plane) => [plane.id.replace(/-cladding-display$/, ''), plane]),
    );
    for (const cap of roof.ridgeCapPlacements) {
      expect(cap.adjacentPlaneIds).toHaveLength(2);
      const adjacentPlanes = cap.adjacentPlaneIds!.map((id) => displayBySourceId.get(id));
      expect(adjacentPlanes.every((plane) => plane != null)).toBe(true);
      const startCorners = adjacentPlanes.map((plane) => nearestCornerByPlan(plane!.corners, cap.start));
      const endCorners = adjacentPlanes.map((plane) => nearestCornerByPlan(plane!.corners, cap.end));
      expect(hipMemberLength({ start: startCorners[0]!, end: startCorners[1]! })).toBeLessThan(0.006);
      expect(hipMemberLength({ start: endCorners[0]!, end: endCorners[1]! })).toBeLessThan(0.006);
    }
  });

  it('hip cladding display sits above purlin tops on every roof plane', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const displayBySourceId = new Map(
      roof.claddingDisplayPlanes.map((plane) => [plane.id.replace(/-cladding-display$/, ''), plane]),
    );
    for (const purlin of roof.purlinPlacements) {
      const displayPlane = displayBySourceId.get(purlin.slopePlaneId);
      expect(displayPlane).toBeDefined();
      const center = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
      const sheetY = elevationOnRoofPlaneAtPoint(displayPlane!, center.x, center.z);
      expect(sheetY).not.toBeNull();
      const purlinTop = offsetPointAlongRoofNormal(center, purlin.planeNormal, PURLIN_PROFILE_DEPTH_METERS / 2);
      expect(
        distanceAlongRoofNormal(purlinTop, { ...center, y: sheetY! }, purlin.planeNormal),
      ).toBeGreaterThanOrEqual(PURLIN_TO_SHEET_CLEARANCE_METERS - 0.003);
    }
  });

  it('hip top chords extend to cladding eaves so the outer purlin row is supported', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const hipRafterStarts = roof.hipFramingMembers
      .filter((member) => member.memberKind === 'hip')
      .map((member) => member.start);
    for (const eaveCorner of roof.claddingPerimeter) {
      expect(
        hipRafterStarts.some(
          (start) => Math.hypot(start.x - eaveCorner.x, start.z - eaveCorner.z) < 0.01,
        ),
      ).toBe(true);
    }
  });

  it('hip cladding display overhangs the eave purlin face by one inch', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const claddingMaxX = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.x)));
    const claddingMaxZ = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.z)));
    const sheetMaxX = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.x)));
    const sheetMaxZ = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.z)));

    expect(sheetMaxX - claddingMaxX).toBeGreaterThanOrEqual(ROOF_SHEET_EAVE_OVERHANG_METERS);
    expect(sheetMaxX - claddingMaxX).toBeLessThanOrEqual(
      ROOF_SHEET_EAVE_OVERHANG_METERS + HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS + 0.001,
    );
    expect(sheetMaxZ - claddingMaxZ).toBeGreaterThanOrEqual(ROOF_SHEET_EAVE_OVERHANG_METERS);
    expect(sheetMaxZ - claddingMaxZ).toBeLessThanOrEqual(
      ROOF_SHEET_EAVE_OVERHANG_METERS + HIP_SHEET_SEAM_WELD_ALLOWANCE_METERS + 0.001,
    );

    const eavePurlins = roof.purlinPlacements.filter((purlin) => purlin.rowIndex === 0);
    expect(eavePurlins.length).toBeGreaterThan(0);
    for (const purlin of eavePurlins) {
      const sourcePlane = roof.roofTopPlanes.find((plane) => plane.id === purlin.slopePlaneId);
      const sheetPlane = roof.claddingDisplayPlanes.find((plane) => plane.id.replace(/-cladding-display$/, '') === purlin.slopePlaneId);
      expect(sourcePlane).toBeDefined();
      expect(sheetPlane).toBeDefined();
      const sourceCorners = eaveAndHighCorners(sourcePlane!);
      const sheetCorners = eaveAndHighCorners(sheetPlane!);
      expect(sourceCorners).toBeTruthy();
      expect(sheetCorners).toBeTruthy();

      const sourceEaveMid = averagePoints(sourceCorners!.eave);
      const sourceHighMid = averagePoints(sourceCorners!.high);
      const sheetEaveMid = averagePoints(sheetCorners!.eave);
      const outboardAxis = new THREE.Vector3(
        sourceEaveMid.x - sourceHighMid.x,
        sourceEaveMid.y - sourceHighMid.y,
        sourceEaveMid.z - sourceHighMid.z,
      ).normalize();
      const purlinRun = new THREE.Vector3(
        purlin.end.x - purlin.start.x,
        purlin.end.y - purlin.start.y,
        purlin.end.z - purlin.start.z,
      ).normalize();
      const purlinNormal = new THREE.Vector3(purlin.planeNormal.x, purlin.planeNormal.y, purlin.planeNormal.z).normalize();
      const purlinCrossSlope = new THREE.Vector3().crossVectors(purlinRun, purlinNormal).normalize();
      if (purlinCrossSlope.dot(outboardAxis) < 0) {
        purlinCrossSlope.negate();
      }
      const purlinCenter = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
      const purlinOuterFace = new THREE.Vector3(purlinCenter.x, purlinCenter.y, purlinCenter.z).add(
        purlinCrossSlope.multiplyScalar(PURLIN_PROFILE_WIDTH_METERS / 2),
      );
      const sheetEdge = new THREE.Vector3(sheetEaveMid.x, sheetEaveMid.y, sheetEaveMid.z);
      expect(sheetEdge.sub(purlinOuterFace).dot(outboardAxis)).toBeGreaterThanOrEqual(
        ROOF_SHEET_EAVE_OVERHANG_METERS - 0.003,
      );
    }
  });

  it('hip ridge cap centerlines follow the sheet hip edges out to the one-inch overhang', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(10, 6),
    ));

    const sheetMaxX = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.x)));
    const sheetMaxZ = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.z)));
    const slopedCaps = roof.ridgeCapPlacements.filter((cap) => Math.abs(cap.start.y - cap.end.y) > 0.01);
    expect(slopedCaps).toHaveLength(4);

    for (const cap of slopedCaps) {
      const eaveEndpoint = cap.start.y < cap.end.y ? cap.start : cap.end;
      expect(
        Math.abs(Math.abs(eaveEndpoint.x) - sheetMaxX) < 0.001 ||
          Math.abs(Math.abs(eaveEndpoint.z) - sheetMaxZ) < 0.001,
      ).toBe(true);
    }
  });

  it('square pyramid hip resolves ridge caps on the four sloped hips only', () => {
    const roof = roofFromGeometry(frameInfillGeometry(
      hipRoofSystem({ eaveOverhangMeters: 0.3, peakHeightAboveRoofBeamMeters: 1.5 }),
      rectangularLayout(6, 6),
    ));

    expect(roof.ridgeCapPlacement).toBeNull();
    expect(roof.ridgeCapPlacements).toHaveLength(4);
    expect(roof.ridgeCapPlacements.every((cap) => Math.abs(cap.start.y - cap.end.y) > 0.5)).toBe(true);
  });

  it('base-plate and anchor-bolt counts use two bearings per truss', () => {
    const geometry = frameInfillGeometry(createDefaultRoofSystemSettings());
    const roof = geometry.resolvedRoofSystem!;
    const settings = createDefaultRoofSystemSettings();
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem: settings,
    });
    const plates = preview.find((line) => line.id === 'truss-base-plates');
    const bolts = preview.find((line) => line.id === 'truss-anchor-bolts');
    expect(plates?.quantity).toBe(roof.trussCount * 2);
    expect(bolts?.quantity).toBe(roof.trussCount * 2 * settings.steelTrusses.anchorBoltsPerBearing);
  });

  it('even truss station spacing matches formula', () => {
    const resolution = resolveEvenStations(6, 2.4);
    expect(resolution.count).toBe(4);
    expect(resolution.actualSpacingMeters).toBeCloseTo(2, 3);
    expect(resolution.stations[0]).toBe(0);
    expect(resolution.stations[resolution.stations.length - 1]).toBeCloseTo(6, 3);
  });

  it('camera bounds include resolved roof peak and eave overhang', () => {
    const geometry = frameInfillGeometry({
      ...createDefaultRoofSystemSettings(),
      eaveOverhangMeters: 0.5,
      peakHeightAboveRoofBeamMeters: 2,
    });
    const roof = geometry.resolvedRoofSystem!;
    const bounds = deriveDesignSceneBounds({
      geometryResult: geometry,
      wallLayout: preset.wallLayout,
      slab: preset.slab,
    });
    expect(bounds.maxY).toBeGreaterThan(roof.roofPeakY);
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(roof.exteriorRoofBeamBounds.widthMeters);
  });

  it('truss member lengths are positive for all resolved segments', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      for (const member of truss.members) {
        expect(trussMemberLength(member)).toBeGreaterThan(0.05);
      }
    }
  });

  it('purlins span the full ridge length at every row', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    expect(roof.ridgeLengthMeters).toBeGreaterThan(0);
    for (const purlin of roof.purlinPlacements) {
      const purlinLength = Math.hypot(
        purlin.end.x - purlin.start.x,
        purlin.end.y - purlin.start.y,
        purlin.end.z - purlin.start.z,
      );
      expect(purlinLength).toBeGreaterThan(roof.ridgeLengthMeters * 0.95);
    }
  });

  it('each purlin row exists on both roof slopes', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const rowsByIndex = new Map<number, Set<string>>();
    for (const purlin of roof.purlinPlacements) {
      const rows = rowsByIndex.get(purlin.rowIndex) ?? new Set<string>();
      rows.add(purlin.slopePlaneId);
      rowsByIndex.set(purlin.rowIndex, rows);
    }
    for (const planeIds of rowsByIndex.values()) {
      expect(planeIds.size).toBe(2);
    }
  });

  it('adds a purlin row at the truss eave when side eave overhang is present', () => {
    const settings = { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0.5 };
    const roof = roofFromGeometry(frameInfillGeometry(settings));
    const withoutOverhang = roofFromGeometry(
      frameInfillGeometry({ ...settings, eaveOverhangMeters: 0 }),
    );
    const { rowTs } = buildPurlinRowStationFractions({
      slopeLengthMeters: roof.claddingRafterLengthMeters,
      structuralHalfRunMeters: withoutOverhang.rafterRunMeters,
      sideEaveOverhangMeters: settings.eaveOverhangMeters,
      maxPurlinSpacingMeters: settings.purlins.maxSpacingMeters,
    });
    expect(rowTs[0]).toBeCloseTo(0, 3);
    const trussEaveT = settings.eaveOverhangMeters / roof.claddingRafterRunMeters;
    expect(rowTs.some((t) => Math.abs(t - trussEaveT) < 0.01)).toBe(true);
    expect(rowTs[rowTs.length - 1]).toBeCloseTo(1, 3);
    expect(roof.purlinRowsPerSlope).toBeGreaterThan(withoutOverhang.purlinRowsPerSlope);

    const trussEaveRowIndex = rowTs.findIndex((t) => Math.abs(t - trussEaveT) < 0.01);
    expect(trussEaveRowIndex).toBeGreaterThan(0);
    const trussEavePurlins = roof.purlinPlacements.filter((p) => p.rowIndex === trussEaveRowIndex);
    expect(trussEavePurlins.length).toBe(2);

    const interiorOnlyRows = buildPurlinRowStationFractions({
      slopeLengthMeters: withoutOverhang.claddingRafterLengthMeters,
      structuralHalfRunMeters: withoutOverhang.rafterRunMeters,
      sideEaveOverhangMeters: 0,
      maxPurlinSpacingMeters: settings.purlins.maxSpacingMeters,
    }).rowsPerSlope;
    expect(roof.purlinRowsPerSlope).toBeGreaterThan(interiorOnlyRows);
  });

  it('does not duplicate the truss eave purlin row when eave overhang is zero', () => {
    const settings = { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0 };
    const roof = roofFromGeometry(frameInfillGeometry(settings));
    const { rowTs } = buildPurlinRowStationFractions({
      slopeLengthMeters: roof.claddingRafterLengthMeters,
      structuralHalfRunMeters: roof.rafterRunMeters,
      sideEaveOverhangMeters: 0,
      maxPurlinSpacingMeters: settings.purlins.maxSpacingMeters,
    });
    expect(rowTs[0]).toBeCloseTo(0, 3);
    expect(rowTs.filter((t) => t < 0.01).length).toBe(1);
  });

  it('resolves a horizontal ridge cap between ridge endpoints', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const placement = roof.ridgeCapPlacement;
    expect(placement).not.toBeNull();
    expect(placement!.start.x).toBeCloseTo(roof.ridgeStart!.x, 3);
    expect(placement!.start.z).toBeCloseTo(roof.ridgeStart!.z, 3);
    expect(placement!.end.x).toBeCloseTo(roof.ridgeEnd!.x, 3);
    expect(placement!.end.z).toBeCloseTo(roof.ridgeEnd!.z, 3);
    expect(placement!.start.y).toBeGreaterThan(roof.roofPeakY);
    expect(Math.abs(placement!.end.y - placement!.start.y)).toBeLessThan(0.002);
    expect(placement!.thicknessMeters).toBeLessThanOrEqual(0.05);
    expect(() => validateRidgeCapPlacement(placement!)).not.toThrow();
  });

  it('createFoldedRidgeCapGroup builds one folded piece seated on the ridge', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const placement = roof.ridgeCapPlacement!;
    const material = new THREE.MeshStandardMaterial();
    const start = new THREE.Vector3(placement.start.x, placement.start.y, placement.start.z);
    const end = new THREE.Vector3(placement.end.x, placement.end.y, placement.end.z);
    const group = createFoldedRidgeCapGroup(
      start,
      end,
      placement.widthMeters,
      placement.thicknessMeters,
      placement.roofAngleRadians,
      material,
    );
    expect(group.children.length).toBe(1);
    group.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(size);
    const ridgeLength = Math.hypot(end.x - start.x, end.z - start.z);
    expect(Math.max(size.x, size.z)).toBeGreaterThan(ridgeLength * 0.9);
    expect(size.y).toBeLessThan(0.25);
    const mesh = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const position = mesh.geometry.getAttribute('position');
    const closestDistanceTo = (target: THREE.Vector3) => {
      let closest = Infinity;
      for (let index = 0; index < position.count; index += 1) {
        closest = Math.min(
          closest,
          Math.hypot(
            position.getX(index) - target.x,
            position.getY(index) - target.y,
            position.getZ(index) - target.z,
          ),
        );
      }
      return closest;
    };
    expect(closestDistanceTo(start)).toBeLessThan(0.001);
    expect(closestDistanceTo(end)).toBeLessThan(0.001);
  });

  it('hip folded ridge caps keep the centerline endpoint and miter the bottom wing edges inward', () => {
    const material = new THREE.MeshStandardMaterial();
    const start = new THREE.Vector3(0, 3, 0);
    const end = new THREE.Vector3(2, 3, 0);
    const group = createFoldedRidgeCapGroup(
      start,
      end,
      0.3,
      0.02,
      Math.atan2(1.5, 3),
      material,
      { miterBottomEnds: true },
    );
    const mesh = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const position = mesh.geometry.getAttribute('position');
    const outerXs: number[] = [];
    let hasStartCenterline = false;
    let hasEndCenterline = false;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      if (Math.abs(x - start.x) < 0.001 && Math.abs(z - start.z) < 0.001) {
        hasStartCenterline = true;
      }
      if (Math.abs(x - end.x) < 0.001 && Math.abs(z - end.z) < 0.001) {
        hasEndCenterline = true;
      }
      if (Math.abs(z) > 0.01) {
        outerXs.push(x);
      }
    }

    expect(hasStartCenterline).toBe(true);
    expect(hasEndCenterline).toBe(true);
    expect(Math.min(...outerXs)).toBeGreaterThan(0.12);
    expect(Math.max(...outerXs)).toBeLessThan(1.88);
  });

  it('no truss member extends above the raised cladding surface', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      for (const member of truss.members) {
        const raisedSurfaceY =
          roof.claddingDisplayPlanes
            .map((plane) => elevationOnRoofPlaneAtPoint(plane, member.end.x, member.end.z))
            .filter((y): y is number => y != null)
            .sort((a, b) => b - a)[0] ?? roof.ridgeCapPlacement?.start.y ?? roof.roofPeakY;
        expect(Math.max(member.start.y, member.end.y)).toBeLessThanOrEqual(raisedSurfaceY + 0.002);
      }
    }
  });

  it('hip roof does not resolve a gable ridge cap placement', () => {
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip' as const,
      supportSystem: 'steel_hip_framing' as const,
    };
    const roof = roofFromGeometry(frameInfillGeometry(roofSystem));
    expect(roof.ridgeCapPlacement).toBeNull();
  });
});
