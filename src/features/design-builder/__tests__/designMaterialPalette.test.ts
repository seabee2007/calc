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

describe('designMaterialRegistry', () => {
  it('lists only real texture-backed materials', () => {
    expect(DESIGN_MATERIAL_REGISTRY.length).toBeGreaterThanOrEqual(24);
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
});

describe('designMaterialSelections', () => {
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
