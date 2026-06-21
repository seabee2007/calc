import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  claddingEaveElevationMeters,
  projectCladdingEaveFromStructuralBearing,
  resolveFixedRoofPitch,
} from '../domain/roofOverhangSupport';
import { TRUSS_CHORD_PROFILE_METERS } from '../domain/roofFramingResolver';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';
import type { RoofSystemSettings } from '../types';

function gableRoofSystem(overrides: Partial<RoofSystemSettings> = {}): RoofSystemSettings {
  return {
    ...createDefaultRoofSystemSettings(),
    roofType: 'gable',
    gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
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

function roofPitch(roof: NonNullable<ReturnType<typeof frameGeometry>['resolvedRoofSystem']>) {
  return Math.atan2(roof.rafterRiseMeters, roof.structuralRafterRunMeters);
}

describe('side eave overhang at fixed pitch', () => {
  const baseSettings = gableRoofSystem({
    eaveOverhangMeters: 0,
    gableEndOverhangMeters: 0.3,
    peakHeightAboveRoofBeamMeters: 1.5,
  });

  it('does not change roof pitch, ridge elevation, or structural truss bearings when eave overhang increases', () => {
    const noEave = frameGeometry(baseSettings).resolvedRoofSystem!;
    const withEave = frameGeometry({ ...baseSettings, eaveOverhangMeters: 0.6 }).resolvedRoofSystem!;

    expect(roofPitch(withEave)).toBeCloseTo(roofPitch(noEave), 6);
    expect(withEave.roofPeakY).toBeCloseTo(noEave.roofPeakY, 6);
    expect(withEave.structuralRafterRunMeters).toBeCloseTo(noEave.structuralRafterRunMeters, 6);
    expect(withEave.claddingRafterRunMeters).toBeCloseTo(
      noEave.structuralRafterRunMeters + 0.6,
      3,
    );

    expect(withEave.trussPlacements[0]!.bearingLeft).toEqual(noEave.trussPlacements[0]!.bearingLeft);
    expect(withEave.trussPlacements[0]!.bearingRight).toEqual(noEave.trussPlacements[0]!.bearingRight);
    expect(withEave.trussPlacements[0]!.apex).toEqual(noEave.trussPlacements[0]!.apex);

    const bottomNoEave = noEave.trussPlacements[0]!.members.find((m) => m.memberKind === 'bottom_chord')!;
    const bottomWithEave = withEave.trussPlacements[0]!.members.find((m) => m.memberKind === 'bottom_chord')!;
    expect(bottomWithEave.start).toEqual(bottomNoEave.start);
    expect(bottomWithEave.end).toEqual(bottomNoEave.end);
  });

  it('extends top chords to cladding eave at the same slope and lowers eave elevation correctly', () => {
    const overhang = 0.6;
    const geometry = frameGeometry({ ...baseSettings, eaveOverhangMeters: overhang });
    const roof = geometry.resolvedRoofSystem!;
    const pitch = resolveFixedRoofPitch({
      structuralHalfRunMeters: roof.structuralRafterRunMeters,
      structuralRiseMeters: roof.rafterRiseMeters,
    });

    expect(roof.claddingRafterRunMeters).toBeCloseTo(roof.structuralRafterRunMeters + overhang, 3);
    expect(
      claddingEaveElevationMeters({
        structuralEaveY: roof.roofBeamTopY,
        fixedSlope: pitch.slope,
        sideEaveOverhangMeters: overhang,
      }),
    ).toBeCloseTo(roof.roofBeamTopY - pitch.slope * overhang, 3);

    const truss = roof.trussPlacements[0]!;
    const topLeft = truss.members.find((m) => m.memberKind === 'top_chord_left')!;
    expect(topLeft.start.y).toBeLessThan(truss.bearingLeft.y);
    expect(topLeft.end).toEqual(truss.apex);

    const ridgePoint2 = { x: truss.apex.x, z: truss.apex.z };
    const bearingLeft2 = { x: truss.bearingLeft.x, z: truss.bearingLeft.z };
    const bearingCenterY = truss.bearingLeft.y + TRUSS_CHORD_PROFILE_METERS / 2;
    const expectedTail = projectCladdingEaveFromStructuralBearing({
      ridgePoint2,
      structuralBearing2: bearingLeft2,
      structuralHalfRunMeters: roof.structuralRafterRunMeters,
      sideEaveOverhangMeters: overhang,
      structuralEaveY: bearingCenterY,
      fixedSlope: pitch.slope,
    });
    expect(topLeft.start.x).toBeCloseTo(expectedTail.x, 2);
    expect(topLeft.start.y).toBeCloseTo(
      claddingEaveElevationMeters({
        structuralEaveY: bearingCenterY,
        fixedSlope: pitch.slope,
        sideEaveOverhangMeters: overhang,
      }),
      2,
    );
    expect(topLeft.start.z).toBeCloseTo(expectedTail.z, 2);
  });

  it('extends purlins and roof sheets to the lowered cladding eave edge', () => {
    const overhang = 0.6;
    const geometry = frameGeometry({ ...baseSettings, eaveOverhangMeters: overhang });
    const roof = geometry.resolvedRoofSystem!;
    const eaveRow = roof.purlinPlacements.filter((p) => p.rowIndex === 0);
    expect(eaveRow.length).toBeGreaterThan(0);

    const minEaveY = Math.min(...roof.roofTopPlanes.flatMap((plane) => plane.corners.map((c) => c.y)));
    expect(minEaveY).toBeLessThan(roof.roofBeamTopY);

    for (const purlin of eaveRow) {
      expect(Math.min(purlin.start.y, purlin.end.y)).toBeLessThan(roof.roofBeamTopY);
    }
  });

  it('leaves gable CMU and raked cap placements unchanged when only side eave overhang changes', () => {
    const noEave = frameGeometry(baseSettings);
    const withEave = frameGeometry({ ...baseSettings, eaveOverhangMeters: 0.6 });
    expect(withEave.blockInstances.filter((b) => b.source === 'gable_end_solver').length).toBe(
      noEave.blockInstances.filter((b) => b.source === 'gable_end_solver').length,
    );
    expect(withEave.rakedCapPlacements?.length ?? 0).toBe(noEave.rakedCapPlacements?.length ?? 0);
  });

  it('does not change gable-end overhang geometry when side eave overhang changes', () => {
    const gableOverhang = 0.4;
    const noSideEave = frameGeometry({ ...baseSettings, gableEndOverhangMeters: gableOverhang }).resolvedRoofSystem!;
    const withSideEave = frameGeometry({
      ...baseSettings,
      eaveOverhangMeters: 0.6,
      gableEndOverhangMeters: gableOverhang,
    }).resolvedRoofSystem!;
    expect(withSideEave.claddingRidgeLengthMeters).toBeCloseTo(noSideEave.claddingRidgeLengthMeters, 3);
    expect(withSideEave.structuralRidgeStart).toEqual(noSideEave.structuralRidgeStart);
    expect(withSideEave.structuralRidgeEnd).toEqual(noSideEave.structuralRidgeEnd);
  });
});
