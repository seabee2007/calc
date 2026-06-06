import { backfillActivityCodesForDomainTasks } from '../../application/estimateActivityCoding';
import { extractScheduleLaborPlan } from '../../application/extractScheduleLaborPlan';
import { computeTaskRollupSlice } from '../../application/estimateGroupRollups';
import type { EstimateSettings } from '../../domain/estimateTypes';
import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import type { CpmRelationshipType } from '../cpmTypes';

export interface ScheduleActivity {
  activityCode: string;
  activityDescription: string;
  divisionCode: string;
  divisionName: string;
  workPackageCode?: string;
  workPackageName?: string;
  durationDays: number;
  laborHours: number;
  manDays: number;
  crewDays: number;
  crewSize: number;
  totalCost: number;
  predecessorActivityCode?: string;
  relationshipType: CpmRelationshipType;
  lagDays: number;
}

export interface ScheduleActivityAdapterWarning {
  activityCode: string;
  message: string;
}

export interface ScheduleActivityAdapterResult {
  activities: ScheduleActivity[];
  warnings: ScheduleActivityAdapterWarning[];
}

function isScheduleEnabledTask(task: EstimateDomainTask): boolean {
  if (task.scheduleEnabled === false) return false;
  return task.lineType === 'task' || task.lineType == null;
}

function normalizeRelType(value: unknown): CpmRelationshipType {
  if (value === 'SS' || value === 'FF' || value === 'SF') return value;
  return 'FS';
}

export function estimateLineItemsToScheduleActivities(
  lineItems: EstimateDomainTask[],
  estimateSettings?: Pick<EstimateSettings, 'defaultCrewSize' | 'hoursPerDay'>,
): ScheduleActivityAdapterResult {
  const warnings: ScheduleActivityAdapterWarning[] = [];

  const enabled = lineItems.filter(isScheduleEnabledTask);
  const backfilled = backfillActivityCodesForDomainTasks(enabled);

  const activities: ScheduleActivity[] = backfilled.map((task) => {
    // Guard against missing calculatedValues (e.g., tasks that haven't been evaluated yet)
    const hasCv = task.calculatedValues != null;
    const extraction = hasCv ? extractScheduleLaborPlan(task) : null;
    const rollup = hasCv ? computeTaskRollupSlice(task) : null;

    const extractedDuration = extraction?.labor.durationDays ?? 0;
    const lineItemDuration =
      typeof task.lineItem?.durationDays === 'number' ? task.lineItem.durationDays : 0;
    const fallbackCrewDays =
      typeof task.lineItem?.crewDays === 'number' ? task.lineItem.crewDays : 0;
    const fallbackManDays =
      typeof task.lineItem?.manDays === 'number' ? task.lineItem.manDays : 0;

    const durationDays =
      extractedDuration >= 1
        ? extractedDuration
        : lineItemDuration >= 1
          ? lineItemDuration
          : Math.ceil(
              (extraction?.labor.crewDays ?? fallbackCrewDays) ||
              (extraction?.labor.manDays ?? fallbackManDays) ||
              1,
            );

    const extractedCrew = extraction?.labor.crewSize ?? 0;
    const lineItemCrew =
      typeof task.lineItem?.crewSize === 'number' ? task.lineItem.crewSize : 0;

    const crewSize =
      extractedCrew > 0
        ? extractedCrew
        : lineItemCrew > 0
          ? lineItemCrew
          : (estimateSettings?.defaultCrewSize ?? 1);

    const activityCode = task.activityCode?.trim() ?? '';

    if (durationDays < 1) {
      warnings.push({
        activityCode,
        message: `Activity "${task.title}" has missing or invalid duration.`,
      });
    }

    if (crewSize < 1) {
      warnings.push({
        activityCode,
        message: `Activity "${task.title}" is missing crew size.`,
      });
    }

    return {
      activityCode,
      activityDescription: task.title?.trim() || task.description?.trim() || activityCode,
      divisionCode: task.divisionCode?.trim() || task.lineItem.csiDivision?.trim() || '00',
      divisionName: task.divisionName?.trim() || task.lineItem.csiDivision?.trim() || '',
      workPackageCode: task.workPackageCode?.trim() || undefined,
      workPackageName: task.workPackageName?.trim() || task.scopeName?.trim() || undefined,
      durationDays: Math.max(1, Math.ceil(durationDays)),
      laborHours:
        extraction?.labor.adjustedLaborHours ||
        extraction?.labor.laborHours ||
        (typeof task.lineItem?.laborHours === 'number' ? task.lineItem.laborHours : 0),
      manDays:
        extraction?.labor.manDays ??
        (typeof task.lineItem?.manDays === 'number' ? task.lineItem.manDays : 0),
      crewDays:
        extraction?.labor.crewDays ??
        (typeof task.lineItem?.crewDays === 'number' ? task.lineItem.crewDays : 0),
      crewSize: Math.max(1, Math.ceil(crewSize)),
      totalCost: rollup?.directCost ?? 0,
      predecessorActivityCode: task.predecessorActivityCode?.trim() || undefined,
      relationshipType: normalizeRelType(task.relationshipType),
      lagDays: Math.max(0, task.lagDays ?? 0),
    };
  });

  return { activities, warnings };
}
