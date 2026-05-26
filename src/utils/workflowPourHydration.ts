import type { Project, Calculation } from '../types';
import type { PourPlannerFormState } from '../types/pourPlanner';
import { placementAreaFromCalculationType } from '../types/callSheet';
import { applyUSAddressToPourPlanner } from './addressForm';
import { applyPlacementOrderToForm } from './placementOrderForm';
import {
  formatCalculationSlabSize,
  getCalculationPsi,
} from './calculationDimensions';
import { isUSAddressGeocodable } from '../types/address';

/** Pre-fill pour planner from workflow project + latest calculation. */
export function hydratePourPlannerFromProject(
  project: Project,
  calculation?: Calculation,
): Partial<PourPlannerFormState> {
  const patch: Partial<PourPlannerFormState> = {
    projectId: project.id,
    projectName: project.name,
  };

  if (project.jobsiteAddress && isUSAddressGeocodable(project.jobsiteAddress)) {
    Object.assign(patch, applyUSAddressToPourPlanner({}, project.jobsiteAddress));
  }

  if (project.placementOrder) {
    Object.assign(patch, applyPlacementOrderToForm(project.placementOrder));
  }

  const labor = project.laborEstimates?.[0];
  if (labor?.inputs) {
    const li = labor.inputs;
    if (li.crewSize) patch.crewSize = li.crewSize;
    if (li.finishers) patch.finishers = li.finishers;
    if (li.manualVolume && !patch.calculationId) {
      patch.manualVolume = li.manualVolume;
    }
  }

  const calc = calculation ?? project.calculations?.[project.calculations.length - 1];
  if (calc) {
    patch.calculationId = calc.id;
    const psi = getCalculationPsi(calc);
    if (psi) patch.psi = psi;

    const slabSize = formatCalculationSlabSize(calc, 'feet');
    if (slabSize) patch.slabSize = slabSize;

    const areaType = placementAreaFromCalculationType(calc.type);
    if (areaType) patch.placementAreaType = areaType;

    const d = calc.dimensions;
    if (d?.thickness != null && Number(d.thickness) > 0) {
      patch.slabThicknessIn = String(Math.round(Number(d.thickness) * 12));
    } else if (d?.baseThickness != null && Number(d.baseThickness) > 0) {
      patch.slabThicknessIn = String(Math.round(Number(d.baseThickness) * 12));
    } else if (d?.base_thickness != null && Number(d.base_thickness) > 0) {
      patch.slabThicknessIn = String(Math.round(Number(d.base_thickness) * 12));
    }
  }

  return patch;
}
