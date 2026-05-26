import type { Project } from '../types';
import type { PlacementOrder } from '../types/placementOrder';
import { formatUSAddress, hasProjectJobsite } from '../types/address';

export function projectJobsiteLine(project?: Project | null): string {
  if (!project?.jobsiteAddress || !hasProjectJobsite(project.jobsiteAddress)) {
    return '';
  }
  return formatUSAddress(project.jobsiteAddress);
}

export function getSavedPlacementOrder(project?: Project | null): PlacementOrder | undefined {
  const order = project?.placementOrder;
  if (!order?.status) return undefined;
  return order;
}

export function hasSavedBatchPlant(project?: Project | null): boolean {
  const order = getSavedPlacementOrder(project);
  return Boolean(order?.batchPlantName?.trim() || order?.batchPlantAddress?.trim());
}

export function hasSavedBatchPlantContact(project?: Project | null): boolean {
  const order = getSavedPlacementOrder(project);
  const contact = order?.contact;
  return Boolean(
    contact?.phone?.trim() ||
      contact?.email?.trim() ||
      contact?.dispatchContact?.trim(),
  );
}
