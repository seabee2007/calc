import {
  getDefaultMaterialIdForCategory,
  getMaterialOptionById,
  MORTAR_TINT_PRESETS,
  PLASTER_TINT_PRESETS,
  ROOF_SHEET_TINT_PRESETS,
  STRUCTURAL_STEEL_TINT_PRESETS,
  type DesignMaterialCategory,
} from './designMaterialRegistry';

export type DesignMaterialSelection = {
  cmuMaterialId: string;
  mortarMaterialId: string;
  plasterMaterialId: string;
  castConcreteMaterialId: string;
  roofSheetMaterialId: string;
  fasciaMaterialId: string;
  soffitMaterialId: string;
  structuralSteelMaterialId: string;
  siteGroundMaterialId: string;
  mortarTintId?: string;
  plasterTintId?: string;
  roofSheetTintId?: string;
  fasciaTintId?: string;
  soffitTintId?: string;
  structuralSteelTintId?: string;
};

export const DEFAULT_DESIGN_MATERIAL_SELECTION: DesignMaterialSelection = {
  cmuMaterialId: 'concrete-012',
  mortarMaterialId: 'concrete-032',
  plasterMaterialId: 'textured-3-coat-plaster',
  castConcreteMaterialId: 'concrete-042a',
  roofSheetMaterialId: 'corrugated-steel-009',
  fasciaMaterialId: 'smooth-painted-roof-trim',
  soffitMaterialId: 'smooth-painted-roof-trim',
  structuralSteelMaterialId: 'metal-021',
  siteGroundMaterialId: 'ground-037',
  mortarTintId: 'light-gray',
  plasterTintId: 'natural-lime',
  roofSheetTintId: 'galvanized-gray',
  fasciaTintId: 'galvanized-gray',
  soffitTintId: 'galvanized-gray',
  structuralSteelTintId: 'dark-structural',
};

const CATEGORY_FIELD: Partial<
  Record<DesignMaterialCategory, keyof DesignMaterialSelection>
> = {
  cmu: 'cmuMaterialId',
  mortar: 'mortarMaterialId',
  plaster_finish: 'plasterMaterialId',
  cast_concrete: 'castConcreteMaterialId',
  roof_sheet: 'roofSheetMaterialId',
  roof_trim: 'fasciaMaterialId',
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
    plasterMaterialId: resolveMaterialId('plaster_finish', base.plasterMaterialId),
    castConcreteMaterialId: resolveMaterialId('cast_concrete', base.castConcreteMaterialId),
    roofSheetMaterialId: resolveMaterialId('roof_sheet', base.roofSheetMaterialId),
    fasciaMaterialId: resolveMaterialId('roof_trim', base.fasciaMaterialId),
    soffitMaterialId: resolveMaterialId('roof_trim', base.soffitMaterialId),
    structuralSteelMaterialId: resolveMaterialId('structural_steel', base.structuralSteelMaterialId),
    siteGroundMaterialId: resolveMaterialId('site_ground', base.siteGroundMaterialId),
    mortarTintId: resolveTintId(MORTAR_TINT_PRESETS, base.mortarTintId, DEFAULT_DESIGN_MATERIAL_SELECTION.mortarTintId!),
    plasterTintId: resolveTintId(
      PLASTER_TINT_PRESETS,
      base.plasterTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.plasterTintId!,
    ),
    roofSheetTintId: resolveTintId(
      ROOF_SHEET_TINT_PRESETS,
      base.roofSheetTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.roofSheetTintId!,
    ),
    fasciaTintId: resolveTintId(
      ROOF_SHEET_TINT_PRESETS,
      base.fasciaTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.fasciaTintId!,
    ),
    soffitTintId: resolveTintId(
      ROOF_SHEET_TINT_PRESETS,
      base.soffitTintId,
      DEFAULT_DESIGN_MATERIAL_SELECTION.soffitTintId!,
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
  const field = CATEGORY_FIELD[category];
  if (!field) {
    throw new Error(`Unsupported material category: ${category}`);
  }
  return field;
}

export function designMaterialSelectionsEqual(
  left: DesignMaterialSelection,
  right: DesignMaterialSelection,
): boolean {
  return (
    left.cmuMaterialId === right.cmuMaterialId &&
    left.mortarMaterialId === right.mortarMaterialId &&
    left.plasterMaterialId === right.plasterMaterialId &&
    left.castConcreteMaterialId === right.castConcreteMaterialId &&
    left.roofSheetMaterialId === right.roofSheetMaterialId &&
    left.fasciaMaterialId === right.fasciaMaterialId &&
    left.soffitMaterialId === right.soffitMaterialId &&
    left.structuralSteelMaterialId === right.structuralSteelMaterialId &&
    left.siteGroundMaterialId === right.siteGroundMaterialId &&
    left.mortarTintId === right.mortarTintId &&
    left.plasterTintId === right.plasterTintId &&
    left.roofSheetTintId === right.roofSheetTintId &&
    left.fasciaTintId === right.fasciaTintId &&
    left.soffitTintId === right.soffitTintId &&
    left.structuralSteelTintId === right.structuralSteelTintId
  );
}
