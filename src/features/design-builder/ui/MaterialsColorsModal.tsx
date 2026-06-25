import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../../components/ui/ModalShell';
import {
  DEFAULT_DESIGN_MATERIAL_SELECTION,
  designMaterialSelectionsEqual,
  getMaterialOptionsForCategory,
  MORTAR_TINT_PRESETS,
  normalizeDesignMaterialSelection,
  PLASTER_TINT_PRESETS,
  ROOF_SHEET_TINT_PRESETS,
  STRUCTURAL_STEEL_TINT_PRESETS,
  type DesignMaterialCategory,
  type DesignMaterialSelection,
  type DesignMaterialOption,
  type DesignMaterialTintPreset,
} from '../rendering/materials/designMaterialLibrary';

export type MaterialsFinishesScope = 'all' | 'interior' | 'exterior';

export type MaterialsColorsModalProps = {
  isOpen: boolean;
  scope?: MaterialsFinishesScope;
  appliedSelections: DesignMaterialSelection;
  onClose: () => void;
  onApply: (selections: DesignMaterialSelection) => void;
};

type CategoryConfig = {
  id: string;
  scope: 'interior' | 'exterior';
  category: DesignMaterialCategory;
  title: string;
  materialField?: MaterialSelectionField;
  materialFilter?: (option: DesignMaterialOption) => boolean;
  tintPresets?: readonly DesignMaterialTintPreset[];
  tintField?: keyof Pick<
    DesignMaterialSelection,
    | 'mortarTintId'
    | 'plasterTintId'
    | 'roofSheetTintId'
    | 'fasciaTintId'
    | 'soffitTintId'
    | 'structuralSteelTintId'
  >;
};

type MaterialSelectionField = keyof Pick<
  DesignMaterialSelection,
  | 'cmuMaterialId'
  | 'mortarMaterialId'
  | 'plasterMaterialId'
  | 'castConcreteMaterialId'
  | 'roofSheetMaterialId'
  | 'fasciaMaterialId'
  | 'soffitMaterialId'
  | 'structuralSteelMaterialId'
  | 'siteGroundMaterialId'
>;

const CATEGORY_CONFIG: readonly CategoryConfig[] = [
  { id: 'cmu', scope: 'exterior', category: 'cmu', title: 'CMU Blocks' },
  {
    id: 'mortar',
    scope: 'exterior',
    category: 'mortar',
    title: 'Mortar Joints',
    tintPresets: MORTAR_TINT_PRESETS,
    tintField: 'mortarTintId',
  },
  {
    id: 'plaster',
    scope: 'interior',
    category: 'plaster_finish',
    title: 'Plaster Finish',
    tintPresets: PLASTER_TINT_PRESETS,
    tintField: 'plasterTintId',
  },
  { id: 'cast-concrete', scope: 'interior', category: 'cast_concrete', title: 'Cast Concrete' },
  {
    id: 'roof-sheet',
    scope: 'exterior',
    category: 'roof_sheet',
    title: 'Roof Sheets',
    tintPresets: ROOF_SHEET_TINT_PRESETS,
    tintField: 'roofSheetTintId',
  },
  {
    id: 'fascia',
    scope: 'exterior',
    category: 'roof_trim',
    title: 'Fascia Trim',
    materialField: 'fasciaMaterialId',
    materialFilter: (option) => option.projection === 'uv',
    tintPresets: ROOF_SHEET_TINT_PRESETS,
    tintField: 'fasciaTintId',
  },
  {
    id: 'soffit',
    scope: 'exterior',
    category: 'roof_trim',
    title: 'Soffit Panels',
    materialField: 'soffitMaterialId',
    tintPresets: ROOF_SHEET_TINT_PRESETS,
    tintField: 'soffitTintId',
  },
  {
    id: 'structural-steel',
    scope: 'exterior',
    category: 'structural_steel',
    title: 'Structural Steel',
    tintPresets: STRUCTURAL_STEEL_TINT_PRESETS,
    tintField: 'structuralSteelTintId',
  },
  { id: 'site-ground', scope: 'exterior', category: 'site_ground', title: 'Site Ground' },
];

const MODAL_COPY: Record<
  MaterialsFinishesScope,
  { title: string; subtitle: string }
> = {
  all: {
    title: 'Materials & Colors',
    subtitle: 'Choose the appearance of building components in Material Preview mode.',
  },
  interior: {
    title: 'Interior Finishes',
    subtitle: 'Choose interior wall plaster and floor slab materials for Material Preview mode.',
  },
  exterior: {
    title: 'Exterior Finishes',
    subtitle: 'Choose exterior wall, roof, trim, steel, and site materials for Material Preview mode.',
  },
};

function categoryConfigsForScope(scope: MaterialsFinishesScope): readonly CategoryConfig[] {
  if (scope === 'all') return CATEGORY_CONFIG;
  return CATEGORY_CONFIG.filter((config) => config.scope === scope);
}

const MATERIAL_FIELD: Partial<Record<DesignMaterialCategory, MaterialSelectionField>> = {
  cmu: 'cmuMaterialId',
  mortar: 'mortarMaterialId',
  plaster_finish: 'plasterMaterialId',
  cast_concrete: 'castConcreteMaterialId',
  roof_sheet: 'roofSheetMaterialId',
  roof_trim: 'fasciaMaterialId',
  structural_steel: 'structuralSteelMaterialId',
  site_ground: 'siteGroundMaterialId',
};

function MaterialOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: DesignMaterialOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
        selected
          ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/40'
          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80'
      }`}
    >
      <span
        aria-hidden
        className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-slate-300 dark:border-slate-600"
        style={{ backgroundColor: option.swatchColor }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
        {option.description ? (
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
        ) : null}
      </span>
    </button>
  );
}

function TintSwatches({
  presets,
  selectedId,
  onSelect,
}: {
  presets: readonly DesignMaterialTintPreset[];
  selectedId?: string;
  onSelect: (presetId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = preset.id === selectedId;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            onClick={() => onSelect(preset.id)}
            className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              selected
                ? 'border-cyan-500 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-950/40 dark:text-cyan-100'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span
              aria-hidden
              className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: preset.hex }}
            />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

function CategorySection({
  config,
  selections,
  onChangeMaterial,
  onChangeTint,
}: {
  config: CategoryConfig;
  selections: DesignMaterialSelection;
  onChangeMaterial: (field: MaterialSelectionField, materialId: string) => void;
  onChangeTint: (field: CategoryConfig['tintField'], tintId: string) => void;
}) {
  const options = getMaterialOptionsForCategory(config.category).filter(
    (option) => config.materialFilter?.(option) ?? true,
  );
  const field = config.materialField ?? MATERIAL_FIELD[config.category];
  if (!field) return null;
  const selectedMaterialId = selections[field];
  const selectedOption = options.find((option) => option.id === selectedMaterialId) ?? options[0];

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{config.title}</h3>
        {selectedOption ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{selectedOption.label}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        {options.map((option) => (
          <MaterialOptionRow
            key={option.id}
            option={option}
            selected={option.id === selectedMaterialId}
            onSelect={() => onChangeMaterial(field, option.id)}
          />
        ))}
      </div>
      {config.tintPresets && config.tintField && selectedOption?.supportsTint ? (
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {config.category === 'roof_sheet' || config.category === 'roof_trim' ? 'Roof Finish Color' : 'Color'}
          </div>
          <TintSwatches
            presets={config.tintPresets}
            selectedId={selections[config.tintField]}
            onSelect={(tintId) => onChangeTint(config.tintField, tintId)}
          />
        </div>
      ) : null}
    </section>
  );
}

export default function MaterialsColorsModal({
  isOpen,
  scope = 'all',
  appliedSelections,
  onClose,
  onApply,
}: MaterialsColorsModalProps) {
  const [draft, setDraft] = useState<DesignMaterialSelection>(() =>
    normalizeDesignMaterialSelection(appliedSelections),
  );
  const visibleCategories = useMemo(() => categoryConfigsForScope(scope), [scope]);
  const modalCopy = MODAL_COPY[scope];

  useEffect(() => {
    if (!isOpen) return;
    setDraft(normalizeDesignMaterialSelection(appliedSelections));
  }, [appliedSelections, isOpen]);

  const hasChanges = useMemo(
    () => !designMaterialSelectionsEqual(draft, appliedSelections),
    [appliedSelections, draft],
  );

  function updateMaterial(field: MaterialSelectionField, materialId: string) {
    setDraft((current) => normalizeDesignMaterialSelection({ ...current, [field]: materialId }));
  }

  function updateTint(field: CategoryConfig['tintField'], tintId: string) {
    if (!field) return;
    setDraft((current) => normalizeDesignMaterialSelection({ ...current, [field]: tintId }));
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={modalCopy.title}
      subtitle={modalCopy.subtitle}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setDraft(normalizeDesignMaterialSelection(DEFAULT_DESIGN_MATERIAL_SELECTION))}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            disabled={!hasChanges}
            onClick={() => onApply(normalizeDesignMaterialSelection(draft))}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply Materials
          </button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {visibleCategories.map((config) => (
          <CategorySection
            key={config.id}
            config={config}
            selections={draft}
            onChangeMaterial={updateMaterial}
            onChangeTint={updateTint}
          />
        ))}
      </div>
    </ModalShell>
  );
}
