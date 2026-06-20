import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  analyzeCmuModuleFit,
  resolveClosedFootprintToCmuModules,
  resolveCmuModuleDefinition,
  snapLengthToCmuHalfModule,
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

  it('separates physical block size from nominal module pitch', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const definition = resolveCmuModuleDefinition(preset.wall);

    expect(definition.nominalModuleLengthMeters).toBe(0.4);
    expect(definition.actualFullBlockLengthMeters).toBeLessThan(definition.nominalModuleLengthMeters);
    expect(definition.allowedUnitLengthsMeters).toEqual(expect.arrayContaining([0.2, 0.4]));
  });

  it('snaps during draw to valid full and half module increments', () => {
    expect(snapLengthToCmuHalfModule(6.08, 0.4)).toBe(6);
    expect(snapLengthToCmuHalfModule(5.13, 0.4)).toBe(5.2);
  });

  it('proposes closed-footprint module fit without applying automatically', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const proposal = resolveClosedFootprintToCmuModules({
      requestedFootprint: { lengthMeters: 6.08, widthMeters: 5.13 },
      dimensionBasis: 'outside_face',
      cmu: preset.wall,
    });

    expect(proposal.requested).toEqual({ lengthMeters: 6.08, widthMeters: 5.13 });
    expect(proposal.resolved).toEqual({ lengthMeters: 6, widthMeters: 5.2 });
    expect(proposal.adjustment).toEqual({ lengthMeters: -0.08, widthMeters: 0.07 });
    expect(proposal.cutBlocksRequired).toBe(true);
  });

  it('keeps a 6.00m metric wall modular at whole-building level', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const proposal = resolveClosedFootprintToCmuModules({
      requestedFootprint: { lengthMeters: 6, widthMeters: 5 },
      dimensionBasis: 'outside_face',
      cmu: preset.wall,
    });

    expect(proposal.lengthFit.fit).toBe('full');
    expect(proposal.lengthFit.moduleCount).toBe(15);
    expect(proposal.resolved.lengthMeters).toBe(6);
    expect(proposal.cornerCondition).toBe('full_half_compatible');
  });

  it('reports a 10.00m by 6.00m metric rectangle as compatible with no cut units', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const proposal = resolveClosedFootprintToCmuModules({
      requestedFootprint: { lengthMeters: 10, widthMeters: 6 },
      dimensionBasis: 'outside_face',
      cmu: preset.wall,
    });

    expect(proposal.resolved).toEqual({ lengthMeters: 10, widthMeters: 6 });
    expect(proposal.cutBlocksRequired).toBe(false);
    expect(proposal.unitCounts.cut).toBe(0);
    expect(proposal.summary).toContain('Module fit: compatible');
    expect(proposal.summary).toContain('Cut units: 0');
  });
});
