import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  analyzeCmuModuleFit,
  snapLengthToCmuModule,
  summarizeWallModuleFits,
} from '../domain/cmuModuleRules';

describe('CMU module rules', () => {
  it('resolves a 6.0m wall with 400mm module to full-module fit', () => {
    const fit = analyzeCmuModuleFit(6, 0.4);

    expect(fit.fit).toBe('full');
    expect(fit.moduleCount).toBe(15);
    expect(fit.message).toMatch(/full block module/i);
  });

  it('resolves a 5.0m wall with 400mm module to half-module fit', () => {
    const fit = analyzeCmuModuleFit(5, 0.4);

    expect(fit.fit).toBe('half');
    expect(fit.moduleCount).toBe(12.5);
    expect(fit.message).toMatch(/half block module/i);
  });

  it('warns for non-modular wall lengths and suggests clean dimensions', () => {
    const fit = analyzeCmuModuleFit(5.13, 0.4);

    expect(fit.fit).toBe('cut');
    expect(fit.message).toMatch(/cut block/i);
    expect(fit.suggestedLengthsMeters).toEqual(expect.arrayContaining([5, 5.2]));
    expect(snapLengthToCmuModule(5.13, 0.4)).toBe(5.2);
  });

  it('summarizes each wall face from building dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const fits = summarizeWallModuleFits(preset.wall);

    expect(fits.north.fit).toBe('full');
    expect(fits.south.fit).toBe('full');
    expect(fits.east.fit).toBe('half');
    expect(fits.west.fit).toBe('half');
  });
});
