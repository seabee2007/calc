import type { Project, Calculation } from '../types';
import type { PourPlannerFormState } from '../types/pourPlanner';
import { applyUSAddressToPourPlanner } from './addressForm';
import { applyPlacementOrderToForm } from './placementOrderForm';
import { getCalculationPsi } from './calculationDimensions';
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

  const calc = calculation ?? project.calculations?.[project.calculations.length - 1];
  if (calc) {
    patch.calculationId = calc.id;
    const psi = getCalculationPsi(calc);
    if (psi) patch.psi = psi;
  }

  return patch;
}
