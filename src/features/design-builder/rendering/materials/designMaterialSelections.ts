import {
  getDefaultMaterialIdForCategory,
  getMaterialOptionById,
  MORTAR_TINT_PRESETS,
  ROOF_SHEET_TINT_PRESETS,
  STRUCTURAL_STEEL_TINT_PRESETS,
  type DesignMaterialCategory,
} from './designMaterialRegistry';

export type DesignMaterialSelection = {
  cmuMaterialId: string;
  mortarMaterialId: string;
  castConcreteMaterialId: string;
  roofSheetMaterialId: string;
  structuralSteelMaterialId: string;
  siteGroundMaterialId: string;
  mortarTintId?: string;
  roofSheetTintId?: string;
  structuralSteelTintId?: string;
};

export const DEFAULT_DESIGN_MATERIAL_SELECTION: DesignMaterialSelection = {
  cmuMaterialId: 'concrete-012',
  mortarMaterialId: 'concrete-032',
  castConcreteMaterialId: 'concrete-042a',
  roofSheetMaterialId: 'corrugated-steel-009',
  structuralSteelMaterialId: 'metal-021',
  siteGroundMaterialId: 'ground-037',
  mortarTintId: 'light-gray',
  roofSheetTintId: 'galvanized-gray',
  structuralSteelTintId: 'dark-structural',
};

const CATEGORY_FIELD: Record<
  DesignMaterialCategory,
  keyof Pick<
    DesignMaterialSelection,
    | 'cmuMaterialId'
    | 'mortarMaterialId'
    | 'castConcreteMaterialId'
    | 'roofSheetMaterialId'
    | 'structuralSteelMaterialId'
    | 'siteGroundMaterialId'
  >
> = {
  cmu: 'cmuMaterialId',
  mortar: 'mortarMaterialId',
  cast_concrete: 'castConcreteMaterialId',
  roof_sheet: 'roofSheetMaterialId',
  structural_steel: 'structuralSteelMaterialId',
  site_ground: 'siteGroundMaterialId',
};

function resolveMaterialId(category: DesignMaterialCategory, materialId: string | undefined): string {
  const fallback = getDefaultMaterialIdForCategory(category);
  if (!materialId) return fallback;
  return getMaterialOptionById(materialId)?.category === category ? materialId : fallback;
}

function resolveTintId(
  presets: readonly { id: string }[],
  tintId: string | undefined,
  fallbackId: string,
): string {
  if (!tintId) return fallbackId;
  return presets.some((preset) => preset.id === tintId) ? tintId : fallbackId;
}

export function normalizeDesignMaterialSelection(
  partial?: Partial<DesignMaterialSelection> | null,
): DesignMaterialSelection {
  const base = partial ?? {};
  return {
    cmuMaterialId: resolveMaterialId('cmu', base.cmuMaterialId),
    mortarMaterialId: resolveMaterialId('mortar', base.mortarMaterialId),
    castConcreteMaterialId: resolveMaterialId('cast_concrete', base.castConcreteMaterialId),
    roofSheetMaterialId: resolveMaterialId('roof_sheet', base.roofSheetMaterialId),
    structuralSteelMaterialId: resolveMaterialId('structural_steel', base.structuralSteelMaterialId),
    siteGroundMaterialId: resolveMaterialId('site_ground', base.siteGroundMaterialId),
    mortarTintId: resolveTintId(MORTAR_TINT_PRESETS, base.mortarTintId, DEFAULT_DESIGN_MATERIAL_SELECTION.mortarTintId!),
    roofSheetTintId: resolveTintId(
      ROOF_SHEET_TINT_PRESETS,
      base.roofSheetTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.roofSheetTintId!,
    ),
    structuralSteelTintId: resolveTintId(
      STRUCTURAL_STEEL_TINT_PRESETS,
      base.structuralSteelTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.structuralSteelTintId!,
    ),
  };
}

export function materialSelectionFieldForCategory(
  category: DesignMaterialCategory,
): keyof DesignMaterialSelection {
  return CATEGORY_FIELD[category];
}

export function designMaterialSelectionsEqual(
  left: DesignMaterialSelection,
  right: DesignMaterialSelection,
): boolean {
  return (
    left.cmuMaterialId === right.cmuMaterialId &&
    left.mortarMaterialId === right.mortarMaterialId &&
    left.castConcreteMaterialId === right.castConcreteMaterialId &&
    left.roofSheetMaterialId === right.roofSheetMaterialId &&
    left.structuralSteelMaterialId === right.structuralSteelMaterialId &&
    left.siteGroundMaterialId === right.siteGroundMaterialId &&
    left.mortarTintId === right.mortarTintId &&
    left.roofSheetTintId === right.roofSheetTintId &&
    left.structuralSteelTintId === right.structuralSteelTintId
  );
}
