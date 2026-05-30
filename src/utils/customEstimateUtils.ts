import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { Project } from '../types';
import type { ProjectCustomEstimates } from '../types/projectEstimate';
import { EMPTY_PROJECT_CUSTOM_ESTIMATES } from '../types/projectEstimate';
import { normalizeLineItems } from './changeOrderFinancials';

export function parseCustomEstimatesFromDb(raw: unknown): ProjectCustomEstimates {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PROJECT_CUSTOM_ESTIMATES };
  const r = raw as Record<string, unknown>;
  return {
    laborItems: normalizeLineItems(
      Array.isArray(r.laborItems) ? (r.laborItems as ChangeOrderLineItem[]) : [],
      'labor',
    ),
    materialItems: normalizeLineItems(
      Array.isArray(r.materialItems) ? (r.materialItems as ChangeOrderLineItem[]) : [],
      'material',
    ),
    equipmentItems: normalizeLineItems(
      Array.isArray(r.equipmentItems) ? (r.equipmentItems as ChangeOrderLineItem[]) : [],
      'equipment',
    ),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
  };
}

export function customEstimatesToDbPayload(estimates: ProjectCustomEstimates): Record<string, unknown> {
  return {
    laborItems: estimates.laborItems,
    materialItems: estimates.materialItems,
    equipmentItems: estimates.equipmentItems,
    updatedAt: estimates.updatedAt ?? new Date().toISOString(),
  };
}

function sumCategory(items: ChangeOrderLineItem[]): number {
  return items.reduce((s, row) => s + (Number(row.amount) || 0), 0);
}

export function sumCustomEstimateTotal(project: Project | null | undefined): number {
  const e = project?.customEstimates;
  if (!e) return 0;
  return (
    sumCategory(e.laborItems) + sumCategory(e.materialItems) + sumCategory(e.equipmentItems)
  );
}

export function projectHasCustomEstimate(project: Project | null | undefined): boolean {
  return sumCustomEstimateTotal(project) > 0;
}

export function totalsFromCustomEstimateItems(
  items: Pick<ProjectCustomEstimates, 'laborItems' | 'materialItems' | 'equipmentItems'>,
): { labor: number; material: number; equipment: number; total: number } {
  const labor = sumCategory(items.laborItems);
  const material = sumCategory(items.materialItems);
  const equipment = sumCategory(items.equipmentItems);
  return { labor, material, equipment, total: labor + material + equipment };
}

export function customEstimateCategoryTotals(project: Project | null | undefined): {
  labor: number;
  material: number;
  equipment: number;
  total: number;
} {
  const e = project?.customEstimates;
  if (!e) return { labor: 0, material: 0, equipment: 0, total: 0 };
  return totalsFromCustomEstimateItems(e);
}
