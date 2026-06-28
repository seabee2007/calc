import type { CmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuOpening } from '../domain/cmuOpeningRules';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { normalizeCmuInfillSystem } from '../domain/infillPlaster';
import {
  lintelCourseAssemblyRequiresCutWarning,
  summarizeLintelCourseClosureSide,
} from '../domain/lintelCourseClosureSolver';
import type { ModuleFitReport } from '../domain/moduleFitReport';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import { generateCmuLayout } from '../geometry/designGeometry';
import { cubicMetersToCubicYards } from '../quantity/designQuantityFormulas';
import { metersToFeet } from '../domain/trussWebProfiles';
import type {
  BuildingSystemMode,
  CmuInfillPlasterSettings,
  DesignObjectType,
  DesignUnitSystem,
  DesignWallSegment,
  GableEndSettings,
  ModuleFitStatus,
  StructuralFrameSystemParameters,
  WallOpeningParameters,
} from '../types';
import { DoorConfigurationControls } from './DoorConfigurationControls';
import {
  NumberField,
  SelectField,
  TextField,
} from './DesignBuilderFormFields';
import { positiveOrFallback } from './designBuilderFormFieldMath';

type EditableControlsProps = {
  selectedObjectType: DesignObjectType | null;
  preset: CmuBuildingPreset;
  designGeometryResult: DesignGeometryResult;
  unitSystem: DesignUnitSystem;
  onUnitSystemChange: (unitSystem: DesignUnitSystem) => void;
  onFootprintChange: (field: 'lengthMeters' | 'widthMeters', value: number) => void;
  onWallChange: (
    field: 'heightMeters' | 'wallThicknessMeters' | 'blockLengthMeters' | 'blockHeightMeters' | 'blockDepthMeters' | 'wasteFactor',
    value: number,
  ) => void;
  onShowIndividualBlocksChange: (showIndividualBlocks: boolean) => void;
  onWallOptionChange: (patch: Partial<CmuBuildingPreset['wall']>) => void;
  onBlockModuleChange: (field: keyof NonNullable<CmuBuildingPreset['wall']['blockModule']>, value: number | string) => void;
  cmuModule: ReturnType<typeof resolveCmuModuleConfig>;
  moduleWarnings: string[];
  cmuLayout: ReturnType<typeof generateCmuLayout>;
  selectedWallSegment: DesignWallSegment | null;
  onSlabChange: (field: 'slabThicknessMeters' | 'edgeWidthMeters' | 'edgeDepthMeters', value: number) => void;
  onRoofChange: (field: 'pitchRisePerRun' | 'overhangMeters', value: number) => void;
  onTrussSpacingChange: (value: number) => void;
  onStructureFieldChange: (
    patch: Partial<StructuralFrameSystemParameters> & {
      buildingSystemMode?: BuildingSystemMode;
    },
  ) => void;
  onInfillPlasterChange: (patch: Partial<CmuInfillPlasterSettings>) => void;
  onGableFieldChange: (gableId: string, patch: Partial<GableEndSettings>) => void;
  onOpeningChange: (openingId: string, patch: Partial<WallOpeningParameters>) => void;
  selectedOpeningId: string | null;
};

export function DesignBuilderEditableControls({
  selectedObjectType,
  preset,
  designGeometryResult,
  unitSystem,
  onUnitSystemChange,
  onFootprintChange,
  onWallChange,
  onShowIndividualBlocksChange,
  onWallOptionChange,
  onBlockModuleChange,
  cmuModule,
  moduleWarnings,
  cmuLayout,
  selectedWallSegment,
  onSlabChange,
  onRoofChange,
  onTrussSpacingChange,
  onStructureFieldChange,
  onInfillPlasterChange,
  onGableFieldChange,
  onOpeningChange,
  selectedOpeningId,
}: EditableControlsProps) {
  if (selectedObjectType === 'building_footprint') {
    return (
      <div className="space-y-3">
        <SelectField
          label="Unit system"
          value={unitSystem}
          onChange={(value) => onUnitSystemChange(value as DesignUnitSystem)}
          options={[
            { value: 'metric', label: 'Metric display' },
            { value: 'imperial', label: 'Imperial display' },
          ]}
        />
        <NumberField label="Length" value={preset.footprint.lengthMeters} suffix="m" onChange={(value) => onFootprintChange('lengthMeters', value)} />
        <NumberField label="Width" value={preset.footprint.widthMeters} suffix="m" onChange={(value) => onFootprintChange('widthMeters', value)} />
      </div>
    );
  }

  if (selectedObjectType == null || selectedObjectType === 'cmu_wall_system') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/40">
          <div className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">CMU Module Rules</div>
          <div className="mt-3 space-y-3">
            <TextField
              label="Block family"
              value={cmuModule.familyName}
              onChange={(value) => onBlockModuleChange('familyName', value)}
            />
            <NumberField label="Module length" value={cmuModule.moduleLengthMeters} suffix="m" min={0.05} max={2} step={0.01} onChange={(value) => onBlockModuleChange('moduleLengthMeters', value)} />
            <NumberField label="Module height" value={cmuModule.moduleHeightMeters} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('moduleHeightMeters', value)} />
            <NumberField label="Nominal depth" value={cmuModule.nominalDepthMeters} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('nominalDepthMeters', value)} />
            <NumberField label="Actual block length" value={cmuModule.actualLengthMeters ?? 0} suffix="m" min={0.05} max={2} step={0.01} onChange={(value) => onBlockModuleChange('actualLengthMeters', value)} />
            <NumberField label="Actual block height" value={cmuModule.actualHeightMeters ?? 0} suffix="m" min={0.05} max={1} step={0.01} onChange={(value) => onBlockModuleChange('actualHeightMeters', value)} />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nominal module = actual block + mortar joint ({cmuModule.moduleLengthMeters.toFixed(2)} m x {cmuModule.moduleHeightMeters.toFixed(2)} m).
            </p>
            <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">
              <span>Snap building dimensions to CMU module</span>
              <input
                type="checkbox"
                checked={preset.wall.snapToModule ?? false}
                onChange={(event) => onWallOptionChange({ snapToModule: event.currentTarget.checked })}
                className="h-4 w-4"
              />
            </label>
            <NumberField label="Mortar joint" value={cmuModule.mortarJointMeters} suffix="m" min={0} max={0.05} step={0.001} onChange={(value) => onBlockModuleChange('mortarJointMeters', value)} />
            <ModuleFitReportPanel report={cmuLayout.moduleFitReport} />
            {moduleWarnings.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {moduleWarnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <NumberField label="Wall height" value={selectedWallSegment?.wallHeightMeters ?? preset.wall.heightMeters} suffix="m" min={0.1} max={20} onChange={(value) => onWallChange('heightMeters', value)} />
        <NumberField label="Wall thickness" value={selectedWallSegment?.wallThicknessMeters ?? preset.wall.wallThicknessMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('wallThicknessMeters', value)} />
        <NumberField label="Block length" value={preset.wall.blockLengthMeters} suffix="m" min={0.05} max={2} onChange={(value) => onWallChange('blockLengthMeters', value)} />
        <NumberField label="Block height" value={preset.wall.blockHeightMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('blockHeightMeters', value)} />
        <NumberField label="Block depth" value={preset.wall.blockDepthMeters} suffix="m" min={0.05} max={1} onChange={(value) => onWallChange('blockDepthMeters', value)} />
        <div>
          <NumberField label="Waste" value={preset.wall.wasteFactor * 100} suffix="%" min={0} max={100} onChange={(value) => onWallChange('wasteFactor', value / 100)} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estimate allowance - does not change model geometry.
          </p>
        </div>
        <SelectField
          label="Bond pattern"
          value={preset.wall.bondPattern ?? 'running_bond'}
          onChange={(value) => onWallOptionChange({ bondPattern: value as CmuBuildingPreset['wall']['bondPattern'] })}
          options={[
            { value: 'running_bond', label: 'Running bond' },
            { value: 'stack_bond', label: 'Stack bond' },
          ]}
        />
        <SelectField
          label="Lintel type"
          value={preset.wall.lintelType ?? 'bond_beam'}
          onChange={(value) => onWallOptionChange({ lintelType: value as CmuBuildingPreset['wall']['lintelType'] })}
          options={[
            { value: 'bond_beam', label: 'Bond beam lintel' },
            { value: 'precast_concrete', label: 'Precast concrete' },
            { value: 'none', label: 'None' },
          ]}
        />
        {preset.wall.openings.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Applies when door or window openings are added.
          </p>
        ) : null}
        <NumberField label="Lintel bearing" value={preset.wall.lintelBearingMeters ?? 0.2} suffix="m" min={0} max={2} onChange={(value) => onWallOptionChange({ lintelBearingMeters: Math.max(0, value) })} />
        <NumberField label="Lintel courses" value={preset.wall.lintelCourseCount ?? 1} suffix="courses" step={1} onChange={(value) => onWallOptionChange({ lintelCourseCount: Math.max(1, Math.round(value)) })} />
        <NumberField label="Core fill factor" value={preset.wall.coreFillFactor ?? 0.5} suffix="x" step={0.05} onChange={(value) => onWallOptionChange({ coreFillFactor: Math.max(0, Math.min(1, value)) })} />
        <NumberField label="Grout waste" value={(preset.wall.groutWastePercent ?? 0.1) * 100} suffix="%" step={1} onChange={(value) => onWallOptionChange({ groutWastePercent: Math.max(0, value / 100) })} />
        <NumberField label="Default jamb cells each side" value={preset.wall.jambCellsEachSide ?? 1} suffix="cells" step={1} onChange={(value) => onWallOptionChange({ jambCellsEachSide: Math.max(0, Math.round(value)) })} />
        <NumberField label="Grouted cell spacing" value={preset.wall.groutedCellSpacingMeters ?? 1.2} suffix="m" onChange={(value) => onWallOptionChange({ groutedCellSpacingMeters: positiveOrFallback(value, 1.2) })} />
        <NumberField label="Vertical reinforcement spacing" value={preset.wall.verticalReinforcementSpacingMeters ?? 1.2} suffix="m" onChange={(value) => onWallOptionChange({ verticalReinforcementSpacingMeters: positiveOrFallback(value, 1.2) })} />
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Lintel bond beam enabled</span>
          <input
            type="checkbox"
            checked={preset.wall.lintelBondBeamEnabled ?? true}
            onChange={(event) => onWallOptionChange({ lintelBondBeamEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Top course bond beam</span>
          <input
            type="checkbox"
            checked={preset.wall.bondBeamEnabled ?? true}
            onChange={(event) => onWallOptionChange({ bondBeamEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Conceptual columns/pilasters</span>
          <input
            type="checkbox"
            checked={preset.wall.pilasterEnabled ?? true}
            onChange={(event) => onWallOptionChange({ pilasterEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Show individual CMU blocks</span>
          <input
            type="checkbox"
            checked={preset.wall.showIndividualBlocks}
            onChange={(event) => onShowIndividualBlocksChange(event.currentTarget.checked)}
            className="h-4 w-4"
          />
        </label>
      </div>
    );
  }

  if (selectedObjectType === 'thickened_edge_slab') {
    return (
      <div className="space-y-3">
        <NumberField label="Slab thickness" value={preset.slab.slabThicknessMeters} suffix="m" onChange={(value) => onSlabChange('slabThicknessMeters', value)} />
        <NumberField label="Edge width" value={preset.slab.edgeWidthMeters} suffix="m" onChange={(value) => onSlabChange('edgeWidthMeters', value)} />
        <NumberField label="Edge depth" value={preset.slab.edgeDepthMeters} suffix="m" onChange={(value) => onSlabChange('edgeDepthMeters', value)} />
      </div>
    );
  }

  if (selectedObjectType === 'gable_roof_system') {
    return (
      <div className="space-y-3">
        <NumberField label="Pitch rise/run" value={preset.roof.pitchRisePerRun} suffix=":1" step={0.05} onChange={(value) => onRoofChange('pitchRisePerRun', value)} />
        <NumberField label="Overhang" value={preset.roof.overhangMeters} suffix="m" onChange={(value) => onRoofChange('overhangMeters', value)} />
        <SelectField label="Ridge direction" value={preset.roof.ridgeDirection} onChange={() => undefined} options={[{ value: 'length', label: 'Along building length' }]} />
      </div>
    );
  }

  if (selectedObjectType === 'structural_frame_system') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Conceptual structural frame for estimating only - not structural engineering or code compliance.
        </p>
        <SelectField
          label="Building system mode"
          value={preset.buildingSystemMode}
          onChange={(value) => onStructureFieldChange({ buildingSystemMode: value as BuildingSystemMode })}
          options={[
            { value: 'cmu_bearing_wall', label: 'CMU Bearing Wall (advanced)' },
            { value: 'reinforced_concrete_frame_with_cmu_infill', label: 'RC Frame + CMU Infill' },
          ]}
        />
        <NumberField
          label="Default column width"
          value={preset.frameSystem.defaultColumnWidthMeters}
          suffix="m"
          onChange={(value) => onStructureFieldChange({ defaultColumnWidthMeters: positiveOrFallback(value, 0.35) })}
        />
        <NumberField
          label="Default column depth"
          value={preset.frameSystem.defaultColumnDepthMeters}
          suffix="m"
          onChange={(value) => onStructureFieldChange({ defaultColumnDepthMeters: positiveOrFallback(value, 0.35) })}
        />
        {preset.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use Settings, then RC Settings to edit columns, beams, footings, and roof settings.
          </p>
        ) : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Columns: {preset.frameSystem.columns.length} - Beams: {preset.frameSystem.beams.length}
        </p>
      </div>
    );
  }

  if (selectedObjectType === 'cmu_infill_system') {
    const plaster = normalizeCmuInfillSystem(preset.infillSystem).plaster;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Infill panels: {preset.infillSystem.panels.length}
        </p>
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Exterior Plaster Applied</span>
          <input
            type="checkbox"
            checked={plaster.enabled}
            onChange={(event) => onInfillPlasterChange({ enabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <SelectField
          label="Exterior Finish"
          value={plaster.finish}
          onChange={(value) =>
            onInfillPlasterChange({ finish: value === 'smooth' ? 'smooth' : 'textured' })
          }
          options={[
            { value: 'textured', label: 'Textured' },
            { value: 'smooth', label: 'Smooth' },
          ]}
        />
        <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span>Interior Plaster Applied</span>
          <input
            type="checkbox"
            checked={plaster.interiorEnabled}
            onChange={(event) => onInfillPlasterChange({ interiorEnabled: event.currentTarget.checked })}
            className="h-4 w-4"
          />
        </label>
        <SelectField
          label="Interior Finish"
          value={plaster.interiorFinish}
          onChange={(value) =>
            onInfillPlasterChange({ interiorFinish: value === 'textured' ? 'textured' : 'smooth' })
          }
          options={[
            { value: 'smooth', label: 'Smooth' },
            { value: 'textured', label: 'Textured' },
          ]}
        />
        {designGeometryResult.wallCmuLayout.counts ? (
          <p className="text-xs text-slate-500">
            Full {designGeometryResult.wallCmuLayout.counts.full} - Half {designGeometryResult.wallCmuLayout.counts.half} - Cut{' '}
            {designGeometryResult.wallCmuLayout.counts.cut}
          </p>
        ) : null}
      </div>
    );
  }

  if (selectedObjectType === 'gable_end_system') {
    const gable = preset.gableEndSystem.gableEnds[0];
    const resolvedRoof = designGeometryResult.resolvedRoofSystem;
    const rakedCapVolumeCubicMeters = resolvedRoof?.rakedCapVolumeCubicMeters ?? 0;
    const rakedCapLinearLengthMeters = (resolvedRoof?.gableEnds ?? [])
      .flatMap((gableEnd) => gableEnd.rakedCapPlacements)
      .reduce((sum, cap) => sum + (cap.endStationMeters - cap.startStationMeters), 0);
    const gableCmuBlockCount =
      resolvedRoof?.gableEnds.flatMap((gableEnd) => gableEnd.cmuUnitPlacements).length ?? 0;
    return (
      <div className="space-y-3">
        {resolvedRoof?.supported && resolvedRoof.roofType === 'gable' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <div className="font-semibold text-slate-800 dark:text-slate-100">Estimate quantities</div>
            <div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
              <div>Gable-end CMU: {gableCmuBlockCount} EA</div>
              <div>
                Raked cap concrete: {rakedCapVolumeCubicMeters.toFixed(3)} m3 (
                {cubicMetersToCubicYards(rakedCapVolumeCubicMeters).toFixed(2)} CY)
              </div>
              <div>Raked cap length: {rakedCapLinearLengthMeters.toFixed(2)} m</div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Volume is calculated from the resolved cap prism between the CMU envelope and the purlin bottom - not render-only geometry.
            </p>
          </div>
        ) : null}
        {gable ? (
          <>
            <NumberField label="Eave elevation" value={gable.eaveElevationMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { eaveElevationMeters: value })} />
            <NumberField label="Peak rise above eave" value={gable.peakRiseMeters ?? 0} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { peakRiseMeters: value, peakMode: 'rise_above_eave' })} />
            <NumberField label="Roof-to-masonry clearance" value={gable.roofToMasonryClearanceMeters} suffix="m" onChange={(value) => onGableFieldChange(gable.id, { roofToMasonryClearanceMeters: positiveOrFallback(value, 0.1016) })} />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Configure gable-end CMU and raked cap through Settings, then RC Settings when using a Gable Roof.
          </p>
        )}
      </div>
    );
  }

  if (selectedObjectType === 'steel_truss_system') {
    const truss = designGeometryResult.resolvedRoofSystem?.trussPlacements[0];
    return (
      <div className="space-y-3">
        <NumberField
          label="Spacing"
          value={preset.roofSystem.steelTrusses.maxSpacingMeters}
          suffix="m"
          onChange={onTrussSpacingChange}
        />
        <SelectField
          label="Type"
          value="steel_preview"
          onChange={() => undefined}
          options={[{ value: 'steel_preview', label: truss?.webProfileLabel ?? 'Steel truss preview' }]}
        />
        {truss?.spanMeters != null ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Span {truss.spanMeters.toFixed(2)} m / {metersToFeet(truss.spanMeters).toFixed(1)} ft
          </p>
        ) : null}
      </div>
    );
  }

  const opening =
    (selectedOpeningId ? preset.wall.openings.find((item) => item.id === selectedOpeningId) : null) ??
    preset.wall.openings.find((item) =>
      selectedObjectType === 'door_opening' ? item.type === 'door' : item.type === 'window',
    );
  if (!opening) return <p className="text-sm text-slate-500 dark:text-slate-400">No opening selected.</p>;
  const resolvedOpening = resolveCmuOpening(preset.wall, opening);
  const openingClosures = cmuLayout.openingCourseClosures.filter((closure) => closure.openingId === opening.id);
  const leftClosures = openingClosures.filter((closure) => closure.side === 'left');
  const rightClosures = openingClosures.filter((closure) => closure.side === 'right');
  const lintelCourseAssembly =
    cmuLayout.lintelCourseAssemblies.find((assembly) => assembly.openingId === opening.id) ?? null;
  const cutWarnings = openingClosures.filter((closure) => closure.closureType === 'cut_block').length;
  const lintelCourseCutRequired = lintelCourseAssembly
    ? lintelCourseAssemblyRequiresCutWarning(lintelCourseAssembly)
    : false;
  const closureGroutVolume = openingClosures.reduce(
    (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div className="font-semibold text-slate-800 dark:text-slate-100">
          {opening.type === 'door' ? 'Door' : 'Window'} opening sizing
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div>
            Actual: {resolvedOpening.actualWidthMeters.toFixed(2)}m x {resolvedOpening.actualHeightMeters.toFixed(2)}m
          </div>
          <div>
            Rough: {resolvedOpening.roughOpeningWidthMeters.toFixed(2)}m x {resolvedOpening.roughOpeningHeightMeters.toFixed(2)}m
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <div className="font-semibold text-amber-900 dark:text-amber-100">Opening Course Layout</div>
        <div className="mt-2 grid gap-1 text-xs text-amber-800 dark:text-amber-200">
          <div>Left jamb closures: {summarizeClosures(leftClosures)}</div>
          <div>Right jamb closures: {summarizeClosures(rightClosures)}</div>
          <div>Cut block warnings: {cutWarnings}</div>
          <div>Jamb grout cells: {cmuLayout.jambGroutCells.filter((cell) => cell.openingId === opening.id).length}</div>
          <div>Lintel length: {resolvedOpening.lintelLengthMeters.toFixed(2)}m</div>
          <div>Estimated closure grout: {closureGroutVolume.toFixed(4)} m3</div>
          <div>Jamb grout volume is based on selected grouted cells and course closure conditions, not the full rough opening area.</div>
        </div>
      </div>
      {lintelCourseAssembly && resolvedOpening.lintelType !== 'none' ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-800 dark:text-slate-100">Lintel course closure</div>
          <div className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            <div>Left: {summarizeLintelCourseClosureSide(lintelCourseAssembly.leftPlacements)}</div>
            <div>Right: {summarizeLintelCourseClosureSide(lintelCourseAssembly.rightPlacements)}</div>
            {lintelCourseCutRequired ? (
              <div className="text-amber-700 dark:text-amber-300">Custom CMU cut required beside lintel.</div>
            ) : null}
          </div>
        </div>
      ) : null}
      <SelectField
        label="Wall face"
        value={opening.wallFace}
        onChange={(value) => onOpeningChange(opening.id, { wallFace: value as WallOpeningParameters['wallFace'] })}
        options={[
          { value: 'north', label: 'North' },
          { value: 'east', label: 'East' },
          { value: 'south', label: 'South' },
          { value: 'west', label: 'West' },
        ]}
      />
      <NumberField label="Position along wall" value={opening.offsetMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { offsetMeters: Math.max(0, value) })} />
      <NumberField label="Actual width" value={opening.widthMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { widthMeters: positiveOrFallback(value, opening.widthMeters) })} />
      <NumberField label="Actual height" value={opening.heightMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { heightMeters: positiveOrFallback(value, opening.heightMeters) })} />
      <NumberField label="Rough opening allowance" value={opening.roughOpeningAllowanceMeters ?? 0.05} suffix="m" step={0.005} onChange={(value) => onOpeningChange(opening.id, { roughOpeningAllowanceMeters: Math.max(0, value), roughOpeningWidthMeters: undefined, roughOpeningHeightMeters: undefined })} />
      <NumberField label="Rough opening width override" value={opening.roughOpeningWidthMeters ?? resolvedOpening.roughOpeningWidthMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { roughOpeningWidthMeters: positiveOrFallback(value, resolvedOpening.roughOpeningWidthMeters) })} />
      <NumberField label="Rough opening height override" value={opening.roughOpeningHeightMeters ?? resolvedOpening.roughOpeningHeightMeters} suffix="m" onChange={(value) => onOpeningChange(opening.id, { roughOpeningHeightMeters: positiveOrFallback(value, resolvedOpening.roughOpeningHeightMeters) })} />
      {opening.type === 'window' ? (
        <>
          <NumberField label="Sill height" value={opening.sillHeightMeters ?? 0} suffix="m" onChange={(value) => onOpeningChange(opening.id, { sillHeightMeters: Math.max(0, value) })} />
          <SelectField
            label="Sill condition"
            value={opening.sillCondition ?? 'none'}
            onChange={(value) => onOpeningChange(opening.id, { sillCondition: value as WallOpeningParameters['sillCondition'] })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'reinforced_sill', label: 'Reinforced sill' },
              { value: 'grouted_sill_course', label: 'Grouted sill course' },
            ]}
          />
        </>
      ) : (
        <DoorConfigurationControls
          swingType={opening.swingType ?? 'inswing'}
          swingDirection={opening.swingDirection ?? 'left'}
          onSwingTypeChange={(swingType) => onOpeningChange(opening.id, { swingType })}
          onSwingDirectionChange={(swingDirection) => onOpeningChange(opening.id, { swingDirection })}
        />
      )}
      <SelectField
        label="Lintel type"
        value={opening.lintelType ?? preset.wall.lintelType ?? 'bond_beam'}
        onChange={(value) => onOpeningChange(opening.id, { lintelType: value as WallOpeningParameters['lintelType'] })}
        options={[
          { value: 'bond_beam', label: 'Bond beam lintel' },
          { value: 'precast_concrete', label: 'Precast concrete' },
          { value: 'steel_placeholder', label: 'Steel placeholder' },
          { value: 'none', label: 'None' },
        ]}
      />
      <NumberField label="Lintel bearing" value={opening.lintelBearingMeters ?? preset.wall.lintelBearingMeters ?? 0.2} suffix="m" onChange={(value) => onOpeningChange(opening.id, { lintelBearingMeters: Math.max(0, value) })} />
      <NumberField label="Jamb cells each side" value={opening.groutCellsEachSide ?? preset.wall.jambCellsEachSide ?? 1} suffix="cells" step={1} onChange={(value) => onOpeningChange(opening.id, { groutCellsEachSide: Math.max(0, Math.round(value)) })} />
      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Jamb grout enabled</span>
        <input
          type="checkbox"
          checked={opening.jambGroutEnabled ?? true}
          onChange={(event) => onOpeningChange(opening.id, { jambGroutEnabled: event.currentTarget.checked })}
          className="h-4 w-4"
        />
      </label>
      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Jamb rebar enabled</span>
        <input
          type="checkbox"
          checked={opening.jambRebarEnabled ?? false}
          onChange={(event) => onOpeningChange(opening.id, { jambRebarEnabled: event.currentTarget.checked })}
          className="h-4 w-4"
        />
      </label>
      {opening.type === 'window' ? (
        <NumberField label="Grout cells below window" value={opening.groutCellsBelowWindow ?? 0} suffix="cells" step={1} onChange={(value) => onOpeningChange(opening.id, { groutCellsBelowWindow: Math.max(0, Math.round(value)) })} />
      ) : null}
      <TextField
        label="Notes"
        value={opening.notes ?? ''}
        onChange={(value) => onOpeningChange(opening.id, { notes: value })}
      />
    </div>
  );
}

function ModuleFitReportPanel({ report }: { report: ModuleFitReport }) {
  const toneClass =
    report.status === 'fully_modular' || report.status === 'bond_modular'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
      : report.status === 'cut_required' || report.status === 'opening_conflict'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100';
  return (
    <div className={`rounded-lg border p-2 text-xs ${toneClass}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold">Modular fit</span>
        <ModuleFitStatusBadge status={report.status} />
      </div>
      {report.summaryLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function ModuleFitStatusBadge({ status }: { status: ModuleFitStatus }) {
  const className =
    status === 'fully_modular' || status === 'bond_modular'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : status === 'cut_required' || status === 'opening_conflict'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
  const label =
    status === 'fully_modular'
      ? 'Fully modular'
      : status === 'bond_modular'
        ? 'Bond modular'
        : status === 'cut_required'
          ? 'Cut required'
          : status === 'opening_conflict'
            ? 'Opening conflict'
            : 'Unresolved';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function summarizeClosures(closures: ReturnType<typeof generateCmuLayout>['openingCourseClosures']): string {
  if (closures.length === 0) return 'none';
  const counts = closures.reduce<Record<string, number>>((acc, closure) => {
    acc[closure.closureType] = (acc[closure.closureType] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([type, count]) => `${type.replace(/_/g, ' ')} ${count}`)
    .join(', ');
}
