import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  OPENING_GROUT_CONCEPTUAL_WARNING,
  calculateCmuOpeningGroutSummary,
  resolveCmuOpening,
  validateResolvedOpenings,
} from '../domain/cmuOpeningRules';

describe('CMU opening and grout rules', () => {
  it('separates actual unit size from calculated rough opening size', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const door = preset.wall.openings.find((opening) => opening.type === 'door');
    expect(door).toBeDefined();

    const resolved = resolveCmuOpening(preset.wall, door!);

    expect(resolved.actualWidthMeters).toBeCloseTo(0.9, 6);
    expect(resolved.actualHeightMeters).toBeCloseTo(2.1, 6);
    expect(resolved.roughOpeningWidthMeters).toBeCloseTo(1, 6);
    expect(resolved.roughOpeningHeightMeters).toBeCloseTo(2.2, 6);
  });

  it('calculates conceptual jamb, lintel, bond beam, and total grout volumes', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const summary = calculateCmuOpeningGroutSummary(preset.wall);

    expect(summary.jambGroutCellCount).toBe(4);
    expect(summary.lintelCount).toBe(2);
    expect(summary.lintelLengthMeters).toBeGreaterThan(0);
    expect(summary.jambGroutVolumeCubicMeters).toBeGreaterThan(0);
    expect(summary.lintelGroutVolumeCubicMeters).toBeGreaterThan(0);
    expect(summary.bondBeamGroutVolumeCubicMeters).toBeGreaterThan(0);
    expect(summary.totalGroutVolumeCubicMeters).toBeGreaterThan(summary.jambGroutVolumeCubicMeters);
    expect(summary.warnings).toEqual(expect.arrayContaining([OPENING_GROUT_CONCEPTUAL_WARNING]));
  });

  it('warns when rough openings overlap or jamb grout is disabled', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const wall = {
      ...preset.wall,
      openings: [
        { ...preset.wall.openings[0], jambGroutEnabled: false },
        {
          ...preset.wall.openings[0],
          id: 'door-overlap',
          offsetMeters: preset.wall.openings[0].offsetMeters + 0.2,
        },
      ],
    };

    const warnings = validateResolvedOpenings(wall);

    expect(warnings.some((warning) => warning.includes('Jamb grout disabled'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('Rough openings overlap'))).toBe(true);
  });
});
