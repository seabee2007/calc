import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { Project } from '../types';
import type { ProjectCustomEstimates } from '../types/projectEstimate';
import { EMPTY_PROJECT_CUSTOM_ESTIMATES } from '../types/projectEstimate';
import { normalizeLineItems } from './changeOrderFinancials';
export const GENERAL_TRADE_LABOR_ESTIMATE_SOURCE = 'general_trade_labor' as const;
export const CUSTOM_ESTIMATE_SOURCE = 'custom_estimate' as const;

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
export function isGeneralTradeLaborLine(item: ChangeOrderLineItem): boolean {
  return item.source === GENERAL_TRADE_LABOR_ESTIMATE_SOURCE;
}

export function sumCustomEstimateTotal(project: Project | null | undefined): number {
  const e = project?.customEstimates;
  if (!e) return 0;
  return (
    sumCategory(e.laborItems) + sumCategory(e.materialItems) + sumCategory(e.equipmentItems)
  );
}
export function projectHasGeneralTradeLaborEstimate(
  project: Project | null | undefined,
): boolean {
  return (project?.customEstimates?.laborItems ?? []).some(
    (item) => isGeneralTradeLaborLine(item) && (item.amount ?? 0) > 0,
  );
}

export function projectHasManualCustomEstimate(project: Project | null | undefined): boolean {
  const e = project?.customEstimates;
  if (!e) return false;
  return (
    e.laborItems.some((item) => !isGeneralTradeLaborLine(item) && (item.amount ?? 0) > 0) ||
    e.materialItems.some((item) => (item.amount ?? 0) > 0) ||
    e.equipmentItems.some((item) => (item.amount ?? 0) > 0)
  );
}

export function projectHasCustomEstimate(project: Project | null | undefined): boolean {
  return sumCustomEstimateTotal(project) > 0;
}

function projectConcreteVolumeYd(project: Project | null | undefined): number {
  if (!project) return 0;
  return (project.calculations ?? []).reduce(
    (sum, c) => sum + (c.result?.volume > 0 ? c.result.volume : 0),
    0,
  );
}
export function projectHasConcreteEstimate(project: Project | null | undefined): boolean {
  if (!project) return false;
  return (project.calculations ?? []).some(
    (c) => (c.result?.volume ?? 0) > 0 || (c.result?.pricing?.concreteCost ?? 0) > 0,
  );
}

export function projectHasReinforcementEstimate(project: Project | null | undefined): boolean {
  const sets = project?.reinforcements ?? [];
  if (sets.length === 0) return false;
  return sets.some((r) => {
    if ((r.pricing?.estimatedCost ?? 0) > 0) return true;
    if (r.reinforcement_type === 'fiber') {
      return (r.fiber_total_lb ?? 0) > 0 || (r.fiber_bags ?? 0) > 0;
    }
    if (r.reinforcement_type === 'mesh') {
      return (r.mesh_sheets ?? 0) > 0;
    }
    return (r.total_bars ?? 0) > 0 || (r.total_linear_ft ?? 0) > 0;
  });
}

export function projectHasConcreteLaborEstimate(project: Project | null | undefined): boolean {
  return (
    (project?.laborEstimates?.[0]?.laborCost ?? 0) > 0 ||
    (project?.placementOrder?.production?.laborCost ?? 0) > 0
  );
}

/** True when any estimate source is saved (concrete, rebar, labor, or custom lines). */
export function projectHasSavedEstimates(project: Project | null | undefined): boolean {
  if (!project) return false;
  if (projectHasConcreteEstimate(project) || projectConcreteVolumeYd(project) > 0) return true;
  if ((project.calculations?.length ?? 0) > 0) return true;
  if (projectHasConcreteLaborEstimate(project)) return true;
  if (projectHasReinforcementEstimate(project)) return true;
  if (projectHasCustomEstimate(project)) return true;
  return false;
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
