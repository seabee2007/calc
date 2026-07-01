import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ComponentParameterKind,
  DesignComponentDefinition,
} from "../domain/designComponentRegistry";
import type { MeasurementSystem } from "../../../utils/measurementPreferences";
import {
  displayLengthToMeters,
  displayLengthUnit,
  metersToDisplayLength,
} from "../../../utils/measurementDisplay";

export type DesignBuilderComponentParameterPanelProps = {
  definition: DesignComponentDefinition | null;
  draftParameters: Record<string, unknown>;
  errors: readonly string[];
  position: { x: number; y: number };
  collapsed: boolean;
  viewLabel: string;
  measurementSystem?: MeasurementSystem;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onCancel: () => void;
  onParameterChange: (
    key: string,
    value: string,
    kind: ComponentParameterKind,
  ) => void;
};

export function DesignBuilderComponentParameterPanel(
  props: DesignBuilderComponentParameterPanelProps,
) {
  if (!props.definition) return null;
  const measurementSystem = props.measurementSystem ?? "metric";

  return (
    <div
      className="absolute z-20 w-72 rounded-xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl"
      style={{ left: props.position.x, top: props.position.y }}
      data-component-parameter-panel="true"
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-slate-800 px-3 py-2"
        onPointerDown={props.onDragStart}
      >
        <div>
          <div className="text-xs font-bold text-cyan-200">
            {props.definition.displayName}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {props.definition.division}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => props.onCollapsedChange(!props.collapsed)}
            className="rounded-md px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            {props.collapsed ? "Show" : "Min"}
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-md px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
      {!props.collapsed ? (
        <div className="space-y-3 p-3">
          {props.definition.parameterSchema.map((field) => (
            <label
              key={field.key}
              className="block text-xs font-semibold text-slate-300"
            >
              <span className="mb-1 flex items-center justify-between">
                <span>{field.label}</span>
                {field.unit ? (
                  <span className="text-[10px] text-slate-500">
                    {field.unit === "m"
                      ? displayLengthUnit(measurementSystem, "small")
                      : field.unit}
                  </span>
                ) : null}
              </span>
              {field.kind === "select" ? (
                <select
                  value={String(props.draftParameters[field.key] ?? "")}
                  onChange={(event) =>
                    props.onParameterChange(
                      field.key,
                      event.target.value,
                      field.kind,
                    )
                  }
                  className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.kind === "number" ? "number" : "text"}
                  step={field.kind === "number" ? "0.01" : undefined}
                  min={
                    field.kind === "number" && field.unit === "m" && field.min != null
                      ? metersToDisplayLength(field.min, measurementSystem, "small")
                      : field.min
                  }
                  value={formatComponentParameterValue(
                    props.draftParameters[field.key],
                    field.kind,
                    field.unit,
                    measurementSystem,
                  )}
                  onChange={(event) =>
                    props.onParameterChange(
                      field.key,
                      parseComponentParameterValue(
                        event.target.value,
                        field.kind,
                        field.unit,
                        measurementSystem,
                      ),
                      field.kind,
                    )
                  }
                  className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                />
              )}
            </label>
          ))}
          {props.errors.length > 0 ? (
            <div className="rounded-lg border border-red-900 bg-red-950/50 px-2 py-1.5 text-xs font-semibold text-red-200">
              {props.errors[0]}
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-[11px] font-medium text-slate-400">
            {props.viewLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatComponentParameterValue(
  value: unknown,
  kind: ComponentParameterKind,
  unit: string | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (kind !== "number" || unit !== "m") return String(value ?? "");
  const meters = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(meters)) return String(value ?? "");
  return Number(metersToDisplayLength(meters, measurementSystem, "small").toFixed(4)).toString();
}

function parseComponentParameterValue(
  value: string,
  kind: ComponentParameterKind,
  unit: string | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (kind !== "number" || unit !== "m") return value;
  if (value.trim() === "") return "";
  const displayValue = Number(value);
  if (!Number.isFinite(displayValue)) return value;
  return Number(displayLengthToMeters(displayValue, measurementSystem, "small").toFixed(4)).toString();
}
