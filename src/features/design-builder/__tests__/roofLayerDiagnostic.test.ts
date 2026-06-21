import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  distanceAlongRoofNormal,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_CHORD_CLEARANCE_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  resolveTrussTopChordUpperPoint,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';

describe('roof layer stack', () => {
  it('seats purlins on truss top chords with cladding above purlins and chords clearing roof beams', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        foundationSettings: normalizeRcFrameFoundationSettings(preset.foundationSettings),
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
        roofSystem: createDefaultRoofSystemSettings(),
      }),
    );
    const roof = geometry.resolvedRoofSystem!;
    const truss = roof.trussPlacements[Math.floor(roof.trussPlacements.length / 2)]!;
    const topLeft = truss.members.find((m) => m.memberKind === 'top_chord_left')!;
    const purlin = roof.purlinPlacements.find((p) => p.rowIndex === 1) ?? roof.purlinPlacements[0]!;
    const plane = roof.roofTopPlanes.find((p) => p.id === purlin.slopePlaneId)!;
    const normal = normalizeOutwardRoofNormal(plane.normal);

    const span = {
      x: topLeft.end.x - topLeft.start.x,
      z: topLeft.end.z - topLeft.start.z,
    };
    const spanLenSq = span.x * span.x + span.z * span.z || 1;
    const toBearing = {
      x: truss.bearingLeft.x - topLeft.start.x,
      z: truss.bearingLeft.z - topLeft.start.z,
    };
    const t = Math.max(0, Math.min(1, (toBearing.x * span.x + toBearing.z * span.z) / spanLenSq));
    const chordCenterAtBearing = {
      x: topLeft.start.x + (topLeft.end.x - topLeft.start.x) * t,
      y: topLeft.start.y + (topLeft.end.y - topLeft.start.y) * t,
      z: topLeft.start.z + (topLeft.end.z - topLeft.start.z) * t,
    };
    const chordTopAtBearing = resolveTrussTopChordUpperPoint({
      chordCenter: chordCenterAtBearing,
      outwardNormal: normal,
    });
    const purlinCenter = {
      x: (purlin.start.x + purlin.end.x) / 2,
      y: (purlin.start.y + purlin.end.y) / 2,
      z: (purlin.start.z + purlin.end.z) / 2,
    };
    const purlinBottom = offsetPointAlongRoofNormal(purlinCenter, normal, -PURLIN_PROFILE_DEPTH_METERS / 2);
    const purlinTop = offsetPointAlongRoofNormal(purlinCenter, normal, PURLIN_PROFILE_DEPTH_METERS / 2);
    const sheetUnderside = offsetPointAlongRoofNormal(purlinTop, normal, PURLIN_TO_SHEET_CLEARANCE_METERS);

    const purlinBottomToChordTopGap = distanceAlongRoofNormal(purlinBottom, chordTopAtBearing, normal);
    const sheetUndersideToPurlinTopGap = distanceAlongRoofNormal(purlinTop, sheetUnderside, normal);
    const chordBottomAtBearingToRoofBeamGap =
      chordTopAtBearing.y - normal.y * TRUSS_CHORD_PROFILE_METERS - roof.roofBeamTopY;

    expect(purlinBottomToChordTopGap).toBeGreaterThanOrEqual(-0.001);
    expect(purlinBottomToChordTopGap).toBeLessThanOrEqual(0.003);
    expect(sheetUndersideToPurlinTopGap).toBeGreaterThanOrEqual(0);
    expect(sheetUndersideToPurlinTopGap).toBeLessThanOrEqual(0.005);
    expect(chordBottomAtBearingToRoofBeamGap).toBeGreaterThanOrEqual(-0.002);
    expect(PURLIN_TO_CHORD_CLEARANCE_METERS).toBeCloseTo(0.001, 3);
    expect(PURLIN_TO_SHEET_CLEARANCE_METERS).toBeCloseTo(0.002, 3);

    const elevationOnPlane = (targetPlane: (typeof roof.roofTopPlanes)[number], x: number, z: number): number => {
      const anchor = targetPlane.corners[0]!;
      const n = targetPlane.normal;
      return anchor.y - (n.x * (x - anchor.x) + n.z * (z - anchor.z)) / n.y;
    };

    for (const rowPurlin of roof.purlinPlacements.filter((p) => p.rowIndex === 1).slice(0, 2)) {
      const structPlane = roof.roofTopPlanes.find((p) => p.id === rowPurlin.slopePlaneId)!;
      const displayPlane = roof.claddingDisplayPlanes.find(
        (p) => p.id === `${rowPurlin.slopePlaneId}-cladding-display`,
      )!;
      const slopeNormal = normalizeOutwardRoofNormal(structPlane.normal);
      const mid = {
        x: (rowPurlin.start.x + rowPurlin.end.x) / 2,
        y: (rowPurlin.start.y + rowPurlin.end.y) / 2,
        z: (rowPurlin.start.z + rowPurlin.end.z) / 2,
      };
      const rowPurlinTop = offsetPointAlongRoofNormal(mid, slopeNormal, PURLIN_PROFILE_DEPTH_METERS / 2);
      const displayTopY = elevationOnPlane(displayPlane, mid.x, mid.z);
      const displayTopPoint = { x: mid.x, y: displayTopY, z: mid.z };
      const displayUnderside = offsetPointAlongRoofNormal(
        displayTopPoint,
        slopeNormal,
        -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
      );
      const purlinToDisplayUndersideGap = distanceAlongRoofNormal(
        rowPurlinTop,
        displayUnderside,
        slopeNormal,
      );
      expect(purlinToDisplayUndersideGap).toBeGreaterThanOrEqual(0);
      expect(purlinToDisplayUndersideGap).toBeLessThanOrEqual(0.006);
    }

    if (roof.ridgeCapPlacement && roof.claddingDisplayPlanes.length > 0) {
      const ridgeMid = {
        x: (roof.ridgeCapPlacement.start.x + roof.ridgeCapPlacement.end.x) / 2,
        y: (roof.ridgeCapPlacement.start.y + roof.ridgeCapPlacement.end.y) / 2,
        z: (roof.ridgeCapPlacement.start.z + roof.ridgeCapPlacement.end.z) / 2,
      };
      const displayPlane = roof.claddingDisplayPlanes[0]!;
      const displayTopAtRidge = elevationOnPlane(displayPlane, ridgeMid.x, ridgeMid.z);
      expect(roof.ridgeCapPlacement.start.y).toBeCloseTo(displayTopAtRidge, 3);
      expect(roof.ridgeCapPlacement.end.y).toBeCloseTo(displayTopAtRidge, 3);
    }
  });
});
