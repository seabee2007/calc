import { describe, expect, it } from 'vitest';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  TRUSS_DESIGN_PRELIMINARY_WARNING,
  ftPerMeter,
  inchesPerMeter,
  resolveTrussDesignSummary,
} from '../domain/trussDesignCalculations';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import type { ResolvedRoofSystem, RoofSystemSettings } from '../types';

function supportedRoofFixture(roofSystem: RoofSystemSettings = createDefaultRoofSystemSettings()): ResolvedRoofSystem {
  const basePreset = createFiveBySixCmuBuildingPreset();
  const preset = applyAutoFrameLayout(basePreset);
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
  const geometry = generateDesignGeometry(
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
  const roof = geometry.resolvedRoofSystem;
  expect(roof?.supported).toBe(true);
  expect(roof?.trussPlacements.length).toBeGreaterThan(0);
  return roof!;
}

describe('resolveTrussDesignSummary', () => {
  it('generates a summary for a supported gable roof with trusses', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof, roofSettings: createDefaultRoofSystemSettings() });

    expect(summary.supported).toBe(true);
    expect(summary.representativeTruss).toBeTruthy();
    expect(summary.geometry?.trussCount).toBe(roof.trussCount);
    expect(summary.memberLengths?.totalMeters).toBeGreaterThan(summary.memberLengths?.bottomChordMeters ?? 0);
    expect(summary.warnings.some((warning) => warning.message === TRUSS_DESIGN_PRELIMINARY_WARNING)).toBe(true);
  });

  it('calculates span in feet from meters', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof });

    expect(summary.geometry?.spanFeet).toBeCloseTo((summary.geometry?.spanMeters ?? 0) * ftPerMeter, 6);
  });

  it('calculates pitch rise per 12 from rise and run', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof });
    const geometry = summary.geometry!;

    expect(geometry.pitchRisePer12).toBeCloseTo((geometry.riseMeters / geometry.runMeters) * 12, 6);
  });

  it('calculates gravity line load from design psf and spacing', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof });
    const loads = summary.loads!.gravity;
    const expectedLineLoad = (20 + 7 + 0 + 10) * loads.spacingFt;

    expect(loads.totalLineLoadPlf).toBeCloseTo(expectedLineLoad, 6);
  });

  it('calculates simple-span reactions', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof });
    const geometry = summary.geometry!;
    const loads = summary.loads!.gravity;

    expect(loads.simpleSpanReactionLbs).toBeCloseTo((loads.totalLineLoadPlf * geometry.spanFeet) / 2, 6);
    expect(summary.reactions?.gravityLeftReactionLbs).toBeCloseTo(loads.simpleSpanReactionLbs, 6);
    expect(summary.reactions?.gravityRightReactionLbs).toBeCloseTo(loads.simpleSpanReactionLbs, 6);
  });

  it('calculates L/240, L/360, and L/480 serviceability limits', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({ roof });
    const geometry = summary.geometry!;
    const limits = summary.loads!.deflection.limitsInches;
    const spanInches = geometry.spanMeters * inchesPerMeter;

    expect(limits.find((limit) => limit.ratio === 240)?.limitInches).toBeCloseTo(spanInches / 240, 6);
    expect(limits.find((limit) => limit.ratio === 360)?.limitInches).toBeCloseTo(spanInches / 360, 6);
    expect(limits.find((limit) => limit.ratio === 480)?.limitInches).toBeCloseTo(spanInches / 480, 6);
  });

  it('returns warnings for missing truss data', () => {
    const roof = supportedRoofFixture();
    const summary = resolveTrussDesignSummary({
      roof: {
        ...roof,
        trussCount: 0,
        trussStations: [],
        trussPlacements: [],
      },
    });

    expect(summary.supported).toBe(false);
    expect(summary.unsupportedReason).toMatch(/No truss placements/);
    expect(summary.warnings.some((warning) => warning.code === 'missing_truss_placements')).toBe(true);
  });

  it('does not throw when the roof is unsupported', () => {
    const roof = supportedRoofFixture();

    expect(() =>
      resolveTrussDesignSummary({
        roof: {
          ...roof,
          supported: false,
          unsupportedMessage: 'Unsupported roof fixture',
          trussPlacements: [],
          trussStations: [],
          trussCount: 0,
        },
      }),
    ).not.toThrow();
  });
});
