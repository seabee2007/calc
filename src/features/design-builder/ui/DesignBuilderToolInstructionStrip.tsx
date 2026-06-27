import type {
  DoorSwingDirection,
  DoorSwingType,
} from "../domain/planDoorSymbol";
import type {
  DesignBuilderSelection,
  DesignBuilderSnapMode,
  DesignBuilderToolMode,
  DesignUnitSystem,
  DesignWallRole,
  PlacedDesignComponent,
} from "../types";
import { getDesignComponentDefinition } from "../domain/designComponentRegistry";
import { DoorConfigurationControls } from "./DoorConfigurationControls";

export type DesignBuilderOpeningToolKind = "door" | "window";

export type DesignBuilderOpeningToolSettings = {
  widthMeters: string;
  heightMeters: string;
  roughOpeningAllowanceMeters: string;
  swingDirection?: DoorSwingDirection;
  swingType?: DoorSwingType;
};

export type DesignBuilderToolInstructionStripProps = {
  toolInstruction: string | null;
  toolMode: DesignBuilderToolMode;
  segmentLengthInput: string;
  onSegmentLengthInputChange: (value: string) => void;
  wallHeightMeters: number;
  onWallHeightChange: (value: number) => void;
  drawWallRole: DesignWallRole;
  onDrawWallRoleChange: (value: DesignWallRole) => void;
  unitSystem: DesignUnitSystem;
  orthogonalGuidesEnabled: boolean;
  onToggleOrthogonalGuides: () => void;
  activeOpeningTool: DesignBuilderOpeningToolKind | null;
  activeOpeningSettings: DesignBuilderOpeningToolSettings | null;
  onOpeningToolSettingChange: (
    tool: DesignBuilderOpeningToolKind,
    patch: Partial<DesignBuilderOpeningToolSettings>,
  ) => void;
  snapMode: DesignBuilderSnapMode;
  selectedComponentId: string | null;
  selectedComponent: PlacedDesignComponent | null;
  selectedOpeningId: string | null;
  activeSelection: DesignBuilderSelection;
  onDeleteSelectedComponent: () => void;
  onDeleteSelectedOpening: () => void;
  onDeleteSelectedSegment: () => void;
};

export function DesignBuilderToolInstructionStrip(
  props: DesignBuilderToolInstructionStripProps,
) {
  if (
    !props.toolInstruction &&
    props.toolMode !== "delete" &&
    props.toolMode !== "draw_wall"
  ) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
      {props.toolInstruction ? (
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
          {props.toolInstruction}
        </span>
      ) : null}

      {props.toolMode === "draw_wall" ? (
        <>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Wall type
            <select
              value={props.drawWallRole}
              onChange={(event) =>
                props.onDrawWallRoleChange(event.target.value as DesignWallRole)
              }
              className="h-8 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="exterior">Exterior wall</option>
              <option value="partition">Partition wall</option>
            </select>
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Length
            <input
              value={props.segmentLengthInput}
              onChange={(event) =>
                props.onSegmentLengthInputChange(event.target.value)
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="m"
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Wall height
            <input
              type="text"
              inputMode="decimal"
              value={props.wallHeightMeters}
              onChange={(event) =>
                props.onWallHeightChange(
                  Math.max(0.5, Number(event.target.value) || props.wallHeightMeters),
                )
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
            />
            m
          </label>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Unit: {props.unitSystem === "metric" ? "meters" : "feet/inches"}
          </span>
          <button
            type="button"
            onClick={props.onToggleOrthogonalGuides}
            className="flex h-8 items-center gap-2 rounded-lg px-2.5 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="text-slate-600 dark:text-slate-300">
              Orthogonal guides
            </span>
            <span
              className={
                props.orthogonalGuidesEnabled
                  ? "text-cyan-600 dark:text-cyan-300"
                  : "text-slate-400"
              }
            >
              {props.orthogonalGuidesEnabled ? "On" : "Off"}
            </span>
          </button>
        </>
      ) : null}

      {props.activeOpeningTool && props.activeOpeningSettings ? (
        <>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Width
            <input
              value={props.activeOpeningSettings.widthMeters}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  widthMeters: event.target.value,
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="m"
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Height
            <input
              value={props.activeOpeningSettings.heightMeters}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  heightMeters: event.target.value,
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="m"
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Rough allowance
            <input
              value={props.activeOpeningSettings.roughOpeningAllowanceMeters}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  roughOpeningAllowanceMeters: event.target.value,
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="m"
            />
          </label>
          {props.activeOpeningTool === "door" ? (
            <DoorConfigurationControls
              swingType={props.activeOpeningSettings.swingType ?? "inswing"}
              swingDirection={
                props.activeOpeningSettings.swingDirection ?? "left"
              }
              onSwingTypeChange={(swingType) =>
                props.onOpeningToolSettingChange("door", { swingType })
              }
              onSwingDirectionChange={(swingDirection) =>
                props.onOpeningToolSettingChange("door", { swingDirection })
              }
            />
          ) : null}
          <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Snap to CMU:{" "}
            {props.snapMode === "cmu_module" ? "On" : "Available"}
          </span>
        </>
      ) : null}

      {props.toolMode === "delete" ? (
        <>
          <button
            type="button"
            onClick={props.onDeleteSelectedComponent}
            disabled={!props.selectedComponentId}
            title={
              props.selectedComponent
                ? `Delete selected ${
                    getDesignComponentDefinition(props.selectedComponent.type)
                      .displayName
                  }`
                : "Select a component to delete."
            }
            className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete selected component
          </button>
          <button
            type="button"
            onClick={props.onDeleteSelectedOpening}
            disabled={!props.selectedOpeningId}
            className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete selected opening
          </button>
          <button
            type="button"
            onClick={props.onDeleteSelectedSegment}
            disabled={props.activeSelection.kind !== "wall_segment"}
            title={
              props.activeSelection.kind !== "wall_segment"
                ? "Select a wall segment to delete."
                : "Delete selected wall"
            }
            className="h-8 rounded-lg border border-red-300 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete selected wall
          </button>
        </>
      ) : null}
    </div>
  );
}
