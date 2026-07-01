import type {
  DoorSwingDirection,
  DoorSwingType,
} from "../domain/planDoorSymbol";
import type { MeasurementSystem } from "../../../utils/measurementPreferences";
import {
  displayLengthToMeters,
  displayLengthUnit,
  metersToDisplayLength,
} from "../../../utils/measurementDisplay";
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
  measurementSystem?: MeasurementSystem;
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

function formatToolInputNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(4)).toString();
}

function parseToolInputNumber(value: string): number {
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "") return Number.NaN;
  return Number(normalized);
}

function meterStringToDisplayString(
  value: string,
  measurementSystem: MeasurementSystem,
  kind: "length" | "small",
): string {
  if (value.trim() === "") return "";
  const meters = parseToolInputNumber(value);
  if (!Number.isFinite(meters)) return value;
  return formatToolInputNumber(metersToDisplayLength(meters, measurementSystem, kind));
}

function displayStringToMeters(
  value: string,
  measurementSystem: MeasurementSystem,
  kind: "length" | "small",
): number {
  const displayValue = parseToolInputNumber(value);
  if (!Number.isFinite(displayValue)) return Number.NaN;
  return displayLengthToMeters(displayValue, measurementSystem, kind);
}

function displayStringToMeterString(
  value: string,
  measurementSystem: MeasurementSystem,
  kind: "length" | "small",
): string {
  if (value.trim() === "") return "";
  const meters = displayStringToMeters(value, measurementSystem, kind);
  if (!Number.isFinite(meters)) return value;
  return formatToolInputNumber(meters);
}

function numberToDisplayString(
  value: number,
  measurementSystem: MeasurementSystem,
  kind: "length" | "small",
): string {
  return formatToolInputNumber(metersToDisplayLength(value, measurementSystem, kind));
}

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
  const measurementSystem = props.measurementSystem ?? "metric";

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
              value={meterStringToDisplayString(
                props.segmentLengthInput,
                measurementSystem,
                "length",
              )}
              onChange={(event) =>
                props.onSegmentLengthInputChange(
                  displayStringToMeterString(
                    event.target.value,
                    measurementSystem,
                    "length",
                  ),
                )
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={displayLengthUnit(measurementSystem, "length")}
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Wall height
            <input
              type="text"
              inputMode="decimal"
              value={numberToDisplayString(
                props.wallHeightMeters,
                measurementSystem,
                "length",
              )}
              onChange={(event) => {
                const next = displayStringToMeters(
                  event.target.value,
                  measurementSystem,
                  "length",
                );
                props.onWallHeightChange(
                  Number.isFinite(next) ? Math.max(0.5, next) : props.wallHeightMeters,
                );
              }}
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
            />
            {displayLengthUnit(measurementSystem, "length")}
          </label>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Unit: {measurementSystem === "metric" ? "meters" : "feet/inches"}
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
              value={meterStringToDisplayString(
                props.activeOpeningSettings.widthMeters,
                measurementSystem,
                "small",
              )}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  widthMeters: displayStringToMeterString(
                    event.target.value,
                    measurementSystem,
                    "small",
                  ),
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={displayLengthUnit(measurementSystem, "small")}
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Height
            <input
              value={meterStringToDisplayString(
                props.activeOpeningSettings.heightMeters,
                measurementSystem,
                "small",
              )}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  heightMeters: displayStringToMeterString(
                    event.target.value,
                    measurementSystem,
                    "small",
                  ),
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={displayLengthUnit(measurementSystem, "small")}
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
            Rough allowance
            <input
              value={meterStringToDisplayString(
                props.activeOpeningSettings.roughOpeningAllowanceMeters,
                measurementSystem,
                "small",
              )}
              onChange={(event) =>
                props.onOpeningToolSettingChange(props.activeOpeningTool!, {
                  roughOpeningAllowanceMeters: displayStringToMeterString(
                    event.target.value,
                    measurementSystem,
                    "small",
                  ),
                })
              }
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={displayLengthUnit(measurementSystem, "small")}
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
