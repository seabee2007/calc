import {
  calculateSepticCapacity,
  generateSepticTakeoff,
  SEPTIC_CONCEPTUAL_NOTE,
  SEPTIC_FIXTURE_CONTEXT_GUARDRAIL,
  validateSepticTank,
  type SepticCodeProfileId,
  type SepticTankModel,
  type SepticTankSide,
} from '../plumbing';
import type { PlumbingNode } from '../plumbing';
import {
  NumberField,
  SelectField,
  TextField,
} from './DesignBuilderFormFields';

type DesignBuilderSepticTankControlsProps = {
  tank: SepticTankModel | null;
  nodes: readonly PlumbingNode[];
  onTankChange: (tankId: string, patch: Partial<SepticTankModel>) => void;
  onPlacementChange: (tankId: string, patch: Partial<SepticTankModel['placement']>) => void;
  onDesignBasisChange: (tankId: string, patch: Partial<SepticTankModel['designBasis']>) => void;
  onGeometryChange: (tankId: string, patch: Partial<SepticTankModel['geometry']>) => void;
};

const profileOptions: Array<{ value: SepticCodeProfileId; label: string }> = [
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'guam_22_gar_ch12', label: 'Guam 22 GAR Ch.12' },
  { value: 'custom', label: 'Custom' },
];

const sideOptions: Array<{ value: SepticTankSide; label: string }> = [
  { value: 'west', label: 'West' },
  { value: 'east', label: 'East' },
  { value: 'north', label: 'North' },
  { value: 'south', label: 'South' },
];

export function DesignBuilderSepticTankControls({
  tank,
  nodes,
  onTankChange,
  onPlacementChange,
  onDesignBasisChange,
  onGeometryChange,
}: DesignBuilderSepticTankControlsProps) {
  if (!tank) {
    return (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>Select a CMU septic tank from the plumbing plan to edit site utility properties.</p>
      </div>
    );
  }

  const capacity = calculateSepticCapacity(tank);
  const issues = validateSepticTank(tank, { nodes });
  const takeoff = generateSepticTakeoff(tank);

  const setBurialDepth = (burialDepthBelowGradeM: number) => {
    onPlacementChange(tank.id, {
      burialDepthBelowGradeM,
      topSlabTopElevationM: tank.placement.gradeElevationM - burialDepthBelowGradeM,
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <p>{SEPTIC_CONCEPTUAL_NOTE}</p>
        <p className="mt-2 font-semibold">{SEPTIC_FIXTURE_CONTEXT_GUARDRAIL}</p>
      </div>

      <TextField label="Name" value={tank.name} onChange={(name) => onTankChange(tank.id, { name })} />
      <TextField label="Mark" value={tank.mark} onChange={(mark) => onTankChange(tank.id, { mark })} />
      <SelectField
        label="Code/Profile"
        value={tank.designBasis.codeProfileId}
        options={profileOptions}
        onChange={(codeProfileId) =>
          onDesignBasisChange(tank.id, { codeProfileId: codeProfileId as SepticCodeProfileId })
        }
      />
      <SelectField
        label="Capacity preset"
        value="small_house_750_gal"
        options={[{ value: 'small_house_750_gal', label: 'Small house CMU septic tank - 750 gal conceptual' }]}
        onChange={() => undefined}
      />

      <NumberField label="Bedrooms assumed" value={tank.designBasis.bedroomsAssumed} suffix="BR" min={0} onChange={(bedroomsAssumed) => onDesignBasisChange(tank.id, { bedroomsAssumed: Math.round(bedroomsAssumed) })} />
      <NumberField label="Design flow" value={tank.designBasis.designFlowGpd} suffix="GPD" min={0} onChange={(designFlowGpd) => onDesignBasisChange(tank.id, { designFlowGpd })} />
      <NumberField label="Capacity gallons" value={tank.designBasis.capacityGallons} suffix="gal" min={0} onChange={(capacityGallons) => onDesignBasisChange(tank.id, { capacityGallons })} />
      <NumberField label="Capacity" value={tank.designBasis.capacityM3} suffix="m3" min={0} onChange={(capacityM3) => onDesignBasisChange(tank.id, { capacityM3 })} />

      <NumberField label="Inside length" value={tank.geometry.insideLengthM} suffix="m" min={0.1} onChange={(insideLengthM) => onGeometryChange(tank.id, { insideLengthM })} />
      <NumberField label="Inside width" value={tank.geometry.insideWidthM} suffix="m" min={0.1} onChange={(insideWidthM) => onGeometryChange(tank.id, { insideWidthM })} />
      <NumberField label="Inside total depth" value={tank.geometry.insideTotalDepthM} suffix="m" min={0.1} onChange={(insideTotalDepthM) => onGeometryChange(tank.id, { insideTotalDepthM })} />
      <NumberField label="Liquid depth" value={tank.geometry.liquidDepthM} suffix="m" min={0.1} onChange={(liquidDepthM) => onGeometryChange(tank.id, { liquidDepthM })} />
      <NumberField label="Burial depth below grade" value={tank.placement.burialDepthBelowGradeM} suffix="m" min={0} onChange={setBurialDepth} />
      <NumberField label="Top slab elevation" value={tank.placement.topSlabTopElevationM} suffix="m" min={-20} onChange={(topSlabTopElevationM) => onPlacementChange(tank.id, { topSlabTopElevationM, burialDepthBelowGradeM: tank.placement.gradeElevationM - topSlabTopElevationM })} />
      <NumberField label="Wall thickness" value={tank.geometry.wallThicknessM} suffix="m" min={0.01} onChange={(wallThicknessM) => onGeometryChange(tank.id, { wallThicknessM })} />
      <NumberField label="Top slab thickness" value={tank.geometry.topSlabThicknessM} suffix="m" min={0.01} onChange={(topSlabThicknessM) => onGeometryChange(tank.id, { topSlabThicknessM })} />
      <NumberField label="Bottom slab thickness" value={tank.geometry.bottomSlabThicknessM} suffix="m" min={0.01} onChange={(bottomSlabThicknessM) => onGeometryChange(tank.id, { bottomSlabThicknessM })} />
      <SelectField label="Inlet side" value={tank.inletSide} options={sideOptions} onChange={(inletSide) => onTankChange(tank.id, { inletSide: inletSide as SepticTankSide })} />
      <SelectField label="Outlet side" value={tank.outletSide} options={sideOptions} onChange={(outletSide) => onTankChange(tank.id, { outletSide: outletSide as SepticTankSide })} />

      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Show cutaway</span>
        <input type="checkbox" checked={tank.showCutaway3d} onChange={(event) => onTankChange(tank.id, { showCutaway3d: event.currentTarget.checked })} className="h-4 w-4" />
      </label>
      <label className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
        <span>Show label</span>
        <input type="checkbox" checked={tank.labelVisible} onChange={(event) => onTankChange(tank.id, { labelVisible: event.currentTarget.checked })} className="h-4 w-4" />
      </label>

      <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
        Calculated liquid volume: {capacity.liquidVolumeGallons.toFixed(0)} gal / {capacity.liquidVolumeM3.toFixed(2)} m3.
      </div>
      <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
        Takeoff: {takeoff.estimated8InCmuBlockCount} CMU blocks, {takeoff.bottomSlabConcreteVolumeM3.toFixed(2)} m3 bottom slab concrete, {takeoff.topSlabConcreteVolumeM3.toFixed(2)} m3 top slab concrete.
      </div>
      {issues.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {issues.map((issue) => (
            <div key={`${issue.code}-${issue.message}`}>
              <span className="font-semibold uppercase">{issue.severity}</span>: {issue.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

