import { getConstructionActivityWarnings } from '../domain/constructionActivityCalculations';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';

export interface ActivityReadiness {
  activityId: string;
  isConfirmed: boolean;
  hasQuantity: boolean;
  hasLaborPriced: boolean;
  hasMaterialOrEquipment: boolean;
  hasNoWarnings: boolean;
  score: number;
  dimensionCount: number;
}

export interface DivisionReadiness {
  divisionCode: string;
  divisionName: string;
  activityCount: number;
  score: number;
}

export interface EstimateReadinessSummary {
  overallScore: number;
  totalActivities: number;
  readyForReview: number;
  needsQuantity: number;
  needsPricing: number;
  openFlags: number;
  divisions: DivisionReadiness[];
}

const DIMENSION_COUNT = 5;
const POINTS_PER_DIMENSION = 100 / DIMENSION_COUNT;

export function computeActivityReadiness(
  activity: ProjectConstructionActivity,
  lineItems: ProjectActivityLineItem[],
  materials: ActivityMaterialResource[],
  equipment: ActivityEquipmentResource[],
): ActivityReadiness {
  const isConfirmed = true;
  const hasQuantity = lineItems.some((item) => (item.quantity ?? 0) > 0);
  const hasLaborPriced = lineItems.some((item) => (item.laborCost ?? 0) > 0);
  const hasMaterialOrEquipment =
    materials.length > 0 ||
    equipment.length > 0 ||
    (activity.totalMaterialCost ?? 0) > 0 ||
    (activity.totalEquipmentCost ?? 0) > 0;
  const hasNoWarnings = getConstructionActivityWarnings(activity, lineItems).length === 0;

  const dimensions = [
    isConfirmed,
    hasQuantity,
    hasLaborPriced,
    hasMaterialOrEquipment,
    hasNoWarnings,
  ];
  const score = Math.round(dimensions.filter(Boolean).length * POINTS_PER_DIMENSION);

  return {
    activityId: activity.id,
    isConfirmed,
    hasQuantity,
    hasLaborPriced,
    hasMaterialOrEquipment,
    hasNoWarnings,
    score,
    dimensionCount: DIMENSION_COUNT,
  };
}

export function computeEstimateReadiness(
  activities: ProjectConstructionActivity[],
  lineItemsMap: Map<string, ProjectActivityLineItem[]>,
  materialsMap: Map<string, ActivityMaterialResource[]>,
  equipmentMap: Map<string, ActivityEquipmentResource[]>,
): EstimateReadinessSummary {
  if (activities.length === 0) {
    return {
      overallScore: 0,
      totalActivities: 0,
      readyForReview: 0,
      needsQuantity: 0,
      needsPricing: 0,
      openFlags: 0,
      divisions: [],
    };
  }

  const activityReadiness = activities.map((activity) =>
    computeActivityReadiness(
      activity,
      lineItemsMap.get(activity.id) ?? [],
      materialsMap.get(activity.id) ?? [],
      equipmentMap.get(activity.id) ?? [],
    ),
  );

  const divisionMap = new Map<string, { divisionName: string; scores: number[] }>();
  for (const activity of activities) {
    const code = activity.divisionCode;
    if (!divisionMap.has(code)) {
      divisionMap.set(code, { divisionName: activity.divisionName, scores: [] });
    }
    const readiness = activityReadiness.find((item) => item.activityId === activity.id);
    divisionMap.get(code)!.scores.push(readiness?.score ?? 0);
  }

  const divisions: DivisionReadiness[] = Array.from(divisionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([divisionCode, value]) => ({
      divisionCode,
      divisionName: value.divisionName,
      activityCount: value.scores.length,
      score: Math.round(
        value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length,
      ),
    }));

  const overallScore = Math.round(
    activityReadiness.reduce((sum, item) => sum + item.score, 0) / activityReadiness.length,
  );

  return {
    overallScore,
    totalActivities: activities.length,
    readyForReview: activityReadiness.filter((item) => item.score >= 80).length,
    needsQuantity: activityReadiness.filter((item) => !item.hasQuantity).length,
    needsPricing: activityReadiness.filter((item) => !item.hasLaborPriced).length,
    openFlags: activityReadiness.filter((item) => !item.hasNoWarnings).length,
    divisions,
  };
}

export const READINESS_NOTE =
  'Readiness is based on confirmed activities. Adding new scope may lower readiness until the new work is quantified and priced.';
