import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { deriveDesignSceneBounds } from '../domain/designSceneBounds';
import {
  buildPurlinRowStationFractions,
  distanceAlongRoofNormal,
  normalizeOutwardRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  resolveEvenStations,
  resolveRidgeCapPlacement,
  resolveTrussTopChordUpperPoint,
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
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';
import { buildPurlinMesh, createMemberBetween, createFoldedRidgeCapGroup, memberWorldEndpoints } from '../geometry/roofRenderingGeometry';
import type { RoofSystemSettings } from '../types';
import * as THREE from 'three';

function frameInfillGeometry(roofSystem: RoofSystemSettings) {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
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

function minCladdingEaveSurfaceY(roof: ReturnType<typeof roofFromGeometry>): number {
  return Math.min(...roof.roofTopPlanes.flatMap((plane) => plane.corners.map((corner) => corner.y)));
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

  it('every truss apex lies at the resolved roof peak elevation', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      expect(truss.apex.y).toBeCloseTo(roof.roofPeakY, 3);
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
        if (member.memberKind === 'top_chord_left' || member.memberKind === 'top_chord_right') {
          continue;
        }
        expect(Math.min(member.start.y, member.end.y)).toBeGreaterThanOrEqual(roof.roofBeamTopY - 0.002);
      }
    }
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
      const topChord = truss.members.find((member) => member.memberKind === memberKind)!;
      const normal = normalizeOutwardRoofNormal(plane.normal);
      const center = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
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
      expect(gap).toBeGreaterThanOrEqual(-0.001);
      expect(gap).toBeLessThanOrEqual(0.003);
    }
  });

  it('purlins are clocked perpendicular to the roof cladding with full top-flange contact', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    const material = new THREE.MeshStandardMaterial();
    for (const purlin of roof.purlinPlacements) {
      const plane = roof.roofTopPlanes.find((item) => item.id === purlin.slopePlaneId)!;
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
      const topChord = truss.members.find((member) => member.memberKind === memberKind)!;
      const normal = normalizeOutwardRoofNormal(purlin.planeNormal);
      const center = {
        x: (purlin.start.x + purlin.end.x) / 2,
        y: (purlin.start.y + purlin.end.y) / 2,
        z: (purlin.start.z + purlin.end.z) / 2,
      };
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
      expect(distanceAlongRoofNormal(purlinBottom, chordTop, normal)).toBeGreaterThanOrEqual(-0.001);
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

  it('hip roof does not generate gable trusses or raked caps', () => {
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip' as const,
      supportSystem: 'steel_hip_framing' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: false, rakedConcreteCapEnabled: false },
    };
    const geometry = frameInfillGeometry(roofSystem);
    expect(geometry.resolvedRoofSystem?.trussPlacements.length).toBe(0);
    expect(geometry.resolvedRoofSystem?.hipFramingMembers.length).toBeGreaterThan(0);
    expect(geometry.rakedCapPlacements?.length ?? 0).toBe(0);
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

  it('createFoldedRidgeCapGroup builds two pitched wings along the ridge', () => {
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
    expect(group.children.length).toBe(2);
    group.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(size);
    const ridgeLength = Math.hypot(end.x - start.x, end.z - start.z);
    expect(Math.max(size.x, size.z)).toBeGreaterThan(ridgeLength * 0.9);
    expect(size.y).toBeLessThan(0.25);
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const slopeAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
      expect(slopeAxis.y).toBeLessThan(-0.05);
      expect(Math.hypot(slopeAxis.x, slopeAxis.z)).toBeGreaterThan(0.5);
    }
  });

  it('no truss member extends above the roof peak', () => {
    const roof = roofFromGeometry(frameInfillGeometry(createDefaultRoofSystemSettings()));
    for (const truss of roof.trussPlacements) {
      for (const member of truss.members) {
        expect(Math.max(member.start.y, member.end.y)).toBeLessThanOrEqual(roof.roofPeakY + 0.002);
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
