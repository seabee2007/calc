import { useState, type ReactNode } from 'react';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import type {
  BuildingSystemMode,
  Design2dDrawingStyleMode,
  DesignVisualStyle,
  FoundationViewMode,
  RoofDisplayMode,
  RoofLayerVisibility,
} from '../types';
import type { Plumbing3DVisibility } from '../plumbing/three/plumbingThreeUtils';
import {
  CommandMenuAction,
  DesignBuilderCommandMenu,
} from './DesignBuilderCommandMenu';

type DesignBuilderDisplayMenuProps = {
  buildingSystemMode: BuildingSystemMode;
  showOpeningLayout: boolean;
  onShowOpeningLayoutChange: (checked: boolean) => void;
  showGroutCells: boolean;
  onShowGroutCellsChange: (checked: boolean) => void;
  showClosureWarnings: boolean;
  onShowClosureWarningsChange: (checked: boolean) => void;
  visualStyle: DesignVisualStyle;
  onVisualStyleChange: (style: DesignVisualStyle) => void;
  onOpenMaterials: () => void;
  twoDDrawingStyle: Design2dDrawingStyleMode;
  onTwoDDrawingStyleChange: (style: Design2dDrawingStyleMode) => void;
  showRoofReferencePerimeters: boolean;
  onShowRoofReferencePerimetersChange: (checked: boolean) => void;
  showRoofFramingGuides: boolean;
  onShowRoofFramingGuidesChange: (checked: boolean) => void;
  showRoofDebug: boolean;
  onShowRoofDebugChange: (checked: boolean) => void;
  showRoofPlanHatch: boolean;
  onShowRoofPlanHatchChange: (checked: boolean) => void;
  showRoofPlanSlopeArrows: boolean;
  onShowRoofPlanSlopeArrowsChange: (checked: boolean) => void;
  showRoofPlanDimensions: boolean;
  onShowRoofPlanDimensionsChange: (checked: boolean) => void;
  showRoofPlanReferenceLines: boolean;
  onShowRoofPlanReferenceLinesChange: (checked: boolean) => void;
  showRoofPlanTrussReferenceSheet: boolean;
  onShowRoofPlanTrussReferenceSheetChange: (checked: boolean) => void;
  foundationViewMode: FoundationViewMode;
  onFoundationViewModeChange: (mode: FoundationViewMode) => void;
  roofDisplayMode: RoofDisplayMode;
  onRoofDisplayModeChange: (mode: RoofDisplayMode) => void;
  roofLayerVisibility: RoofLayerVisibility;
  onRoofLayerVisibilityChange: (
    updater: (current: RoofLayerVisibility) => RoofLayerVisibility,
  ) => void;
  plumbing3DVisibility: Plumbing3DVisibility;
  onPlumbing3DVisibilityChange: (
    updater: (current: Plumbing3DVisibility) => Plumbing3DVisibility,
  ) => void;
};

export function DesignBuilderDisplayMenu({
  buildingSystemMode,
  showOpeningLayout,
  onShowOpeningLayoutChange,
  showGroutCells,
  onShowGroutCellsChange,
  showClosureWarnings,
  onShowClosureWarningsChange,
  visualStyle,
  onVisualStyleChange,
  onOpenMaterials,
  twoDDrawingStyle,
  onTwoDDrawingStyleChange,
  showRoofReferencePerimeters,
  onShowRoofReferencePerimetersChange,
  showRoofFramingGuides,
  onShowRoofFramingGuidesChange,
  showRoofDebug,
  onShowRoofDebugChange,
  showRoofPlanHatch,
  onShowRoofPlanHatchChange,
  showRoofPlanSlopeArrows,
  onShowRoofPlanSlopeArrowsChange,
  showRoofPlanDimensions,
  onShowRoofPlanDimensionsChange,
  showRoofPlanReferenceLines,
  onShowRoofPlanReferenceLinesChange,
  showRoofPlanTrussReferenceSheet,
  onShowRoofPlanTrussReferenceSheetChange,
  foundationViewMode,
  onFoundationViewModeChange,
  roofDisplayMode,
  onRoofDisplayModeChange,
  roofLayerVisibility,
  onRoofLayerVisibilityChange,
  plumbing3DVisibility,
  onPlumbing3DVisibilityChange,
}: DesignBuilderDisplayMenuProps) {
  const isRcFrame = buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill';

  return (
    <DesignBuilderCommandMenu
      menuKind="display"
      label={<>Display</>}
      closeOnSelect={false}
      panelClassName="w-64 max-h-[min(70vh,520px)] space-y-1 overflow-y-auto p-3 text-xs"
      summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <DisplayMenuCollapsibleSection id="display-wall-overlays" title="Wall Overlays">
        <ToggleField label="Show opening layout" checked={showOpeningLayout} onChange={onShowOpeningLayoutChange} />
        <ToggleField
          label="Show Grout / Reinforced Cells"
          title="Shows only calculated CMU core fills, bond-beam cells, and valid closure voids. Does not represent the rough opening itself."
          checked={showGroutCells}
          onChange={onShowGroutCellsChange}
        />
        <ToggleField label="Show Cut-Block Conditions" checked={showClosureWarnings} onChange={onShowClosureWarningsChange} />
      </DisplayMenuCollapsibleSection>

      <DisplayMenuCollapsibleSection id="display-visual-style" title="Visual Style">
        {(
          [
            ['technical', 'Technical'],
            ['material_preview', 'Material Preview'],
          ] as const
        ).map(([mode, label]) => (
          <RadioOption
            key={mode}
            name="design-visual-style"
            checked={visualStyle === mode}
            label={label}
            onChange={() => onVisualStyleChange(mode)}
          />
        ))}
        <CommandMenuAction
          onClick={onOpenMaterials}
          className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Materials &amp; Colors
        </CommandMenuAction>
      </DisplayMenuCollapsibleSection>

      <DisplayMenuCollapsibleSection id="display-2d-drawing" title="2D Drawing">
        {(
          [
            ['architectural', 'Architectural'],
            ['builder', 'Builder'],
          ] as const
        ).map(([mode, label]) => (
          <RadioOption
            key={mode}
            name="design-2d-drawing-style"
            checked={twoDDrawingStyle === mode}
            label={label}
            onChange={() => onTwoDDrawingStyleChange(mode)}
          />
        ))}
      </DisplayMenuCollapsibleSection>

      <DisplayMenuCollapsibleSection id="display-plumbing-3d" title="Plumbing 3D">
        {(
          [
            ['showPlumbing', 'Show Plumbing'],
            ['showFixtures', 'Show Fixtures'],
            ['showFittings', 'Show Fittings'],
            ['showDrain', 'Show Drain'],
            ['showVent', 'Show Vent'],
            ['showColdWater', 'Show Cold Water'],
            ['showHotWater', 'Show Hot Water'],
            ['showUnderground', 'Show Underground'],
            ['showLabels', 'Show Labels'],
            ...(import.meta.env.DEV ? [['showCenterlines', 'Show Plumbing Centerlines'] as const] : []),
            ...(import.meta.env.DEV ? [['showSolvedFittingPorts', 'Show Solved Fitting Ports'] as const] : []),
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={plumbing3DVisibility[key]}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                onPlumbing3DVisibilityChange((current) => ({
                  ...current,
                  [key]: checked,
                }));
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </DisplayMenuCollapsibleSection>

      {import.meta.env.DEV && isRcFrame ? (
        <DisplayMenuCollapsibleSection id="display-debug" title="Debug">
          <ToggleField
            label="Show Roof Reference Perimeters"
            checked={showRoofReferencePerimeters}
            onChange={onShowRoofReferencePerimetersChange}
          />
          <ToggleField
            label="Show Roof Layer Contacts"
            checked={showRoofFramingGuides}
            onChange={onShowRoofFramingGuidesChange}
          />
          <ToggleField
            label="Roof Debug"
            checked={showRoofDebug}
            onChange={onShowRoofDebugChange}
          />
        </DisplayMenuCollapsibleSection>
      ) : null}

      {isRcFrame ? (
        <>
          <DisplayMenuCollapsibleSection id="display-roof-plan" title="Roof Plan">
            <ToggleField label="Show Roof Hatch" checked={showRoofPlanHatch} onChange={onShowRoofPlanHatchChange} />
            <ToggleField label="Show Roof Slope Arrows" checked={showRoofPlanSlopeArrows} onChange={onShowRoofPlanSlopeArrowsChange} />
            <ToggleField label="Show Roof Dimensions" checked={showRoofPlanDimensions} onChange={onShowRoofPlanDimensionsChange} />
            <ToggleField label="Show Roof Reference Lines" checked={showRoofPlanReferenceLines} onChange={onShowRoofPlanReferenceLinesChange} />
            <ToggleField label="Truss Design Detail" checked={showRoofPlanTrussReferenceSheet} onChange={onShowRoofPlanTrussReferenceSheetChange} />
          </DisplayMenuCollapsibleSection>

          <DisplayMenuCollapsibleSection id="display-foundation-view" title="Foundation View">
            {(
              [
                ['full_model', 'Full Model'],
                ['cutaway_below_grade', 'Cutaway / Below Grade'],
                ['structural_frame_only', 'Structural Frame Only'],
              ] as const
            ).map(([mode, label]) => (
              <RadioOption
                key={mode}
                name="foundation-view-mode"
                checked={foundationViewMode === mode}
                label={label}
                onChange={() => onFoundationViewModeChange(mode)}
              />
            ))}
          </DisplayMenuCollapsibleSection>

          <DisplayMenuCollapsibleSection id="display-roof-display" title="Roof Display">
            {(
              [
                ['full_roof', 'Full Roof'],
                ['roof_cladding_only', 'Roof Cladding Only'],
                ['steel_framing_only', 'Steel Framing Only'],
                ['gable_masonry_only', 'Gable Masonry Only'],
                ['foundation_frame_roof', 'Foundation + Frame + Roof'],
              ] as const
            ).map(([mode, label]) => (
              <RadioOption
                key={mode}
                name="roof-display-mode"
                checked={roofDisplayMode === mode}
                label={label}
                onChange={() => onRoofDisplayModeChange(mode)}
              />
            ))}
          </DisplayMenuCollapsibleSection>

          <DisplayMenuCollapsibleSection id="display-roof-layers" title="Roof Layers">
            {(
              [
                ['roofCladding', 'Roof Cladding'],
                ['ridgeCap', 'Ridge Cap'],
                ['fascia', 'Fascia'],
                ['soffit', 'Soffit'],
                ['steelTrusses', 'Steel Trusses'],
                ['purlins', 'Purlins'],
                ['gableEndCmu', 'Gable-End CMU'],
                ['rakedConcreteCap', 'Raked Concrete Cap'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={roofLayerVisibility[key] ?? DEFAULT_ROOF_LAYER_VISIBILITY[key]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    onRoofLayerVisibilityChange((current) => ({
                      ...current,
                      [key]: checked,
                    }));
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </DisplayMenuCollapsibleSection>
        </>
      ) : null}
    </DesignBuilderCommandMenu>
  );
}

function DisplayMenuCollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-slate-200 pt-1 dark:border-slate-700">
      <button
        type="button"
        id={`${id}-header`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between rounded px-1 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <span>{title}</span>
        <span aria-hidden className="text-[10px]">
          {open ? 'v' : '>'}
        </span>
      </button>
      {open ? (
        <div id={`${id}-panel`} className="space-y-1 pb-1">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <label
      className="flex items-center gap-2 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300"
      title={title}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

function RadioOption({
  name,
  checked,
  label,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
