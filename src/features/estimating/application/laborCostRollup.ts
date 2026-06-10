import { roundToTwo } from '../domain/estimateMath';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { emptyGroupRollup, type EstimateGroupRollup } from '../domain/estimateLineItemTree';

export interface ConstructionActivityRollupSlice {
  laborHours: number;
  manDays: number;
  durationDays: number;
  laborCost: number;
  directCost: number;
  materialCost: number;
  equipmentCost: number;
  scheduleEnabled: boolean;
}

export function computeConstructionLineItemRollupSlice(
  item: ProjectActivityLineItem,
): Pick<ConstructionActivityRollupSlice, 'laborHours' | 'laborCost' | 'materialCost' | 'equipmentCost' | 'directCost'> {
  const laborCost = item.laborCost ?? 0;
  const materialCost = item.materialCost ?? 0;
  const equipmentCost = item.equipmentCost ?? 0;
  return {
    laborHours: item.calculatedManHours ?? 0,
    laborCost,
    materialCost,
    equipmentCost,
    directCost: laborCost + materialCost + equipmentCost,
  };
}

export function computeConstructionActivityRollupSlice(
  activity: ProjectConstructionActivity,
  lineItems: ProjectActivityLineItem[],
): ConstructionActivityRollupSlice {
  const itemSlices = lineItems.map(computeConstructionLineItemRollupSlice);
  const laborHours = itemSlices.reduce((sum, slice) => sum + slice.laborHours, 0);
  const laborCost = itemSlices.reduce((sum, slice) => sum + slice.laborCost, 0);
  const materialCost = itemSlices.reduce((sum, slice) => sum + slice.materialCost, 0);
  const equipmentCost = itemSlices.reduce((sum, slice) => sum + slice.equipmentCost, 0);
  const directCost = itemSlices.reduce((sum, slice) => sum + slice.directCost, 0);
  const hoursPerDay = activity.hoursPerDay > 0 ? activity.hoursPerDay : 8;

  return {
    laborHours: roundToTwo(laborHours),
    manDays: roundToTwo(laborHours / hoursPerDay),
    durationDays: activity.effectiveDurationDays ?? activity.calculatedDurationDays ?? 0,
    laborCost: roundToTwo(laborCost),
    directCost: roundToTwo(directCost),
    materialCost: roundToTwo(materialCost),
    equipmentCost: roundToTwo(equipmentCost),
    scheduleEnabled: activity.scheduleEnabled === true,
  };
}

function addConstructionSlice(target: EstimateGroupRollup, slice: ConstructionActivityRollupSlice): void {
  target.itemCount += 1;
  target.laborHours = roundToTwo(target.laborHours + slice.laborHours);
  target.manDays = roundToTwo(target.manDays + slice.manDays);
  target.durationDays = roundToTwo(target.durationDays + slice.durationDays);
  target.laborCost = roundToTwo(target.laborCost + slice.laborCost);
  target.directCost = roundToTwo(target.directCost + slice.directCost);
  target.materialCost = roundToTwo(target.materialCost + slice.materialCost);
  target.equipmentCost = roundToTwo(target.equipmentCost + slice.equipmentCost);
  if (slice.scheduleEnabled) target.scheduleEnabledCount += 1;
}

export function rollupConstructionActivities(
  loaded: Array<{ activity: ProjectConstructionActivity; lineItems: ProjectActivityLineItem[] }>,
): EstimateGroupRollup {
  const rollup = emptyGroupRollup();
  for (const entry of loaded) {
    addConstructionSlice(
      rollup,
      computeConstructionActivityRollupSlice(entry.activity, entry.lineItems),
    );
  }
  return rollup;
}

export function rollupConstructionActivityLineItems(
  lineItems: ProjectActivityLineItem[],
): Pick<EstimateGroupRollup, 'laborCost' | 'directCost' | 'laborHours' | 'materialCost' | 'equipmentCost'> {
  const rollup = emptyGroupRollup();
  for (const item of lineItems) {
    const slice = computeConstructionLineItemRollupSlice(item);
    rollup.laborHours = roundToTwo(rollup.laborHours + slice.laborHours);
    rollup.laborCost = roundToTwo(rollup.laborCost + slice.laborCost);
    rollup.materialCost = roundToTwo(rollup.materialCost + slice.materialCost);
    rollup.equipmentCost = roundToTwo(rollup.equipmentCost + slice.equipmentCost);
    rollup.directCost = roundToTwo(rollup.directCost + slice.directCost);
  }
  return rollup;
}
