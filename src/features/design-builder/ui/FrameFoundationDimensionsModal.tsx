import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import ModalShell from "../../../components/ui/ModalShell";
import Button from "../../../components/ui/Button";
import { useConfirm } from "../../../contexts/ConfirmContext";
import type {
  ColumnPlacementMode,
  DesignWallLayoutParameters,
  RcFrameFoundationSettings,
  RoofRidgeDirection,
  RoofSystemSettings,
  RoofType,
} from "../types";
import {
  resolveFoundationElevations,
  validateRcFrameFoundationSettings,
} from "../domain/foundationElevations";
import {
  normalizeRcFrameFoundationSettings,
  createDefaultRcFrameFoundationSettings,
} from "../domain/rcFrameFoundationMigration";
import {
  createDefaultRoofSystemSettings,
  normalizeRoofSystemSettings,
} from "../domain/roofSystemDefaults";
import {
  describeGableEndRoofingClosureBlockReason,
  totalGableEndRoofingClosureAreaSquareMeters,
} from "../domain/gableEndRoofingClosureSolver";
import { totalRoofFasciaLengthMeters } from "../domain/roofFasciaSolver";
import { totalRoofSoffitAreaSquareMeters } from "../domain/roofSoffitSolver";
import { resolveRoofSystem } from "../domain/roofSystemResolver";
import { resolveOuterRoofBeamBearingLoop } from "../domain/roofFootprintSupport";
import { reconcileStructuralFrameWithFoundation } from "../domain/structuralFrameLayout";
import { getSegmentFramesForWallLayout } from "../geometry/designGeometry";
import {
  previewFrameLayoutCounts,
  type FrameFoundationDimensionsApplyPayload,
} from "../domain/structureActions";
import type { CmuBuildingPreset } from "../domain/designBuilderPreset";
import type { MaterialsFinishesScope } from "./MaterialsColorsModal";
import {
  formatInputNumber,
  parseDecimalInput,
} from "../ui/designBuilderNumberInput";
import {
  BORDER_DEFAULT,
  FORM_ERROR,
  FORM_INPUT_PLANNER,
  FORM_LABEL,
  TEXT_ACCENT,
  TEXT_DANGER,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUCCESS,
  TEXT_WARNING,
} from "../../../theme/appTheme";

const MODAL_SECTION_CARD = `overflow-hidden rounded-xl border ${BORDER_DEFAULT} bg-slate-50 dark:bg-slate-900/80`;
const MODAL_SECTION_HEADER = `flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60`;
const MODAL_SECTION_PANEL = `space-y-3 border-t ${BORDER_DEFAULT} px-4 py-4`;
const MODAL_INFO_PANEL = `rounded-lg border ${BORDER_DEFAULT} bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300`;
const MODAL_TOGGLE_ROW =
  "flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900 dark:bg-slate-800/80 dark:text-slate-100";
const MODAL_INPUT_GROUP =
  "flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-cyan-500";
const MODAL_INPUT_FIELD =
  "min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100";
const MODAL_INPUT_SUFFIX =
  "flex min-w-12 items-center justify-center border-l border-slate-300 px-3 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400";
const MODAL_ELEVATION_PANEL =
  "h-fit rounded-xl border border-cyan-600/40 bg-cyan-50/80 p-4 dark:border-cyan-700/60 dark:bg-slate-900";
const MODAL_FIELD_CONTROL = `${FORM_INPUT_PLANNER} h-10`;

export type FrameFoundationDimensionsModalProps = {
  isOpen: boolean;
  preset: CmuBuildingPreset;
  wallLayout: DesignWallLayoutParameters;
  exteriorFootprint: readonly { x: number; z: number }[];
  geometryRevision: number;
  lastStructureApplyRevision: number;
  onClose: () => void;
  onApply: (payload: FrameFoundationDimensionsApplyPayload) => boolean;
  onRoofDraftChange?: (roofSystem: RoofSystemSettings) => void;
  onOpenFinishes?: (scope: Exclude<MaterialsFinishesScope, "all">) => void;
};

type FoundationSection =
  | "plinthBeam"
  | "interiorFloorSlab"
  | "roofBeam"
  | "tieBeam"
  | "columns"
  | "isolatedFootings";

function positiveOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatElevation(value: number): string {
  return `${value.toFixed(2)} m`;
}

function ModalNumberField({
  label,
  value,
  suffix,
  min = 0,
  error,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min?: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatInputNumber(value));
  useEffect(() => {
    if (document.activeElement?.getAttribute("aria-label") === label) return;
    setDraft(formatInputNumber(value));
  }, [label, value]);

  const commit = () => {
    const parsed = parseDecimalInput(draft);
    if (!Number.isFinite(parsed)) return;
    onChange(typeof min === "number" ? Math.max(min, parsed) : parsed);
    setDraft(
      formatInputNumber(
        typeof min === "number" ? Math.max(min, parsed) : parsed,
      ),
    );
  };

  return (
    <label className="block text-sm">
      <span className={FORM_LABEL}>{label}</span>
      <div className={MODAL_INPUT_GROUP}>
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={MODAL_INPUT_FIELD}
        />
        <span className={MODAL_INPUT_SUFFIX}>{suffix}</span>
      </div>
      {error ? <span className={FORM_ERROR}>{error}</span> : null}
    </label>
  );
}

function CollapsibleSection({
  id,
  title,
  helper,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  helper?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={MODAL_SECTION_CARD}>
      <button
        type="button"
        id={`${id}-header`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((current) => !current)}
        className={MODAL_SECTION_HEADER}
      >
        <div>
          <div className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>
            {title}
          </div>
          {helper && !open ? (
            <p className={`mt-1 text-xs ${TEXT_MUTED}`}>{helper}</p>
          ) : null}
        </div>
        <span className={TEXT_MUTED} aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div id={`${id}-panel`} className={MODAL_SECTION_PANEL}>
          {helper ? <p className={`text-xs ${TEXT_MUTED}`}>{helper}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={MODAL_TOGGLE_ROW}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4 accent-cyan-600 dark:accent-cyan-500"
      />
    </label>
  );
}

export default function FrameFoundationDimensionsModal({
  isOpen,
  preset,
  wallLayout,
  exteriorFootprint,
  geometryRevision,
  lastStructureApplyRevision,
  onClose,
  onApply,
  onRoofDraftChange,
  onOpenFinishes,
}: FrameFoundationDimensionsModalProps) {
  const confirm = useConfirm();
  const [foundationDraft, setFoundationDraft] =
    useState<RcFrameFoundationSettings>(() =>
      createDefaultRcFrameFoundationSettings(),
    );
  const [roofDraft, setRoofDraft] = useState<RoofSystemSettings>(
    createDefaultRoofSystemSettings(),
  );
  const [autoGenerateFrameLayout, setAutoGenerateFrameLayout] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setFoundationDraft(
      normalizeRcFrameFoundationSettings(preset.foundationSettings),
    );
    setRoofDraft(normalizeRoofSystemSettings(preset.roofSystem));
    setAutoGenerateFrameLayout(true);
  }, [isOpen, preset.foundationSettings, preset.roofSystem]);

  useEffect(() => {
    if (!isOpen) return;
    onRoofDraftChange?.(roofDraft);
  }, [isOpen, onRoofDraftChange, roofDraft]);

  const wallHeightMeters =
    wallLayout.defaultWallHeightMeters || preset.wall.heightMeters;

  const elevations = useMemo(
    () =>
      resolveFoundationElevations({
        foundation: foundationDraft,
        wallHeightMeters,
      }),
    [foundationDraft, wallHeightMeters],
  );

  const foundationValidation = useMemo(
    () =>
      validateRcFrameFoundationSettings({
        foundation: foundationDraft,
        wallHeightMeters,
      }),
    [foundationDraft, wallHeightMeters],
  );

  const segmentFrames = useMemo(
    () => getSegmentFramesForWallLayout(wallLayout, preset.wall),
    [preset.wall, wallLayout],
  );

  const previewFrameSystem = useMemo(
    () =>
      reconcileStructuralFrameWithFoundation({
        layout: wallLayout,
        segmentFrames,
        frameSystem: preset.frameSystem,
        foundation: foundationDraft,
        wallHeightMeters,
      }).frameSystem,
    [
      foundationDraft,
      preset.frameSystem,
      segmentFrames,
      wallHeightMeters,
      wallLayout,
    ],
  );

  const resolvedRoof = useMemo(() => {
    const roofBearingLoop = resolveOuterRoofBeamBearingLoop({
      layout: wallLayout,
      segmentFrames,
      roofBeams: previewFrameSystem.beams,
      fallbackExteriorFootprint: exteriorFootprint,
    });
    return resolveRoofSystem({
      layout: wallLayout,
      wallExteriorFootprint: exteriorFootprint,
      structuralBearingPerimeter: roofBearingLoop.points,
      bearingSource: roofBearingLoop.source,
      bearingWarnings: roofBearingLoop.warnings,
      roofSystem: roofDraft,
      roofBeamTopElevationMeters: elevations.roofBeamTopY,
      segmentFrames,
    });
  }, [
    elevations.roofBeamTopY,
    exteriorFootprint,
    previewFrameSystem.beams,
    roofDraft,
    segmentFrames,
    wallLayout,
  ]);

  const layoutPreview = useMemo(
    () =>
      previewFrameLayoutCounts({
        preset,
        foundation: foundationDraft,
        autoGenerateFrameLayout,
      }),
    [autoGenerateFrameLayout, foundationDraft, preset],
  );

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (foundationDraft.columns.widthMeters <= 0)
      errors.columnWidth = "Column width must be greater than zero.";
    if (foundationDraft.columns.depthMeters <= 0)
      errors.columnDepth = "Column depth must be greater than zero.";
    if (foundationDraft.columns.intermediateSpacingMeters <= 0) {
      errors.columnSpacing =
        "Intermediate support spacing must be greater than zero.";
    }
    if (foundationDraft.columns.heightAbovePlinthMeters <= 0) {
      errors.columnHeight = "Column height must be greater than zero.";
    }
    if (
      foundationDraft.roofBeam.enabled &&
      foundationDraft.columns.heightAbovePlinthMeters <=
        foundationDraft.roofBeam.depthMeters
    ) {
      errors.columnHeight = "Column height must exceed roof beam depth.";
    }
    if (
      foundationDraft.plinthBeam.enabled &&
      foundationDraft.plinthBeam.widthMeters <= 0
    ) {
      errors.plinthWidth = "Plinth Beam width must be greater than zero.";
    }
    if (
      foundationDraft.interiorFloorSlab.enabled &&
      foundationDraft.interiorFloorSlab.thicknessMeters <= 0
    ) {
      errors.interiorFloorSlabThickness =
        "Interior floor slab thickness must be greater than zero.";
    }
    if (
      foundationDraft.roofBeam.enabled &&
      foundationDraft.roofBeam.widthMeters <= 0
    ) {
      errors.roofWidth = "Roof Beam width must be greater than zero.";
    }
    if (
      foundationDraft.tieBeam.enabled &&
      foundationDraft.tieBeam.widthMeters <= 0
    ) {
      errors.tieWidth = "Tie Beam width must be greater than zero.";
    }
    if (
      foundationDraft.isolatedFootings.enabled &&
      foundationDraft.isolatedFootings.widthMeters <= 0
    ) {
      errors.footingWidth = "Footing width must be greater than zero.";
    }
    if (
      foundationDraft.isolatedFootings.enabled &&
      foundationDraft.isolatedFootings.autoCreateAtStructuralColumns &&
      layoutPreview.columnCount <= 0
    ) {
      errors.footings =
        "Enable frame layout or add structural columns before creating footings.";
    }
    if (roofDraft.enabled && roofDraft.roofAssemblyThicknessMeters <= 0) {
      errors.roofAssemblyThickness =
        "Roof assembly thickness must be greater than zero.";
    }
    if (roofDraft.enabled && roofDraft.eaveOverhangMeters < 0) {
      errors.eaveOverhang = "Eave overhang cannot be negative.";
    }
    if (roofDraft.enabled && roofDraft.gableEndOverhangMeters < 0) {
      errors.gableEndOverhang = "Gable-End Overhang cannot be negative.";
    }
    if (
      roofDraft.enabled &&
      roofDraft.roofType === "gable" &&
      roofDraft.steelTrusses.maxSpacingMeters <= 0
    ) {
      errors.trussSpacing = "Truss spacing must be greater than zero.";
    }
    if (
      roofDraft.enabled &&
      roofDraft.purlins.enabled &&
      roofDraft.purlins.maxSpacingMeters <= 0
    ) {
      errors.purlinSpacing = "Purlin spacing must be greater than zero.";
    }
    if (
      roofDraft.enabled &&
      roofDraft.roofType === "gable" &&
      roofDraft.gable.rakedConcreteCapEnabled &&
      roofDraft.gable.rakedConcreteCapDepthMeters <= 0
    ) {
      errors.rakedCapDepth =
        "Raked concrete cap depth must be greater than zero when enabled.";
    }
    if (roofDraft.enabled && !resolvedRoof.supported) {
      errors.roofFootprint =
        resolvedRoof.unsupportedMessage ??
        "Roof generation requires a closed rectangular footprint.";
    }
    if (roofDraft.enabled && roofDraft.peakHeightAboveRoofBeamMeters <= 0) {
      errors.peakHeight =
        "Peak height above Roof Beam must be greater than zero.";
    }
    return errors;
  }, [foundationDraft, layoutPreview.columnCount, resolvedRoof, roofDraft]);

  const isDraftDirty = useMemo(() => {
    const normalizedFoundation =
      normalizeRcFrameFoundationSettings(foundationDraft);
    const normalizedPresetFoundation = normalizeRcFrameFoundationSettings(
      preset.foundationSettings,
    );
    const normalizedRoof = normalizeRoofSystemSettings(roofDraft);
    const normalizedPresetRoof = normalizeRoofSystemSettings(preset.roofSystem);
    return (
      JSON.stringify(normalizedFoundation) !==
        JSON.stringify(normalizedPresetFoundation) ||
      JSON.stringify(normalizedRoof) !== JSON.stringify(normalizedPresetRoof)
    );
  }, [
    foundationDraft,
    roofDraft,
    preset.foundationSettings,
    preset.roofSystem,
  ]);

  const appliedToModel =
    !isDraftDirty &&
    lastStructureApplyRevision > 0 &&
    geometryRevision === lastStructureApplyRevision;

  const validationErrors = [
    ...foundationValidation.errors,
    ...Object.values(fieldErrors),
  ];
  const isValid = validationErrors.length === 0;

  function patchSection<T extends FoundationSection>(
    section: T,
    patch: Partial<RcFrameFoundationSettings[T]>,
  ) {
    setFoundationDraft((current) => ({
      ...current,
      [section]: { ...current[section], ...patch },
    }));
  }

  function patchRoof(patch: Partial<RoofSystemSettings>) {
    setRoofDraft((current) => ({ ...current, ...patch }));
  }

  function patchSteelTrusses(
    patch: Partial<RoofSystemSettings["steelTrusses"]>,
  ) {
    setRoofDraft((current) => ({
      ...current,
      steelTrusses: { ...current.steelTrusses, ...patch },
    }));
  }

  function patchPurlins(patch: Partial<RoofSystemSettings["purlins"]>) {
    setRoofDraft((current) => ({
      ...current,
      purlins: { ...current.purlins, ...patch },
    }));
  }

  function patchCorrugatedMetal(
    patch: Partial<RoofSystemSettings["corrugatedMetal"]>,
  ) {
    setRoofDraft((current) => ({
      ...current,
      corrugatedMetal: { ...current.corrugatedMetal, ...patch },
    }));
  }

  function patchFascia(patch: Partial<RoofSystemSettings["fascia"]>) {
    setRoofDraft((current) => ({
      ...current,
      fascia: { ...current.fascia, ...patch },
    }));
  }

  function patchSoffit(patch: Partial<RoofSystemSettings["soffit"]>) {
    setRoofDraft((current) => ({
      ...current,
      soffit: { ...current.soffit, ...patch },
    }));
  }

  function patchGable(patch: Partial<RoofSystemSettings["gable"]>) {
    setRoofDraft((current) => ({
      ...current,
      gable: { ...current.gable, ...patch },
    }));
  }

  async function handleResetDefaults() {
    const approved = await confirm({
      title: "Reset frame & foundation defaults",
      message:
        "Restore default column, beam, footing, and roof settings for this session?",
      confirmLabel: "Reset Defaults",
      confirmVariant: "danger",
      showWarningIcon: true,
    });
    if (!approved) return;
    setFoundationDraft(createDefaultRcFrameFoundationSettings());
    setRoofDraft(createDefaultRoofSystemSettings());
    setAutoGenerateFrameLayout(true);
  }

  function handleApply() {
    if (!isValid) return;
    const applied = onApply({
      foundation: foundationDraft,
      roofSystem: { ...roofDraft, enabled: roofDraft.enabled },
      autoGenerateFrameLayout,
    });
    if (applied) {
      onClose();
    }
  }

  const roofBeamUndersideY =
    elevations.roofBeamTopY - foundationDraft.roofBeam.depthMeters;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="RC Settings"
      subtitle="Configure conceptual RC frame, beams, footings, roof framing, cladding, and gable-end settings for this design."
      size="2xl"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            {isDraftDirty ? (
              <p className={TEXT_WARNING}>
                Changes are staged. Select Apply Dimensions to update the model.
              </p>
            ) : appliedToModel ? (
              <p className={TEXT_SUCCESS}>Applied to 3D model</p>
            ) : null}
            {validationErrors.length > 0 ? (
              <p className={TEXT_DANGER}>{validationErrors[0]}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleResetDefaults()}
            >
              Reset Defaults
            </Button>
            <Button variant="accent" onClick={handleApply} disabled={!isValid}>
              Apply Dimensions
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <CollapsibleSection
            id="frame-layout"
            title="Frame Layout"
            defaultOpen
          >
            <label className="block text-sm">
              <span className={FORM_LABEL}>Column Placement</span>
              <select
                value={foundationDraft.columns.placementMode}
                onChange={(event) =>
                  patchSection("columns", {
                    placementMode: event.currentTarget
                      .value as ColumnPlacementMode,
                  })
                }
                className={MODAL_FIELD_CONTROL}
              >
                <option value="corners_only">Corner Columns Only</option>
                <option value="corners_and_junctions">
                  Corners + Junctions
                </option>
                <option value="corners_and_intermediate">
                  Corners + Intermediate Supports
                </option>
                <option value="manual">Custom / Manual</option>
              </select>
            </label>
            <ModalNumberField
              label="Intermediate Support Spacing"
              value={foundationDraft.columns.intermediateSpacingMeters}
              suffix="m o.c."
              min={0.1}
              error={fieldErrors.columnSpacing}
              onChange={(value) =>
                patchSection("columns", {
                  intermediateSpacingMeters: positiveOrFallback(value, 4),
                })
              }
            />
            <ToggleRow
              label="Automatically Generate Frame Layout"
              checked={autoGenerateFrameLayout}
              onChange={setAutoGenerateFrameLayout}
            />
            <div className={MODAL_INFO_PANEL}>
              <div>
                Resolved Structural Columns: {layoutPreview.columnCount}
              </div>
              <div>
                Resolved Frame Segments: {layoutPreview.frameSegmentCount}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="columns"
            title="Columns"
            helper="Column height is measured from the top of the plinth beam (floor level, 0.00 m) to the top of the column at roof beam level. Columns also extend below the plinth through tie beams to isolated footings."
            defaultOpen
          >
            <ModalNumberField
              label="Column Height"
              value={foundationDraft.columns.heightAbovePlinthMeters}
              suffix="m"
              error={fieldErrors.columnHeight}
              onChange={(value) =>
                patchSection("columns", {
                  heightAbovePlinthMeters: positiveOrFallback(value, 3.1),
                })
              }
            />
            <ModalNumberField
              label="Column Width"
              value={foundationDraft.columns.widthMeters}
              suffix="m"
              error={fieldErrors.columnWidth}
              onChange={(value) =>
                patchSection("columns", {
                  widthMeters: positiveOrFallback(value, 0.35),
                })
              }
            />
            <ModalNumberField
              label="Column Depth"
              value={foundationDraft.columns.depthMeters}
              suffix="m"
              error={fieldErrors.columnDepth}
              onChange={(value) =>
                patchSection("columns", {
                  depthMeters: positiveOrFallback(value, 0.35),
                })
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="plinth-beam"
            title="Plinth Beam / Floor Level"
            helper="Top of Plinth Beam = 0.00 m. The interior floor slab is cast flush with the plinth top between the beams; thickness is measured downward from that floor level. CMU walls bear on the plinth / floor at 0.00 m."
          >
            <ToggleRow
              label="Plinth Beam Enabled"
              checked={foundationDraft.plinthBeam.enabled}
              onChange={(checked) =>
                patchSection("plinthBeam", { enabled: checked })
              }
            />
            <ModalNumberField
              label="Plinth Beam Width"
              value={foundationDraft.plinthBeam.widthMeters}
              suffix="m"
              error={fieldErrors.plinthWidth}
              onChange={(value) =>
                patchSection("plinthBeam", {
                  widthMeters: positiveOrFallback(value, 0.3),
                })
              }
            />
            <ModalNumberField
              label="Plinth Beam Depth"
              value={foundationDraft.plinthBeam.depthMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("plinthBeam", {
                  depthMeters: positiveOrFallback(value, 0.45),
                })
              }
            />
            <ToggleRow
              label="Interior Floor Slab Enabled"
              checked={foundationDraft.interiorFloorSlab.enabled}
              onChange={(checked) =>
                patchSection("interiorFloorSlab", { enabled: checked })
              }
            />
            <ModalNumberField
              label="Interior Floor Slab Thickness"
              value={foundationDraft.interiorFloorSlab.thicknessMeters}
              suffix="m"
              error={fieldErrors.interiorFloorSlabThickness}
              onChange={(value) =>
                patchSection("interiorFloorSlab", {
                  thicknessMeters: positiveOrFallback(value, 0.125),
                })
              }
            />
            <ToggleRow
              label="Apply Along Exterior Walls"
              checked={foundationDraft.plinthBeam.followsExteriorSegments}
              onChange={(checked) =>
                patchSection("plinthBeam", { followsExteriorSegments: checked })
              }
            />
            <ToggleRow
              label="Apply Along Interior Structural Walls"
              checked={foundationDraft.plinthBeam.followsInteriorSegments}
              onChange={(checked) =>
                patchSection("plinthBeam", { followsInteriorSegments: checked })
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="tie-beam"
            title="Tie Beam"
            helper="Tie Beams connect structural columns at footing level. The bottom of each Tie Beam rests directly on the top of its supporting footing."
          >
            <ToggleRow
              label="Tie Beam Enabled"
              checked={foundationDraft.tieBeam.enabled}
              onChange={(checked) =>
                patchSection("tieBeam", { enabled: checked })
              }
            />
            <ModalNumberField
              label="Tie Beam Width"
              value={foundationDraft.tieBeam.widthMeters}
              suffix="m"
              error={fieldErrors.tieWidth}
              onChange={(value) =>
                patchSection("tieBeam", {
                  widthMeters: positiveOrFallback(value, 0.25),
                })
              }
            />
            <ModalNumberField
              label="Tie Beam Depth"
              value={foundationDraft.tieBeam.depthMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("tieBeam", {
                  depthMeters: positiveOrFallback(value, 0.3),
                })
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="roof-beam"
            title="Roof Beam"
            helper="The Roof Beam sits above the CMU infill wall and supports roof-level framing."
          >
            <ToggleRow
              label="Roof Beam Enabled"
              checked={foundationDraft.roofBeam.enabled}
              onChange={(checked) =>
                patchSection("roofBeam", { enabled: checked })
              }
            />
            <ModalNumberField
              label="Roof Beam Width"
              value={foundationDraft.roofBeam.widthMeters}
              suffix="m"
              error={fieldErrors.roofWidth}
              onChange={(value) =>
                patchSection("roofBeam", {
                  widthMeters: positiveOrFallback(value, 0.25),
                })
              }
            />
            <ModalNumberField
              label="Roof Beam Depth"
              value={foundationDraft.roofBeam.depthMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("roofBeam", {
                  depthMeters: positiveOrFallback(value, 0.3),
                })
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="footings"
            title="Isolated Footings"
            helper="Footing Drop Below Plinth Beam is measured from the bottom of the Plinth Beam down to the top of the isolated footing. Tie Beams rest directly on footing tops."
          >
            <ToggleRow
              label="Create Footings at Structural Columns"
              checked={
                foundationDraft.isolatedFootings.autoCreateAtStructuralColumns
              }
              onChange={(checked) =>
                patchSection("isolatedFootings", {
                  enabled: checked || foundationDraft.isolatedFootings.enabled,
                  autoCreateAtStructuralColumns: checked,
                })
              }
            />
            {fieldErrors.footings ? (
              <p className={`text-xs ${TEXT_DANGER}`}>{fieldErrors.footings}</p>
            ) : null}
            <ModalNumberField
              label="Footing Width"
              value={foundationDraft.isolatedFootings.widthMeters}
              suffix="m"
              error={fieldErrors.footingWidth}
              onChange={(value) =>
                patchSection("isolatedFootings", {
                  enabled: true,
                  widthMeters: positiveOrFallback(value, 1.2),
                })
              }
            />
            <ModalNumberField
              label="Footing Length"
              value={foundationDraft.isolatedFootings.lengthMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("isolatedFootings", {
                  lengthMeters: positiveOrFallback(value, 1.2),
                })
              }
            />
            <ModalNumberField
              label="Footing Thickness"
              value={foundationDraft.isolatedFootings.thicknessMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("isolatedFootings", {
                  thicknessMeters: positiveOrFallback(value, 0.45),
                })
              }
            />
            <ModalNumberField
              label="Footing Drop Below Plinth Beam"
              value={foundationDraft.isolatedFootings.dropBelowPlinthBeamMeters}
              suffix="m"
              onChange={(value) =>
                patchSection("isolatedFootings", {
                  dropBelowPlinthBeamMeters: positiveOrFallback(value, 1.5),
                })
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="roof-system"
            title="Roof System"
            helper="Structural roof framing and corrugated metal cladding are resolved as separate coordinated systems."
          >
            <ToggleRow
              label="Roof Enabled"
              checked={roofDraft.enabled}
              onChange={(checked) => patchRoof({ enabled: checked })}
            />
            {fieldErrors.roofFootprint ? (
              <p className={`text-xs ${TEXT_DANGER}`}>
                {fieldErrors.roofFootprint}
              </p>
            ) : null}
            <label className="block text-sm">
              <span className={FORM_LABEL}>Roof Type</span>
              <select
                value={roofDraft.roofType}
                onChange={(event) => {
                  const roofType = event.currentTarget.value as RoofType;
                  patchRoof({
                    roofType,
                    supportSystem:
                      roofType === "hip"
                        ? "steel_hip_framing"
                        : "steel_trusses",
                  });
                }}
                className={MODAL_FIELD_CONTROL}
              >
                <option value="gable">Gable Roof</option>
                <option value="hip">Hip Roof</option>
              </select>
            </label>
            <ModalNumberField
              label="Peak Height Above Roof Beam"
              value={roofDraft.peakHeightAboveRoofBeamMeters}
              suffix="m"
              error={fieldErrors.peakHeight}
              onChange={(value) =>
                patchRoof({
                  peakHeightAboveRoofBeamMeters: positiveOrFallback(
                    value,
                    1.25,
                  ),
                })
              }
            />
            <ModalNumberField
              label="Eave Overhang"
              value={roofDraft.eaveOverhangMeters}
              suffix="m"
              error={fieldErrors.eaveOverhang}
              onChange={(value) =>
                patchRoof({
                  eaveOverhangMeters: positiveOrFallback(value, 0.3),
                })
              }
            />
            <ModalNumberField
              label="Gable-End Overhang"
              value={roofDraft.gableEndOverhangMeters}
              suffix="m"
              error={fieldErrors.gableEndOverhang}
              onChange={(value) =>
                patchRoof({
                  gableEndOverhangMeters: positiveOrFallback(value, 0.3),
                })
              }
            />
            <p className={`-mt-2 text-xs ${TEXT_MUTED}`}>
              Horizontal roof projection beyond each gable-end wall, parallel to
              the ridge.
            </p>
            <ModalNumberField
              label="Roof Assembly Thickness"
              value={roofDraft.roofAssemblyThicknessMeters}
              suffix="m"
              error={fieldErrors.roofAssemblyThickness}
              onChange={(value) =>
                patchRoof({
                  roofAssemblyThicknessMeters: positiveOrFallback(value, 0.15),
                })
              }
            />
            <label className="block text-sm">
              <span className={FORM_LABEL}>Ridge Direction</span>
              <select
                value={roofDraft.ridgeDirection}
                onChange={(event) =>
                  patchRoof({
                    ridgeDirection: event.currentTarget
                      .value as RoofRidgeDirection,
                  })
                }
                className={MODAL_FIELD_CONTROL}
              >
                <option value="along_longest_axis">
                  Along Longest Building Axis
                </option>
                <option value="along_shortest_axis">
                  Along Shortest Building Axis
                </option>
                <option value="along_selected_wall_pair">
                  Select Wall Pair
                </option>
              </select>
            </label>
            {roofDraft.ridgeDirection === "along_selected_wall_pair" ? (
              <label className="block text-sm">
                <span className={FORM_LABEL}>Ridge Wall Pair</span>
                <select
                  value={roofDraft.selectedRidgeWallSegmentId ?? ""}
                  onChange={(event) =>
                    patchRoof({
                      selectedRidgeWallSegmentId:
                        event.currentTarget.value || undefined,
                    })
                  }
                  className={MODAL_FIELD_CONTROL}
                >
                  <option value="">Select wall segment</option>
                  {wallLayout.segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {resolvedRoof.supported ? (
              <div className={MODAL_INFO_PANEL}>
                <div>Roof Run: {resolvedRoof.roofRunMeters.toFixed(2)} m</div>
                <div>Roof Rise: {resolvedRoof.roofRiseMeters.toFixed(2)} m</div>
                <div>
                  Calculated Roof Pitch:{" "}
                  {resolvedRoof.roofRunMeters > 0
                    ? `${((resolvedRoof.roofRiseMeters / resolvedRoof.roofRunMeters) * 12).toFixed(2)}:12`
                    : "—"}
                </div>
                <div>
                  Rafter / Truss Reference Length:{" "}
                  {resolvedRoof.roofMemberReferenceLengthMeters.toFixed(2)} m
                </div>
                <div>
                  Ridge Length: {resolvedRoof.ridgeLengthMeters.toFixed(2)} m
                </div>
                {resolvedRoof.roofType === "gable" ? (
                  <>
                    <div>
                      Structural Ridge Length:{" "}
                      {resolvedRoof.structuralRidgeLengthMeters.toFixed(2)} m
                    </div>
                    <div>
                      Gable-End Overhang:{" "}
                      {resolvedRoof.gableEndOverhangMeters.toFixed(2)} m
                    </div>
                  </>
                ) : null}
                <div>
                  Roof Surface Area:{" "}
                  {resolvedRoof.roofSurfaceAreaSquareMeters.toFixed(2)} m²
                </div>
              </div>
            ) : null}
            <div
              className={`border-t ${BORDER_DEFAULT} pt-3 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}
            >
              Steel Framing
            </div>
            <p className={`text-xs ${TEXT_MUTED}`}>
              {roofDraft.roofType === "gable"
                ? "Roof Support System: Steel Trusses"
                : "Roof Support System: Steel Hip Framing"}
            </p>
            {roofDraft.roofType === "gable" ? (
              <>
                <ModalNumberField
                  label="Maximum Truss Spacing"
                  value={roofDraft.steelTrusses.maxSpacingMeters}
                  suffix="m"
                  error={fieldErrors.trussSpacing}
                  onChange={(value) =>
                    patchSteelTrusses({
                      maxSpacingMeters: positiveOrFallback(
                        value,
                        roofDraft.steelTrusses.maxSpacingMeters || 0.6,
                      ),
                    })
                  }
                />
                <label className="block text-sm">
                  <span className={FORM_LABEL}>
                    Steel Truss Profile / Description
                  </span>
                  <input
                    type="text"
                    value={roofDraft.steelTrusses.profileLabel}
                    onChange={(event) =>
                      patchSteelTrusses({
                        profileLabel: event.currentTarget.value,
                      })
                    }
                    className={MODAL_FIELD_CONTROL}
                  />
                </label>
                <ModalNumberField
                  label="Web Steel Allowance"
                  value={roofDraft.steelTrusses.webSteelAllowanceFactor}
                  suffix="×"
                  onChange={(value) =>
                    patchSteelTrusses({
                      webSteelAllowanceFactor: positiveOrFallback(value, 0.35),
                    })
                  }
                />
                <ToggleRow
                  label="Base Plates Enabled"
                  checked={roofDraft.steelTrusses.basePlateEnabled}
                  onChange={(checked) =>
                    patchSteelTrusses({ basePlateEnabled: checked })
                  }
                />
                <ModalNumberField
                  label="Base Plate Width"
                  value={roofDraft.steelTrusses.basePlateWidthMeters}
                  suffix="m"
                  onChange={(value) =>
                    patchSteelTrusses({
                      basePlateWidthMeters: positiveOrFallback(value, 0.2),
                    })
                  }
                />
                <ModalNumberField
                  label="Base Plate Length"
                  value={roofDraft.steelTrusses.basePlateLengthMeters}
                  suffix="m"
                  onChange={(value) =>
                    patchSteelTrusses({
                      basePlateLengthMeters: positiveOrFallback(value, 0.25),
                    })
                  }
                />
                <ModalNumberField
                  label="Base Plate Thickness"
                  value={roofDraft.steelTrusses.basePlateThicknessMeters}
                  suffix="m"
                  onChange={(value) =>
                    patchSteelTrusses({
                      basePlateThicknessMeters: positiveOrFallback(
                        value,
                        0.012,
                      ),
                    })
                  }
                />
                <ModalNumberField
                  label="Anchor Bolts Per Bearing"
                  value={roofDraft.steelTrusses.anchorBoltsPerBearing}
                  suffix="EA"
                  min={1}
                  onChange={(value) =>
                    patchSteelTrusses({
                      anchorBoltsPerBearing: Math.max(
                        1,
                        Math.round(positiveOrFallback(value, 4)),
                      ),
                    })
                  }
                />
              </>
            ) : null}
            {roofDraft.roofType === "hip" ? (
              <ModalNumberField
                label="Number of Trusses"
                value={roofDraft.steelTrusses.hipInteriorTrussCount}
                suffix="EA"
                min={0}
                onChange={(value) =>
                  patchSteelTrusses({
                    hipInteriorTrussCount: Math.max(0, Math.round(value)),
                  })
                }
              />
            ) : null}
            <ToggleRow
              label="Purlins Enabled"
              checked={roofDraft.purlins.enabled}
              onChange={(checked) => patchPurlins({ enabled: checked })}
            />
            <label className="block text-sm">
              <span className={FORM_LABEL}>Purlin Profile / Description</span>
              <input
                type="text"
                value={roofDraft.purlins.profileLabel}
                onChange={(event) =>
                  patchPurlins({ profileLabel: event.currentTarget.value })
                }
                className={MODAL_FIELD_CONTROL}
              />
            </label>
            <ModalNumberField
              label="Maximum Purlin Spacing"
              value={roofDraft.purlins.maxSpacingMeters}
              suffix="m"
              error={fieldErrors.purlinSpacing}
              onChange={(value) =>
                patchPurlins({
                  maxSpacingMeters: positiveOrFallback(value, 1.2),
                })
              }
            />
            <div
              className={`border-t ${BORDER_DEFAULT} pt-3 text-xs font-semibold uppercase tracking-wide ${TEXT_MUTED}`}
            >
              Corrugated Metal Roofing
            </div>
            <ToggleRow
              label="Corrugated Metal Roofing Enabled"
              checked={roofDraft.corrugatedMetal.enabled}
              onChange={(checked) => patchCorrugatedMetal({ enabled: checked })}
            />
            <label className="block text-sm">
              <span className={FORM_LABEL}>Sheet Type / Profile</span>
              <input
                type="text"
                value={roofDraft.corrugatedMetal.sheetTypeLabel}
                onChange={(event) =>
                  patchCorrugatedMetal({
                    sheetTypeLabel: event.currentTarget.value,
                  })
                }
                className={MODAL_FIELD_CONTROL}
              />
            </label>
            <ModalNumberField
              label="Roofing Waste and Overlap %"
              value={roofDraft.corrugatedMetal.wastePercent}
              suffix="%"
              onChange={(value) =>
                patchCorrugatedMetal({
                  wastePercent: positiveOrFallback(value, 10),
                })
              }
            />
            <ToggleRow
              label="Ridge Cap Enabled"
              checked={roofDraft.corrugatedMetal.ridgeCapEnabled}
              onChange={(checked) =>
                patchCorrugatedMetal({ ridgeCapEnabled: checked })
              }
            />
            <ModalNumberField
              label="Ridge Cap Lap Allowance %"
              value={roofDraft.corrugatedMetal.ridgeCapLapAllowancePercent}
              suffix="%"
              onChange={(value) =>
                patchCorrugatedMetal({
                  ridgeCapLapAllowancePercent: positiveOrFallback(value, 10),
                })
              }
            />
            <ToggleRow
              label="Fascia Trim Enabled"
              checked={roofDraft.fascia.enabled}
              onChange={(checked) => patchFascia({ enabled: checked })}
            />
            {roofDraft.fascia.enabled ? (
              <p className={`text-xs ${TEXT_MUTED}`}>
                Preview: {resolvedRoof.fasciaPlacements.length} fascia trim
                {resolvedRoof.fasciaPlacements.length === 1 ? "" : "s"},{" "}
                {totalRoofFasciaLengthMeters(
                  resolvedRoof.fasciaPlacements,
                ).toFixed(2)}{" "}
                m.
              </p>
            ) : null}
            <ToggleRow
              label="Soffit Panels Enabled"
              checked={roofDraft.soffit.enabled}
              onChange={(checked) => patchSoffit({ enabled: checked })}
            />
            {roofDraft.soffit.enabled ? (
              <p className={`text-xs ${TEXT_MUTED}`}>
                Preview: {resolvedRoof.soffitPlacements.length} soffit panel
                {resolvedRoof.soffitPlacements.length === 1 ? "" : "s"},{" "}
                {totalRoofSoffitAreaSquareMeters(
                  resolvedRoof.soffitPlacements,
                ).toFixed(2)}{" "}
                sq m.
              </p>
            ) : null}
          </CollapsibleSection>

          {roofDraft.roofType === "gable" ? (
            <CollapsibleSection
              id="gable-end-masonry"
              title="Gable End"
              helper="Gable-end CMU follows the roof rake in running bond, staying at least 4 in below the cap bearing line. The raked concrete cap fills the course voids up to the purlin bottom."
            >
              <ToggleRow
                label="Generate Gable-End CMU"
                checked={roofDraft.gable.enabled}
                onChange={(checked) => patchGable({ enabled: checked })}
              />
              <ModalNumberField
                label="Minimum Rake Cap Depth"
                value={roofDraft.gable.rakeClearanceMeters}
                suffix="m"
                onChange={(value) =>
                  patchGable({
                    rakeClearanceMeters: positiveOrFallback(value, 0.1016),
                  })
                }
              />
              <ToggleRow
                label="Raked Concrete Cap Enabled"
                checked={roofDraft.gable.rakedConcreteCapEnabled}
                onChange={(checked) =>
                  patchGable({ rakedConcreteCapEnabled: checked })
                }
              />
              <ModalNumberField
                label="Raked Cap Wall Thickness"
                value={
                  roofDraft.gable.rakedConcreteCapWallDepthMeters ??
                  roofDraft.gable.rakedConcreteCapDepthMeters
                }
                suffix="m"
                error={fieldErrors.rakedCapDepth}
                onChange={(value) =>
                  patchGable({
                    rakedConcreteCapWallDepthMeters: positiveOrFallback(
                      value,
                      0.19,
                    ),
                    rakedConcreteCapDepthMeters: positiveOrFallback(
                      value,
                      0.19,
                    ),
                  })
                }
              />
              {preset.buildingSystemMode ===
              "reinforced_concrete_frame_with_cmu_infill" ? (
                <>
                  <ToggleRow
                    label="Close in gable end with corrugated roofing"
                    checked={roofDraft.gable.closeInWithRoofingEnabled}
                    onChange={(checked) =>
                      patchGable({ closeInWithRoofingEnabled: checked })
                    }
                  />
                  {roofDraft.gable.closeInWithRoofingEnabled ? (
                    <p className={`text-xs ${TEXT_MUTED}`}>
                      {resolvedRoof.gableEndRoofingClosures.length > 0 ? (
                        <>
                          Preview: {resolvedRoof.gableEndRoofingClosures.length}{" "}
                          close-in panel
                          {resolvedRoof.gableEndRoofingClosures.length === 1
                            ? ""
                            : "s"}
                          ,{" "}
                          {totalGableEndRoofingClosureAreaSquareMeters(
                            resolvedRoof.gableEndRoofingClosures,
                          ).toFixed(2)}{" "}
                          m². The 3D view updates live while this dialog is
                          open. Click Apply Dimensions to save.
                        </>
                      ) : (
                        (describeGableEndRoofingClosureBlockReason({
                          roofSystem: roofDraft,
                          supported: resolvedRoof.supported,
                          trussCount: resolvedRoof.trussCount,
                        }) ??
                        "Close-in panels could not be generated for the current roof layout.")
                      )}
                    </p>
                  ) : null}
                </>
              ) : null}
            </CollapsibleSection>
          ) : null}

          {onOpenFinishes ? (
            <CollapsibleSection
              id="finishes"
              title="Finishes"
              helper="Choose interior and exterior material appearances for Material Preview mode."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() => onOpenFinishes("interior")}
                >
                  Interior Finishes
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onOpenFinishes("exterior")}
                >
                  Exterior Finishes
                </Button>
              </div>
            </CollapsibleSection>
          ) : null}
        </div>

        <aside className={MODAL_ELEVATION_PANEL}>
          <div className={`text-sm font-semibold ${TEXT_ACCENT}`}>
            Structural Elevation Preview
          </div>
          <dl className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
            <div className="flex justify-between gap-2">
              <dt>Top of Roof Beam</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.roofBeamTopY)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Underside of Roof Beam</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(roofBeamUndersideY)}
              </dd>
            </div>
            <div
              className={`flex justify-between gap-2 border-t ${BORDER_DEFAULT} pt-2`}
            >
              <dt>Top of Plinth Beam</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                0.00 m
              </dd>
            </div>
            {foundationDraft.interiorFloorSlab.enabled ? (
              <>
                <div className="flex justify-between gap-2">
                  <dt>Floor Slab Top (same as plinth)</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">
                    {formatElevation(elevations.interiorFloorSlabTopY)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Floor Slab Bottom</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">
                    {formatElevation(
                      elevations.interiorFloorSlabTopY -
                        elevations.interiorFloorSlabThicknessMeters,
                    )}
                  </dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt>Bottom of Plinth Beam</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.bottomOfPlinthBeamY)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Top of Tie Beam</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.topOfTieBeamY)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold text-cyan-700 dark:text-cyan-100">
              <dt>Bottom of Tie Beam / Top of Footing</dt>
              <dd className="font-mono">
                {formatElevation(elevations.bottomOfTieBeamY)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Bottom of Footing</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.bottomOfFootingY)}
              </dd>
            </div>
            <div
              className={`flex justify-between gap-2 border-t ${BORDER_DEFAULT} pt-2`}
            >
              <dt>CMU Clear Height</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.cmuClearHeightMeters)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Column Height (above plinth)</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.columnHeightAbovePlinthMeters)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Column Height (total)</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {formatElevation(elevations.columnHeightMeters)}
              </dd>
            </div>
            {roofDraft.enabled ? (
              <>
                <div
                  className={`flex justify-between gap-2 border-t ${BORDER_DEFAULT} pt-2`}
                >
                  <dt>Roof Peak Elevation</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">
                    {formatElevation(resolvedRoof.peakElevationMeters)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Roof Surface Area</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100">
                    {resolvedRoof.roofSurfaceAreaSquareMeters.toFixed(2)} m²
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </aside>
      </div>
    </ModalShell>
  );
}
