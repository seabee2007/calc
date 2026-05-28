import type { Calculation } from '../types';
import type { MixDesignApproval } from '../types/mixDesignApproval';
import { formatCalculationSlabSize } from './calculationDimensions';

const PLACEMENT_TYPE_LABELS: Record<string, string> = {
  slab: 'Slab',
  sidewalk: 'Sidewalk',
  thickened_edge_slab: 'Thickened-edge slab',
  footer: 'Footing',
  column: 'Column',
  wall: 'Wall',
  stairs: 'Stairs',
  curb: 'Curb',
};

/** Concrete takeoffs that require a mix design (volume > 0). */
export function getPlacementCalculations(project: {
  calculations?: Calculation[];
}): Calculation[] {
  const calcs = project.calculations ?? [];
  return [...calcs]
    .filter((c) => (c.result?.volume ?? 0) > 0)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

export function isMixDesignApproved(calculation: Calculation): boolean {
  return Boolean(calculation.mixDesignApproval?.approvedAt);
}

export function getPendingMixDesignCalculations(project: {
  calculations?: Calculation[];
}): Calculation[] {
  return getPlacementCalculations(project).filter((c) => !isMixDesignApproved(c));
}

export function getMixDesignApprovalCounts(project: {
  calculations?: Calculation[];
}): { total: number; approved: number; pending: number } {
  const placements = getPlacementCalculations(project);
  const approved = placements.filter(isMixDesignApproved).length;
  return {
    total: placements.length,
    approved,
    pending: placements.length - approved,
  };
}

export function formatPlacementCalculationLabel(
  calculation: Calculation,
  index: number,
): string {
  const vol = calculation.result?.volume ?? 0;
  const typeLabel =
    PLACEMENT_TYPE_LABELS[calculation.type] ??
    calculation.type.replace(/_/g, ' ');
  const size = formatCalculationSlabSize(calculation);
  const volStr = vol > 0 ? `${vol.toFixed(1)} CY` : '';
  const parts = [typeLabel];
  if (size) parts.push(size);
  if (volStr) parts.push(volStr);
  if (parts.length === 1) return `${typeLabel} #${index + 1}`;
  return parts.join(' · ');
}

export function mixApprovalSummary(
  approval: MixDesignApproval | undefined,
): string {
  if (!approval) return '';
  return `${approval.selectedPsi} PSI · ${approval.complianceStatus}`;
}
