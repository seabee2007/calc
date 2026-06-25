import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN_MATERIAL_SELECTION,
  designMaterialSelectionsEqual,
  normalizeDesignMaterialSelection,
} from '../rendering/materials/designMaterialSelections';
import {
  DESIGN_MATERIAL_REGISTRY,
  getMaterialOptionsForCategory,
  getMaterialOptionById,
} from '../rendering/materials/designMaterialRegistry';
import { resolveRoofTintStrength, resolveRoofCladdingUvOptions } from '../rendering/materials/designMaterialLibrary';

describe('designMaterialRegistry', () => {
  it('lists only real texture-backed materials', () => {
    expect(DESIGN_MATERIAL_REGISTRY.length).toBeGreaterThanOrEqual(29);
    DESIGN_MATERIAL_REGISTRY.forEach((option) => {
      expect(option.texturePaths.color).toMatch(/^\/textures\//);
      expect(option.label.length).toBeGreaterThan(0);
    });
  });

  it('exposes site ground terrain options', () => {
    expect(getMaterialOptionsForCategory('site_ground').map((option) => option.id)).toEqual([
      'ground-003',
      'ground-037',
      'ground-075',
      'grass-004',
      'grass-007',
      'snow-015',
    ]);
  });

  it('resolves known material ids', () => {
    expect(getMaterialOptionById('concrete-042a')?.category).toBe('cast_concrete');
    expect(getMaterialOptionById('missing')).toBeUndefined();
  });

  it('rotates ridge-to-eave roof sheet UVs by 90 degrees', () => {
    const quarterTurn = Math.PI / 2;
    expect(getMaterialOptionById('corrugated-iron')?.uvRotationRadians).toBe(quarterTurn);
    expect(getMaterialOptionById('box-profile-metal-sheet')?.uvRotationRadians).toBe(quarterTurn);
    expect(getMaterialOptionById('box-profile-metal-sheet')?.corrugationRepeatPerMeter).toBe(7);
    expect(getMaterialOptionById('corrugated-steel-001')?.roofTextureFallbackId).toBe('corrugated-steel-009');
    expect(getMaterialOptionById('corrugated-steel-009')?.uvRotationRadians).toBeUndefined();
    expect(resolveRoofCladdingUvOptions('corrugated-iron').swapCorrugationAxis).toBe(true);
    expect(resolveRoofCladdingUvOptions('corrugated-steel-009').swapCorrugationAxis).toBe(false);
    expect(resolveRoofCladdingUvOptions('box-profile-metal-sheet').swapCorrugationAxis).toBe(true);
    expect(resolveRoofCladdingUvOptions('box-profile-metal-sheet').corrugationRepeatPerMeter).toBe(7);
  });
});

describe('designMaterialSelections', () => {
  it('uses stronger roof paint strength for finish colors other than galvanized gray', () => {
    expect(resolveRoofTintStrength(DEFAULT_DESIGN_MATERIAL_SELECTION)).toBe(0.38);
    expect(
      resolveRoofTintStrength({
        ...DEFAULT_DESIGN_MATERIAL_SELECTION,
        roofSheetTintId: 'charcoal',
      }),
    ).toBe(0.94);
    expect(
      resolveRoofTintStrength({
        ...DEFAULT_DESIGN_MATERIAL_SELECTION,
        roofSheetTintId: 'red-oxide',
      }),
    ).toBe(0.94);
  });

  it('normalizes invalid ids back to category defaults', () => {
    const normalized = normalizeDesignMaterialSelection({
      cmuMaterialId: 'not-real',
      roofSheetMaterialId: 'corrugated-steel-009',
    });
    expect(normalized.cmuMaterialId).toBe('concrete-012');
    expect(normalized.roofSheetMaterialId).toBe('corrugated-steel-009');
  });

  it('tracks equality for persisted selections', () => {
    expect(
      designMaterialSelectionsEqual(
        DEFAULT_DESIGN_MATERIAL_SELECTION,
        normalizeDesignMaterialSelection(DEFAULT_DESIGN_MATERIAL_SELECTION),
      ),
    ).toBe(true);
    expect(
      designMaterialSelectionsEqual(DEFAULT_DESIGN_MATERIAL_SELECTION, {
        ...DEFAULT_DESIGN_MATERIAL_SELECTION,
        cmuMaterialId: 'concrete-025',
      }),
    ).toBe(false);
  });
});
