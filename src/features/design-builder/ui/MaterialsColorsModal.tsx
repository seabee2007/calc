import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../../components/ui/ModalShell';
import {
  FLOOR_GROUT_JOINT_OPTIONS,
  FLOOR_TILE_SIZE_PRESETS,
  resolveInteriorFloorTileSettings,
} from '../domain/floorTileCatalog';
import { resolveFloorTileLayout } from '../domain/floorTileLayout';
import {
  DEFAULT_PLYWOOD_CEILING_COLOR,
  resolvePlywoodCeilingSettings,
} from '../domain/plywoodCeilingCatalog';
import { resolvePlywoodCeilingLayout } from '../domain/plywoodCeilingLayout';
import {
  DEFAULT_CMU_INFILL_PLASTER,
  normalizeCmuInfillPlasterSettings,
} from '../domain/infillPlaster';
import type {
  CmuInfillPlasterSettings,
  InteriorFloorTileSettings,
  PlywoodCeilingSettings,
  ResolvedFloorTileLayout,
  ResolvedPlywoodCeilingLayout,
} from '../types';
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

export type MaterialsColorsApplyPayload = {
  selections: DesignMaterialSelection;
  plaster?: CmuInfillPlasterSettings;
  floorTileFinish?: InteriorFloorTileSettings;
  plywoodCeiling?: PlywoodCeilingSettings;
};

export type MaterialsColorsModalProps = {
  isOpen: boolean;
  scope?: MaterialsFinishesScope;
  appliedSelections: DesignMaterialSelection;
  appliedPlaster?: CmuInfillPlasterSettings;
  appliedFloorTileFinish?: InteriorFloorTileSettings;
  appliedPlywoodCeiling?: PlywoodCeilingSettings;
  interiorFloorSlabEnabled?: boolean;
  interiorFacePolygon?: readonly { x: number; z: number }[];
  floorTileLayoutPreview?: ResolvedFloorTileLayout | null;
  plywoodCeilingLayoutPreview?: ResolvedPlywoodCeilingLayout | null;
  maxCeilingHeightMeters?: number;
  onClose: () => void;
  onApply: (payload: MaterialsColorsApplyPayload) => void;
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
  | 'floorTileMaterialId'
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
    subtitle:
      'Configure interior plaster, floor tile (thinset + grout), and slab materials for preview and estimating.',
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
  floor_tile: 'floorTileMaterialId',
  roof_sheet: 'roofSheetMaterialId',
  roof_trim: 'fasciaMaterialId',
  structural_steel: 'structuralSteelMaterialId',
  site_ground: 'siteGroundMaterialId',
};

function floorTileSettingsEqual(
  left: InteriorFloorTileSettings,
  right: InteriorFloorTileSettings,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.tileSizeKey === right.tileSizeKey &&
    left.groutJointWidth === right.groutJointWidth &&
    left.thinsetThicknessMeters === right.thinsetThicknessMeters &&
    left.wasteFactor === right.wasteFactor
  );
}

function plywoodCeilingSettingsEqual(
  left: PlywoodCeilingSettings,
  right: PlywoodCeilingSettings,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.ceilingHeightMeters === right.ceilingHeightMeters &&
    left.plywoodColor === right.plywoodColor &&
    left.sheetWidthMeters === right.sheetWidthMeters &&
    left.sheetLengthMeters === right.sheetLengthMeters &&
    left.sheetThicknessMeters === right.sheetThicknessMeters &&
    left.braceSpacingMeters === right.braceSpacingMeters &&
    left.tubeSizeMeters === right.tubeSizeMeters &&
    left.staggerOffsetMeters === right.staggerOffsetMeters &&
    left.panelGapMeters === right.panelGapMeters &&
    left.wasteFactor === right.wasteFactor
  );
}

function plasterSettingsEqual(
  left: CmuInfillPlasterSettings,
  right: CmuInfillPlasterSettings,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.finish === right.finish &&
    left.profileLabel === right.profileLabel &&
    left.interiorEnabled === right.interiorEnabled &&
    left.interiorFinish === right.interiorFinish &&
    left.interiorProfileLabel === right.interiorProfileLabel
  );
}

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

function plasterMaterialIdForFinish(finish: CmuInfillPlasterSettings['finish']): DesignMaterialSelection['plasterMaterialId'] {
  return finish === 'smooth' ? 'smooth-3-coat-plaster' : 'textured-3-coat-plaster';
}

function finishForPlasterMaterialId(materialId: DesignMaterialSelection['plasterMaterialId']): CmuInfillPlasterSettings['finish'] {
  return materialId === 'smooth-3-coat-plaster' ? 'smooth' : 'textured';
}

function PlasterFinishSection({
  scope,
  selections,
  plasterDraft,
  onChangeMaterial,
  onChangeTint,
  onChangePlaster,
}: {
  scope: Exclude<MaterialsFinishesScope, 'all'>;
  selections: DesignMaterialSelection;
  plasterDraft: CmuInfillPlasterSettings;
  onChangeMaterial: (field: MaterialSelectionField, materialId: string) => void;
  onChangeTint: (field: CategoryConfig['tintField'], tintId: string) => void;
  onChangePlaster: (patch: Partial<CmuInfillPlasterSettings>) => void;
}) {
  const exterior = scope === 'exterior';
  const enabled = exterior ? plasterDraft.enabled : plasterDraft.interiorEnabled;
  const finish = exterior ? plasterDraft.finish : plasterDraft.interiorFinish;
  const sideLabel = exterior ? 'Exterior Plaster' : 'Interior Plaster';
  const finishOptions = getMaterialOptionsForCategory('plaster_finish');
  const selectedPlasterMaterialId = plasterMaterialIdForFinish(finish);

  function updateFinish(nextFinish: CmuInfillPlasterSettings['finish']) {
    onChangeMaterial('plasterMaterialId', plasterMaterialIdForFinish(nextFinish));
    onChangePlaster(exterior ? { finish: nextFinish } : { interiorFinish: nextFinish });
  }

  return (
    <section className="space-y-4 md:col-span-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sideLabel}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          3-coat CMU plaster finish. Enabled plaster is included as Division 09 estimate area.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onChangePlaster(exterior ? { enabled: event.target.checked } : { interiorEnabled: event.target.checked })
          }
        />
        {exterior ? 'Enable exterior plaster' : 'Enable interior plaster'}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['smooth', 'textured'] as const).map((option) => {
          const selected = finish === option;
          return (
            <button
              key={option}
              type="button"
              disabled={!enabled}
              onClick={() => updateFinish(option)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                selected
                  ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {option === 'smooth' ? 'Smooth' : 'Rough'}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {option === 'smooth' ? 'Smooth finish coat texture' : 'Textured rough finish coat'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {finishOptions.map((option) => (
          <MaterialOptionRow
            key={option.id}
            option={option}
            selected={option.id === selectedPlasterMaterialId}
            onSelect={() => {
              onChangeMaterial('plasterMaterialId', option.id);
              onChangePlaster(
                exterior
                  ? { finish: finishForPlasterMaterialId(option.id) }
                  : { interiorFinish: finishForPlasterMaterialId(option.id) },
              );
            }}
          />
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Plaster Color
        </div>
        <TintSwatches
          presets={PLASTER_TINT_PRESETS}
          selectedId={selections.plasterTintId}
          onSelect={(tintId) => onChangeTint('plasterTintId', tintId)}
        />
      </div>
    </section>
  );
}

function PlywoodCeilingSection({
  plywoodCeilingDraft,
  interiorFacePolygon,
  plywoodCeilingLayoutPreview,
  maxCeilingHeightMeters,
  onChangePlywoodCeiling,
}: {
  plywoodCeilingDraft: PlywoodCeilingSettings;
  interiorFacePolygon: readonly { x: number; z: number }[];
  plywoodCeilingLayoutPreview: ResolvedPlywoodCeilingLayout | null;
  maxCeilingHeightMeters?: number;
  onChangePlywoodCeiling: (patch: Partial<PlywoodCeilingSettings>) => void;
}) {
  const layoutPreview = useMemo(() => {
    if (interiorFacePolygon.length >= 3) {
      return resolvePlywoodCeilingLayout({
        interiorFacePolygon,
        plywoodCeiling: plywoodCeilingDraft,
        maxCeilingHeightMeters,
      });
    }
    return plywoodCeilingLayoutPreview;
  }, [
    interiorFacePolygon,
    maxCeilingHeightMeters,
    plywoodCeilingDraft,
    plywoodCeilingLayoutPreview,
  ]);

  return (
    <section className="space-y-4 md:col-span-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Plywood Ceiling</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Metal tube frame with 2&apos; OC cross bracing and staggered 4&apos; × 8&apos; plywood panels on the
          underside.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={plywoodCeilingDraft.enabled}
          onChange={(event) => onChangePlywoodCeiling({ enabled: event.target.checked })}
        />
        Enable plywood ceiling
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Ceiling height</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={plywoodCeilingDraft.ceilingHeightMeters}
              min={0.5}
              max={maxCeilingHeightMeters ?? 10}
              step={0.05}
              disabled={!plywoodCeilingDraft.enabled}
              onChange={(event) =>
                onChangePlywoodCeiling({
                  ceilingHeightMeters: Number.parseFloat(event.target.value) || 0.5,
                })
              }
            />
            <span className="text-xs text-slate-500">m</span>
          </div>
          {maxCeilingHeightMeters != null ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Max clear height: {maxCeilingHeightMeters.toFixed(2)} m
            </span>
          ) : null}
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Plywood finish color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-12 cursor-pointer rounded border border-slate-200 dark:border-slate-700"
              value={plywoodCeilingDraft.plywoodColor}
              disabled={!plywoodCeilingDraft.enabled}
              onChange={(event) => onChangePlywoodCeiling({ plywoodColor: event.target.value })}
            />
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
              value={plywoodCeilingDraft.plywoodColor}
              disabled={!plywoodCeilingDraft.enabled}
              onChange={(event) => onChangePlywoodCeiling({ plywoodColor: event.target.value })}
            />
          </div>
          <button
            type="button"
            className="text-xs text-cyan-700 hover:underline dark:text-cyan-300"
            disabled={!plywoodCeilingDraft.enabled}
            onClick={() => onChangePlywoodCeiling({ plywoodColor: DEFAULT_PLYWOOD_CEILING_COLOR })}
          >
            Reset to default plywood
          </button>
        </label>
      </div>

      {plywoodCeilingDraft.enabled && layoutPreview?.enabled ? (
        <dl className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <div className="flex justify-between gap-2">
            <dt>Panels (full / cut)</dt>
            <dd className="font-mono">
              {layoutPreview.fullPanelCount} / {layoutPreview.cutPanelCount}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Cross braces</dt>
            <dd className="font-mono">
              {layoutPreview.frameMembers.filter((member) => member.kind === 'cross_brace').length}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Order qty (waste)</dt>
            <dd className="font-mono">{layoutPreview.orderPanelCount}</dd>
          </div>
          {layoutPreview.warnings.length ? (
            <div className="pt-1 text-amber-700 dark:text-amber-300">{layoutPreview.warnings.join(' ')}</div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function FloorTileSection({
  selections,
  floorTileDraft,
  interiorFloorSlabEnabled,
  interiorFacePolygon,
  floorTileLayoutPreview,
  onChangeMaterial,
  onChangeFloorTile,
}: {
  selections: DesignMaterialSelection;
  floorTileDraft: InteriorFloorTileSettings;
  interiorFloorSlabEnabled: boolean;
  interiorFacePolygon: readonly { x: number; z: number }[];
  floorTileLayoutPreview: ResolvedFloorTileLayout | null;
  onChangeMaterial: (field: MaterialSelectionField, materialId: string) => void;
  onChangeFloorTile: (patch: Partial<InteriorFloorTileSettings>) => void;
}) {
  const tileOptions = getMaterialOptionsForCategory('floor_tile');
  const selectedMaterialId = selections.floorTileMaterialId;
  const layoutPreview = useMemo(() => {
    if (interiorFacePolygon.length >= 3) {
      return resolveFloorTileLayout({
        interiorFacePolygon,
        floorTileFinish: floorTileDraft,
        interiorFloorSlabEnabled,
      });
    }
    return floorTileLayoutPreview;
  }, [floorTileDraft, floorTileLayoutPreview, interiorFacePolygon, interiorFloorSlabEnabled]);

  return (
    <section className="space-y-4 md:col-span-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Floor Tile</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Center layout with cut tiles at walls. Thinset bed is 1/2&quot; (12.7 mm). Division 09 30 00.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={floorTileDraft.enabled}
          disabled={!interiorFloorSlabEnabled}
          onChange={(event) => onChangeFloorTile({ enabled: event.target.checked })}
        />
        Enable floor tile finish
      </label>
      {!interiorFloorSlabEnabled ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Enable the interior floor slab in Structure Dimensions before applying tile.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Tile size</span>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={floorTileDraft.tileSizeKey}
            disabled={!floorTileDraft.enabled}
            onChange={(event) =>
              onChangeFloorTile({ tileSizeKey: event.target.value as InteriorFloorTileSettings['tileSizeKey'] })
            }
          >
            {FLOOR_TILE_SIZE_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label} — {preset.description}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Grout joint</span>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={floorTileDraft.groutJointWidth}
            disabled={!floorTileDraft.enabled}
            onChange={(event) =>
              onChangeFloorTile({
                groutJointWidth: event.target.value as InteriorFloorTileSettings['groutJointWidth'],
              })
            }
          >
            {FLOOR_GROUT_JOINT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tile material
        </div>
        {tileOptions.map((option) => (
          <MaterialOptionRow
            key={option.id}
            option={option}
            selected={option.id === selectedMaterialId}
            onSelect={() => onChangeMaterial('floorTileMaterialId', option.id)}
          />
        ))}
      </div>

      {floorTileDraft.enabled && layoutPreview?.enabled ? (
        <dl className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt>Floor area</dt>
            <dd className="font-mono">{layoutPreview.floorAreaSquareMeters.toFixed(2)} m²</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Full tiles</dt>
            <dd className="font-mono">{layoutPreview.fullTileCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Cut tiles</dt>
            <dd className="font-mono">{layoutPreview.cutTileCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Order qty (waste)</dt>
            <dd className="font-mono">{layoutPreview.orderTileCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Thinset bags</dt>
            <dd className="font-mono">{layoutPreview.thinsetBags}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Grout bags</dt>
            <dd className="font-mono">{layoutPreview.groutBags}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

export default function MaterialsColorsModal({
  isOpen,
  scope = 'all',
  appliedSelections,
  appliedPlaster,
  appliedFloorTileFinish,
  appliedPlywoodCeiling,
  interiorFloorSlabEnabled = true,
  interiorFacePolygon = [],
  floorTileLayoutPreview = null,
  plywoodCeilingLayoutPreview = null,
  maxCeilingHeightMeters,
  onClose,
  onApply,
}: MaterialsColorsModalProps) {
  const [draft, setDraft] = useState<DesignMaterialSelection>(() =>
    normalizeDesignMaterialSelection(appliedSelections),
  );
  const [plasterDraft, setPlasterDraft] = useState<CmuInfillPlasterSettings>(() =>
    normalizeCmuInfillPlasterSettings(appliedPlaster),
  );
  const [floorTileDraft, setFloorTileDraft] = useState<InteriorFloorTileSettings>(() =>
    resolveInteriorFloorTileSettings(appliedFloorTileFinish),
  );
  const [plywoodCeilingDraft, setPlywoodCeilingDraft] = useState<PlywoodCeilingSettings>(() =>
    resolvePlywoodCeilingSettings(appliedPlywoodCeiling),
  );
  const visibleCategories = useMemo(() => categoryConfigsForScope(scope), [scope]);
  const modalCopy = MODAL_COPY[scope];
  const showExteriorPlasterSection = scope === 'exterior' || scope === 'all';
  const showInteriorPlasterSection = scope === 'interior' || scope === 'all';
  const showFloorTileSection = scope === 'interior' || scope === 'all';
  const showPlywoodCeilingSection = scope === 'interior' || scope === 'all';

  useEffect(() => {
    if (!isOpen) return;
    setDraft(normalizeDesignMaterialSelection(appliedSelections));
    setPlasterDraft(normalizeCmuInfillPlasterSettings(appliedPlaster));
    setFloorTileDraft(resolveInteriorFloorTileSettings(appliedFloorTileFinish));
    setPlywoodCeilingDraft(resolvePlywoodCeilingSettings(appliedPlywoodCeiling));
  }, [appliedFloorTileFinish, appliedPlaster, appliedPlywoodCeiling, appliedSelections, isOpen]);

  const hasChanges = useMemo(() => {
    const selectionChanged = !designMaterialSelectionsEqual(draft, appliedSelections);
    const plasterChanged =
      (showExteriorPlasterSection || showInteriorPlasterSection) &&
      !plasterSettingsEqual(plasterDraft, normalizeCmuInfillPlasterSettings(appliedPlaster));
    const floorTileChanged =
      showFloorTileSection &&
      !floorTileSettingsEqual(
        floorTileDraft,
        resolveInteriorFloorTileSettings(appliedFloorTileFinish),
      );
    const plywoodCeilingChanged =
      showPlywoodCeilingSection &&
      !plywoodCeilingSettingsEqual(
        plywoodCeilingDraft,
        resolvePlywoodCeilingSettings(appliedPlywoodCeiling),
      );
    return selectionChanged || plasterChanged || floorTileChanged || plywoodCeilingChanged;
  }, [
    appliedFloorTileFinish,
    appliedPlaster,
    appliedPlywoodCeiling,
    appliedSelections,
    draft,
    floorTileDraft,
    plasterDraft,
    plywoodCeilingDraft,
    showExteriorPlasterSection,
    showFloorTileSection,
    showInteriorPlasterSection,
    showPlywoodCeilingSection,
  ]);

  function updateMaterial(field: MaterialSelectionField, materialId: string) {
    setDraft((current) => normalizeDesignMaterialSelection({ ...current, [field]: materialId }));
  }

  function updateTint(field: CategoryConfig['tintField'], tintId: string) {
    if (!field) return;
    setDraft((current) => normalizeDesignMaterialSelection({ ...current, [field]: tintId }));
  }

  function updatePlaster(patch: Partial<CmuInfillPlasterSettings>) {
    setPlasterDraft((current) => normalizeCmuInfillPlasterSettings({ ...current, ...patch }));
  }

  function updateFloorTile(patch: Partial<InteriorFloorTileSettings>) {
    setFloorTileDraft((current) => resolveInteriorFloorTileSettings({ ...current, ...patch }));
  }

  function updatePlywoodCeiling(patch: Partial<PlywoodCeilingSettings>) {
    setPlywoodCeilingDraft((current) => resolvePlywoodCeilingSettings({ ...current, ...patch }));
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
            onClick={() => {
              setDraft(normalizeDesignMaterialSelection(DEFAULT_DESIGN_MATERIAL_SELECTION));
              setPlasterDraft(normalizeCmuInfillPlasterSettings(DEFAULT_CMU_INFILL_PLASTER));
              setFloorTileDraft(resolveInteriorFloorTileSettings(undefined));
              setPlywoodCeilingDraft(resolvePlywoodCeilingSettings(undefined));
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            disabled={!hasChanges}
            onClick={() =>
              onApply({
                selections: normalizeDesignMaterialSelection(draft),
                plaster: showExteriorPlasterSection || showInteriorPlasterSection
                  ? normalizeCmuInfillPlasterSettings(plasterDraft)
                  : undefined,
                floorTileFinish: showFloorTileSection
                  ? resolveInteriorFloorTileSettings(floorTileDraft)
                  : undefined,
                plywoodCeiling: showPlywoodCeilingSection
                  ? resolvePlywoodCeilingSettings(plywoodCeilingDraft)
                  : undefined,
              })
            }
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply Materials
          </button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {showExteriorPlasterSection ? (
          <PlasterFinishSection
            scope="exterior"
            selections={draft}
            plasterDraft={plasterDraft}
            onChangeMaterial={updateMaterial}
            onChangeTint={updateTint}
            onChangePlaster={updatePlaster}
          />
        ) : null}
        {showInteriorPlasterSection ? (
          <PlasterFinishSection
            scope="interior"
            selections={draft}
            plasterDraft={plasterDraft}
            onChangeMaterial={updateMaterial}
            onChangeTint={updateTint}
            onChangePlaster={updatePlaster}
          />
        ) : null}
        {showPlywoodCeilingSection ? (
          <PlywoodCeilingSection
            plywoodCeilingDraft={plywoodCeilingDraft}
            interiorFacePolygon={interiorFacePolygon}
            plywoodCeilingLayoutPreview={plywoodCeilingLayoutPreview}
            maxCeilingHeightMeters={maxCeilingHeightMeters}
            onChangePlywoodCeiling={updatePlywoodCeiling}
          />
        ) : null}
        {showFloorTileSection ? (
          <FloorTileSection
            selections={draft}
            floorTileDraft={floorTileDraft}
            interiorFloorSlabEnabled={interiorFloorSlabEnabled}
            interiorFacePolygon={interiorFacePolygon}
            floorTileLayoutPreview={floorTileLayoutPreview}
            onChangeMaterial={updateMaterial}
            onChangeFloorTile={updateFloorTile}
          />
        ) : null}
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
