import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { gableEndOutwardNormal2D } from '../domain/roofOverhangSupport';
import { buildPurlinRowStationFractions } from '../domain/roofFramingResolver';
import type { RoofSystemSettings } from '../types';

function gableRoofSystem(overrides: Partial<RoofSystemSettings> = {}): RoofSystemSettings {
  return {
    ...createDefaultRoofSystemSettings(),
    roofType: 'gable',
    gable: { ...createDefaultRoofSystemSettings().gable, enabled: true },
    ...overrides,
  };
}

function frameGeometry(roofSystem: RoofSystemSettings) {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  return generateDesignGeometry(
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
      roofSystem,
    }),
  );
}

function purlinPlanLength(purlin: { start: { x: number; z: number }; end: { x: number; z: number } }): number {
  return Math.hypot(purlin.end.x - purlin.start.x, purlin.end.z - purlin.start.z);
}

function perpendicularGableExtensionMeters(params: {
  point: { x: number; z: number };
  gableOrigin: { x: number; z: number };
  outwardNormal: { x: number; z: number };
}): number {
  return (
    (params.point.x - params.gableOrigin.x) * params.outwardNormal.x +
    (params.point.z - params.gableOrigin.z) * params.outwardNormal.z
  );
}

describe('purlin overhang cantilever', () => {
  it('includes a cladding-eave purlin row when side eave overhang is present', () => {
    const roofSystem = gableRoofSystem({ eaveOverhangMeters: 0.5, gableEndOverhangMeters: 0.4 });
    const geometry = frameGeometry(roofSystem);
    const withoutEave = frameGeometry(gableRoofSystem({ eaveOverhangMeters: 0, gableEndOverhangMeters: 0.4 }));
    const roof = geometry.resolvedRoofSystem!;
    const { rowTs } = buildPurlinRowStationFractions({
      slopeLengthMeters: roof.claddingRafterLengthMeters,
      structuralHalfRunMeters: withoutEave.resolvedRoofSystem!.structuralRafterRunMeters,
      sideEaveOverhangMeters: roofSystem.eaveOverhangMeters,
      maxPurlinSpacingMeters: roofSystem.purlins.maxSpacingMeters,
    });
    expect(rowTs[0]).toBeCloseTo(0, 3);
    expect(roof.purlinPlacements.some((purlin) => purlin.rowIndex === 0)).toBe(true);
  });

  it('continues on-center spacing through a long side eave overhang', () => {
    const roofSystem = gableRoofSystem({
      eaveOverhangMeters: 1.2,
      purlins: { ...createDefaultRoofSystemSettings().purlins, maxSpacingMeters: 0.6 },
    });
    const geometry = frameGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem!;
    const { rowTs, actualSpacingMeters } = buildPurlinRowStationFractions({
      slopeLengthMeters: roof.claddingRafterLengthMeters,
      structuralHalfRunMeters: roof.structuralRafterRunMeters,
      sideEaveOverhangMeters: roofSystem.eaveOverhangMeters,
      maxPurlinSpacingMeters: roofSystem.purlins.maxSpacingMeters,
    });
    const trussEaveT = roofSystem.eaveOverhangMeters / roof.claddingRafterRunMeters;
    const overhangRows = rowTs.filter((t) => t <= trussEaveT + 0.001);
    expect(overhangRows.length).toBeGreaterThan(2);

    for (let index = 1; index < rowTs.length; index += 1) {
      const spacingAlongSlope = (rowTs[index]! - rowTs[index - 1]!) * roof.claddingRafterLengthMeters;
      expect(spacingAlongSlope).toBeGreaterThan(0);
      expect(spacingAlongSlope).toBeLessThanOrEqual(actualSpacingMeters + 0.02);
    }
  });

  it('extends every purlin row to the full cladding length when only gable-end overhang is set', () => {
    const overhang = 0.6;
    const geometry = frameGeometry(
      gableRoofSystem({ gableEndOverhangMeters: overhang, eaveOverhangMeters: 0, ridgeDirection: 'along_longest_axis' }),
    );
    const roof = geometry.resolvedRoofSystem!;

    for (const purlin of roof.purlinPlacements) {
      expect(purlinPlanLength(purlin)).toBeCloseTo(roof.claddingRidgeLengthMeters, 2);
    }
  });

  it('keeps purlins cantilevered past gable close-in sheet metal', () => {
    const gableOverhang = 0.6;
    const geometry = frameGeometry(
      gableRoofSystem({
        gableEndOverhangMeters: gableOverhang,
        eaveOverhangMeters: 0.4,
        ridgeDirection: 'along_longest_axis',
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          enabled: true,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    const roof = geometry.resolvedRoofSystem!;
    expect(roof.gableEndRoofingClosures).toHaveLength(2);

    const firstPurlin = roof.purlinPlacements[0]!;
    const runVector = {
      x: firstPurlin.end.x - firstPurlin.start.x,
      z: firstPurlin.end.z - firstPurlin.start.z,
    };
    const runLength = Math.hypot(runVector.x, runVector.z) || 1;
    const runAxis = { x: runVector.x / runLength, z: runVector.z / runLength };
    const project = (point: { x: number; z: number }) => point.x * runAxis.x + point.z * runAxis.z;
    const closureStations = roof.gableEndRoofingClosures.map((closure) =>
      closure.corners.reduce((sum, corner) => sum + project(corner), 0) / closure.corners.length,
    );
    const minClosureStation = Math.min(...closureStations);
    const maxClosureStation = Math.max(...closureStations);

    for (const purlin of roof.purlinPlacements) {
      const startStation = project(purlin.start);
      const endStation = project(purlin.end);
      expect(Math.min(startStation, endStation)).toBeLessThan(minClosureStation - gableOverhang * 0.5);
      expect(Math.max(startStation, endStation)).toBeGreaterThan(maxClosureStation + gableOverhang * 0.5);
    }
  });

  it('keeps equal perpendicular gable-end extension at eave and ridge rows', () => {
    const gableOverhang = 1;
    const geometry = frameGeometry(
      gableRoofSystem({
        gableEndOverhangMeters: gableOverhang,
        eaveOverhangMeters: 0.5,
        ridgeDirection: 'along_longest_axis',
      }),
    );
    const roof = geometry.resolvedRoofSystem!;
    const bearing = geometry.resolvedRoofSystem!.structuralBearingPerimeter.map((point) => ({
      x: point.x,
      z: point.z,
    }));
    const startNormal = gableEndOutwardNormal2D({ bearing, ridgeAxis: 'localX', atStartGable: true });
    const endNormal = gableEndOutwardNormal2D({ bearing, ridgeAxis: 'localX', atStartGable: false });
    const startOrigin = roof.structuralRidgeStart!;
    const endOrigin = roof.structuralRidgeEnd!;

    const ridgeRow = roof.purlinPlacements.filter((purlin) => purlin.rowIndex === roof.purlinRowsPerSlope - 1);
    const eaveRow = roof.purlinPlacements.filter((purlin) => purlin.rowIndex === 0);
    for (const purlin of [...ridgeRow, ...eaveRow]) {
      const startExtension = Math.max(
        perpendicularGableExtensionMeters({ point: purlin.start, gableOrigin: startOrigin, outwardNormal: startNormal }),
        perpendicularGableExtensionMeters({ point: purlin.end, gableOrigin: startOrigin, outwardNormal: startNormal }),
      );
      const endExtension = Math.max(
        perpendicularGableExtensionMeters({ point: purlin.start, gableOrigin: endOrigin, outwardNormal: endNormal }),
        perpendicularGableExtensionMeters({ point: purlin.end, gableOrigin: endOrigin, outwardNormal: endNormal }),
      );
      expect(startExtension).toBeCloseTo(gableOverhang, 2);
      expect(endExtension).toBeCloseTo(gableOverhang, 2);
    }
  });
});
