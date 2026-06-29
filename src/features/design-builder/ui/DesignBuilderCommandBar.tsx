import { DESIGN_BUILDER_COPY } from "../domain/designBuilderCopy";
import type { DesignComponentDefinition } from "../domain/designComponentRegistry";
import { PLAN_GRID_SCALE_PRESETS } from "../domain/pointerPlanMapping";
import type {
  BuildingSystemMode,
  Design2DViewType,
  DesignBuilderSnapMode,
  DesignBuilderToolMode,
  DesignBuilderViewMode,
  DesignComponentType,
  Design2dDrawingStyleMode,
  DesignVisualStyle,
  FoundationViewMode,
  ModuleFitMode,
  RoofDisplayMode,
  RoofLayerVisibility,
} from "../types";
import type { Plumbing3DVisibility } from "../plumbing";
import type { SnapTolerancePreset } from "../snapping/snapTypes";
import {
  CommandMenuAction,
  DesignBuilderCommandMenu,
} from "./DesignBuilderCommandMenu";
import { DesignBuilderDisplayMenu } from "./DesignBuilderDisplayMenu";
import type { DesignBuilderViewerHeightPreset } from "./DesignBuilderViewMenu";
import {
  DesignBuilder2DViewTabs,
  DesignBuilderViewModeTabs,
} from "./DesignBuilderViewTabs";

type ComponentDefinitionGroup = {
  division: string;
  definitions: DesignComponentDefinition[];
};

export type DesignBuilderCommandBarProps = {
  activeToolLabel: string;
  toolMode: DesignBuilderToolMode;
  toolOptions: readonly { mode: DesignBuilderToolMode; label: string }[];
  modelLoaded: boolean;
  onActivateToolMode: (mode: DesignBuilderToolMode) => void;
  componentDefinitionGroups: readonly ComponentDefinitionGroup[];
  activeComponentType: DesignComponentType | null;
  onActivateDesignComponent: (componentType: DesignComponentType) => void;
  onActivateCmuSepticTank: () => void;
  viewMode: DesignBuilderViewMode;
  onViewModeChange: (mode: DesignBuilderViewMode) => void;
  active2DView: Design2DViewType;
  onActive2DViewChange: (view: Design2DViewType) => void;
  structureMenuLabel: string;
  activeBuildingSystemMode: BuildingSystemMode;
  isFrameStructureMode: boolean;
  onSetBuildingSystemMode: (mode: BuildingSystemMode) => void;
  onOpenFrameFoundationSettings: () => void;
  footprintClosed: boolean;
  snapMode: DesignBuilderSnapMode;
  onSnapModeChange: (mode: DesignBuilderSnapMode) => void;
  orthogonalGuidesEnabled: boolean;
  onToggleOrthogonalGuides: () => void;
  objectSnapEnabled: boolean;
  onObjectSnapEnabledChange: (value: boolean) => void;
  endpointSnapEnabled: boolean;
  onEndpointSnapEnabledChange: (value: boolean) => void;
  midpointSnapEnabled: boolean;
  onMidpointSnapEnabledChange: (value: boolean) => void;
  intersectionSnapEnabled: boolean;
  onIntersectionSnapEnabledChange: (value: boolean) => void;
  nearestSnapEnabled: boolean;
  onNearestSnapEnabledChange: (value: boolean) => void;
  perpendicularSnapEnabled: boolean;
  onPerpendicularSnapEnabledChange: (value: boolean) => void;
  polarTrackingEnabled: boolean;
  onPolarTrackingEnabledChange: (value: boolean) => void;
  snapTolerancePreset: SnapTolerancePreset;
  onSnapTolerancePresetChange: (preset: SnapTolerancePreset) => void;
  gridSpacingMeters: number;
  onApplyGridScalePreset: (spacingMeters: number) => void;
  moduleFitMode: ModuleFitMode;
  onModuleFitModeChange: (mode: ModuleFitMode) => void;
  onResolveModuleFit: (apply: boolean) => void;
  onFitView: () => void;
  onResetView: () => void;
  onApplyViewerHeightPreset: (preset: DesignBuilderViewerHeightPreset) => void;
  onCloseFootprint: () => void;
  closeFootprintEnabled: boolean;
  onRepairFootprintToExactRectangle: () => void;
  repairFootprintEnabled: boolean;
  onHelp: () => void;
  buildingSystemMode: BuildingSystemMode;
  showOpeningLayout: boolean;
  onShowOpeningLayoutChange: (value: boolean) => void;
  showGroutCells: boolean;
  onShowGroutCellsChange: (value: boolean) => void;
  showClosureWarnings: boolean;
  onShowClosureWarningsChange: (value: boolean) => void;
  visualStyle: DesignVisualStyle;
  onVisualStyleChange: (value: DesignVisualStyle) => void;
  onOpenMaterials: () => void;
  twoDDrawingStyle: Design2dDrawingStyleMode;
  onTwoDDrawingStyleChange: (value: Design2dDrawingStyleMode) => void;
  showRoofReferencePerimeters: boolean;
  onShowRoofReferencePerimetersChange: (value: boolean) => void;
  showRoofFramingGuides: boolean;
  onShowRoofFramingGuidesChange: (value: boolean) => void;
  showRoofDebug: boolean;
  onShowRoofDebugChange: (value: boolean) => void;
  showRoofPlanHatch: boolean;
  onShowRoofPlanHatchChange: (value: boolean) => void;
  showRoofPlanSlopeArrows: boolean;
  onShowRoofPlanSlopeArrowsChange: (value: boolean) => void;
  showRoofPlanDimensions: boolean;
  onShowRoofPlanDimensionsChange: (value: boolean) => void;
  showRoofPlanReferenceLines: boolean;
  onShowRoofPlanReferenceLinesChange: (value: boolean) => void;
  showRoofPlanTrussReferenceSheet: boolean;
  onShowRoofPlanTrussReferenceSheetChange: (value: boolean) => void;
  foundationViewMode: FoundationViewMode;
  onFoundationViewModeChange: (value: FoundationViewMode) => void;
  roofDisplayMode: RoofDisplayMode;
  onRoofDisplayModeChange: (value: RoofDisplayMode) => void;
  roofLayerVisibility: RoofLayerVisibility;
  onRoofLayerVisibilityChange: (
    updater: (current: RoofLayerVisibility) => RoofLayerVisibility,
  ) => void;
  plumbing3DVisibility: Plumbing3DVisibility;
  onPlumbing3DVisibilityChange: (
    updater: (current: Plumbing3DVisibility) => Plumbing3DVisibility,
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  undoTitle: string;
  redoLabel: string;
  redoTitle: string;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onStartBlankLayout: () => void;
  onSaveDesign: () => void;
  onCopyRoofDebugSnapshot: () => void;
  onDownloadRoofDebugSnapshot: () => void;
  busy: boolean;
  canPersist: boolean;
};

export function DesignBuilderCommandBar(props: DesignBuilderCommandBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Design Builder command bar"
      className="mb-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <DesignBuilderCommandMenu
          menuKind="tools"
          label={<>{props.activeToolLabel}</>}
          isActive={props.toolMode === "select"}
          summaryClassName={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
            props.toolMode === "select"
              ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100"
              : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {props.toolOptions.map((option) => (
            <CommandMenuAction
              key={option.mode}
              aria-label={
                option.mode === "place_door" || option.mode === "place_window"
                  ? "Activate opening placement tool"
                  : undefined
              }
              onClick={() => props.onActivateToolMode(option.mode)}
              disabled={!props.modelLoaded}
              aria-pressed={props.toolMode === option.mode}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                props.toolMode === option.mode
                  ? "bg-cyan-600 text-white"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </CommandMenuAction>
          ))}
        </DesignBuilderCommandMenu>

        <DesignBuilderCommandMenu
          menuKind="components"
          label={<>Components</>}
          isActive={
            props.toolMode === "place_component" ||
            props.toolMode === "place_door" ||
            props.toolMode === "place_window"
          }
          panelClassName="w-56 p-2"
          summaryClassName={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
            props.toolMode === "place_component" ||
            props.toolMode === "place_door" ||
            props.toolMode === "place_window"
              ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100"
              : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {props.componentDefinitionGroups.map((group) => (
            <div key={group.division} className="py-1">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.division}
              </div>
              {group.definitions.map((definition) => (
                <CommandMenuAction
                  key={definition.type}
                  onClick={() => props.onActivateDesignComponent(definition.type)}
                  disabled={!props.modelLoaded}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                    props.activeComponentType === definition.type ||
                    (definition.type === "door" && props.toolMode === "place_door") ||
                    (definition.type === "window" && props.toolMode === "place_window")
                      ? "bg-cyan-600 text-white"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {definition.displayName}
                </CommandMenuAction>
              ))}
            </div>
          ))}
          <div className="py-1">
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Site Utilities
            </div>
            <CommandMenuAction
              onClick={props.onActivateCmuSepticTank}
              disabled={!props.modelLoaded}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              CMU Septic Tank
            </CommandMenuAction>
          </div>
        </DesignBuilderCommandMenu>

        <DesignBuilderViewModeTabs
          viewMode={props.viewMode}
          onViewModeChange={props.onViewModeChange}
        />
        {props.viewMode === "2d" ? (
          <DesignBuilder2DViewTabs
            active2DView={props.active2DView}
            onActive2DViewChange={props.onActive2DViewChange}
          />
        ) : null}

        <DesignBuilderCommandMenu
          menuKind="structure"
          label={<>{props.structureMenuLabel}</>}
          panelClassName="w-56"
          summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-cyan-400 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100"
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            System
          </div>
          <CommandMenuAction
            onClick={() =>
              props.onSetBuildingSystemMode(
                "reinforced_concrete_frame_with_cmu_infill",
              )
            }
            aria-pressed={
              props.activeBuildingSystemMode ===
              "reinforced_concrete_frame_with_cmu_infill"
            }
            className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
              props.activeBuildingSystemMode ===
              "reinforced_concrete_frame_with_cmu_infill"
                ? "bg-cyan-600 text-white"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            RC Structure
          </CommandMenuAction>
          <details className="px-1 py-1">
            <summary className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              Advanced
            </summary>
            <CommandMenuAction
              onClick={() => props.onSetBuildingSystemMode("cmu_bearing_wall")}
              aria-pressed={props.activeBuildingSystemMode === "cmu_bearing_wall"}
              className={`mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                props.activeBuildingSystemMode === "cmu_bearing_wall"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              CMU Bearing Wall
            </CommandMenuAction>
          </details>
          {props.isFrameStructureMode ? (
            <>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <CommandMenuAction
                onClick={props.onOpenFrameFoundationSettings}
                disabled={!props.modelLoaded || !props.footprintClosed}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                RC Settings
              </CommandMenuAction>
            </>
          ) : null}
        </DesignBuilderCommandMenu>

        <DesignBuilderCommandMenu
          menuKind="snap"
          label={
            <>
              Snap:{" "}
              {props.snapMode === "off" ? "Off" : "Grid"}
            </>
          }
          closeOnSelect={false}
          panelClassName="w-64 p-2"
          summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Snap mode
          </div>
          {([
            ["grid", "Grid", props.snapMode !== "off"],
            ["off", "Off", props.snapMode === "off"],
          ] as Array<[DesignBuilderSnapMode, string, boolean]>).map(
            ([mode, label, enabled]) => (
              <button
                key={mode}
                type="button"
                onClick={() => props.onSnapModeChange(mode)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {label}
                </span>
                {enabled ? (
                  <span className="font-bold text-cyan-600 dark:text-cyan-300">
                    On
                  </span>
                ) : null}
              </button>
            ),
          )}
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={props.onToggleOrthogonalGuides}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-slate-700 dark:text-slate-200">
              Orthogonal guides
            </span>
            <span
              className={
                props.orthogonalGuidesEnabled
                  ? "font-bold text-cyan-600 dark:text-cyan-300"
                  : "text-slate-400"
              }
            >
              {props.orthogonalGuidesEnabled ? "On" : "Off"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => props.onPolarTrackingEnabledChange(!props.polarTrackingEnabled)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-slate-700 dark:text-slate-200">Polar tracking</span>
            <span className={props.polarTrackingEnabled ? "font-bold text-cyan-600 dark:text-cyan-300" : "text-slate-400"}>
              {props.polarTrackingEnabled ? "On" : "Off"}
            </span>
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={() => props.onObjectSnapEnabledChange(!props.objectSnapEnabled)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-slate-700 dark:text-slate-200">Object Snap</span>
            <span className={props.objectSnapEnabled ? "font-bold text-cyan-600 dark:text-cyan-300" : "text-slate-400"}>
              {props.objectSnapEnabled ? "On" : "Off"}
            </span>
          </button>
          <div className={`grid grid-cols-2 gap-1 px-1 ${props.objectSnapEnabled ? "" : "opacity-50"}`}>
            {[
              ["Endpoint", props.endpointSnapEnabled, props.onEndpointSnapEnabledChange],
              ["Midpoint", props.midpointSnapEnabled, props.onMidpointSnapEnabledChange],
              ["Intersection", props.intersectionSnapEnabled, props.onIntersectionSnapEnabledChange],
              ["Nearest", props.nearestSnapEnabled, props.onNearestSnapEnabledChange],
              ["Perpendicular", props.perpendicularSnapEnabled, props.onPerpendicularSnapEnabledChange],
            ].map(([label, enabled, onChange]) => (
              <button
                key={label as string}
                type="button"
                disabled={!props.objectSnapEnabled}
                onClick={() => (onChange as (value: boolean) => void)(!(enabled as boolean))}
                className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold disabled:cursor-not-allowed ${
                  enabled
                    ? "bg-cyan-600 text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Tolerance
          </div>
          <div className="grid grid-cols-3 gap-1 px-1">
            {(["low", "normal", "high"] as SnapTolerancePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => props.onSnapTolerancePresetChange(preset)}
                className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${
                  props.snapTolerancePreset === preset
                    ? "bg-cyan-600 text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {preset[0]!.toUpperCase() + preset.slice(1)}
              </button>
            ))}
          </div>
          <p className="px-3 py-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            F3 object snap · F7 grid · F8 ortho · F10 polar · Alt disables snap · Tab cycles targets.
          </p>
          <div className={props.snapMode !== "off" ? "" : "opacity-50"}>
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Snap spacing
            </div>
            <div className="grid grid-cols-2 gap-1 px-1">
              {PLAN_GRID_SCALE_PRESETS.map((preset) => (
                <button
                  key={preset.spacingMeters}
                  type="button"
                  onClick={() => props.onApplyGridScalePreset(preset.spacingMeters)}
                  disabled={props.snapMode === "off"}
                  className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold disabled:cursor-not-allowed ${
                    Math.abs(props.gridSpacingMeters - preset.spacingMeters) <
                    0.0001
                      ? "bg-cyan-600 text-white"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {preset.spacingMeters < 1
                    ? preset.spacingMeters.toFixed(1)
                    : preset.spacingMeters}{" "}
                  m
                </button>
              ))}
            </div>
            <div className="px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Snap spacing applies in Grid mode only.
            </div>
          </div>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Module Fit
          </div>
          {([
            ["exact", "Exact"],
            ["snap_during_draw", "Snap During Draw"],
            ["resolve_after_draw", "Resolve After Draw"],
          ] as Array<[ModuleFitMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => props.onModuleFitModeChange(mode)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                props.moduleFitMode === mode
                  ? "bg-cyan-600 text-white"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
          <p className="px-3 py-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Exact preserves requested dimensions. Snap During Draw snaps endpoints
            to compatible CMU modules. Resolve After Draw keeps requested dimensions
            until you apply a module-fit proposal.
          </p>
          <button
            type="button"
            onClick={() => props.onResolveModuleFit(false)}
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Preview Module Fit
          </button>
          <button
            type="button"
            onClick={() => props.onResolveModuleFit(true)}
            disabled={props.moduleFitMode === "exact"}
            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Apply Module Fit
          </button>
        </DesignBuilderCommandMenu>

        <DesignBuilderDisplayMenu
          buildingSystemMode={props.buildingSystemMode}
          showOpeningLayout={props.showOpeningLayout}
          onShowOpeningLayoutChange={props.onShowOpeningLayoutChange}
          showGroutCells={props.showGroutCells}
          onShowGroutCellsChange={props.onShowGroutCellsChange}
          showClosureWarnings={props.showClosureWarnings}
          onShowClosureWarningsChange={props.onShowClosureWarningsChange}
          visualStyle={props.visualStyle}
          onVisualStyleChange={props.onVisualStyleChange}
          onOpenMaterials={props.onOpenMaterials}
          twoDDrawingStyle={props.twoDDrawingStyle}
          onTwoDDrawingStyleChange={props.onTwoDDrawingStyleChange}
          showRoofReferencePerimeters={props.showRoofReferencePerimeters}
          onShowRoofReferencePerimetersChange={
            props.onShowRoofReferencePerimetersChange
          }
          showRoofFramingGuides={props.showRoofFramingGuides}
          onShowRoofFramingGuidesChange={props.onShowRoofFramingGuidesChange}
          showRoofDebug={props.showRoofDebug}
          onShowRoofDebugChange={props.onShowRoofDebugChange}
          showRoofPlanHatch={props.showRoofPlanHatch}
          onShowRoofPlanHatchChange={props.onShowRoofPlanHatchChange}
          showRoofPlanSlopeArrows={props.showRoofPlanSlopeArrows}
          onShowRoofPlanSlopeArrowsChange={props.onShowRoofPlanSlopeArrowsChange}
          showRoofPlanDimensions={props.showRoofPlanDimensions}
          onShowRoofPlanDimensionsChange={props.onShowRoofPlanDimensionsChange}
          showRoofPlanReferenceLines={props.showRoofPlanReferenceLines}
          onShowRoofPlanReferenceLinesChange={
            props.onShowRoofPlanReferenceLinesChange
          }
          showRoofPlanTrussReferenceSheet={props.showRoofPlanTrussReferenceSheet}
          onShowRoofPlanTrussReferenceSheetChange={
            props.onShowRoofPlanTrussReferenceSheetChange
          }
          foundationViewMode={props.foundationViewMode}
          onFoundationViewModeChange={props.onFoundationViewModeChange}
          roofDisplayMode={props.roofDisplayMode}
          onRoofDisplayModeChange={props.onRoofDisplayModeChange}
          roofLayerVisibility={props.roofLayerVisibility}
          onRoofLayerVisibilityChange={props.onRoofLayerVisibilityChange}
          plumbing3DVisibility={props.plumbing3DVisibility}
          onPlumbing3DVisibilityChange={props.onPlumbing3DVisibilityChange}
        />

        <button
          type="button"
          onClick={props.onUndo}
          disabled={!props.canUndo}
          aria-label={props.undoLabel}
          title={props.undoTitle}
          className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={props.onRedo}
          disabled={!props.canRedo}
          aria-label={props.redoLabel}
          title={props.redoTitle}
          className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Redo
        </button>
        <div className="ml-auto flex items-center gap-2">
          <DesignBuilderCommandMenu
            menuKind="workspace-actions"
            label={<>Actions</>}
            panelClassName="w-48"
            summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CommandMenuAction
              onClick={props.onCloseFootprint}
              disabled={!props.closeFootprintEnabled}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close footprint
            </CommandMenuAction>
            <CommandMenuAction
              onClick={props.onRepairFootprintToExactRectangle}
              disabled={!props.repairFootprintEnabled}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Repair footprint to exact rectangle
            </CommandMenuAction>
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            {import.meta.env.DEV && props.isFrameStructureMode ? (
              <>
                <CommandMenuAction
                  onClick={props.onCopyRoofDebugSnapshot}
                  disabled={!props.modelLoaded}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Copy Roof Debug Snapshot
                </CommandMenuAction>
                <CommandMenuAction
                  onClick={props.onDownloadRoofDebugSnapshot}
                  disabled={!props.modelLoaded}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Download Roof Debug Snapshot
                </CommandMenuAction>
                <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              </>
            ) : null}
            <CommandMenuAction
              onClick={props.onToggleLeftPanel}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {DESIGN_BUILDER_COPY.actions.tools}
            </CommandMenuAction>
            <CommandMenuAction
              onClick={props.onToggleRightPanel}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {DESIGN_BUILDER_COPY.actions.estimate}
            </CommandMenuAction>
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            <CommandMenuAction
              onClick={props.onStartBlankLayout}
              disabled={props.busy}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              {DESIGN_BUILDER_COPY.actions.newLayout}
            </CommandMenuAction>
          </DesignBuilderCommandMenu>

          <button
            type="button"
            onClick={props.onFitView}
            className="hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex lg:items-center"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={props.onSaveDesign}
            disabled={props.busy || !props.canPersist}
            className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
          >
            {DESIGN_BUILDER_COPY.actions.saveDesign}
          </button>
        </div>
      </div>
    </div>
  );
}
