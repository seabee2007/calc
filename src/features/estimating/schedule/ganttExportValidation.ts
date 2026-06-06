import type { PlannedEstimateSchedulePlan } from '../application/estimateScheduleDatePlanner';
import {
  backfillActivityCodesForDomainTasks,
  compareActivityCodes,
} from '../application/estimateActivityCoding';
import type { EstimateSettings } from '../domain/estimateTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { hasPlannedGanttTasks } from '../ui/estimateGanttDisplay';
import {
  buildGanttSchedule,
  type BuildGanttScheduleResult,
} from './buildGanttSchedule';

export const DUPLICATE_GANTT_CODES_MESSAGE =
  'Duplicate activity codes found. Fix codes before exporting Gantt.';

export const GANTT_EXPORT_DISABLED_TOOLTIP =
  'Add estimate activities before exporting Gantt.';

export function isScheduleEnabledGanttTask(task: EstimateDomainTask): boolean {
  if (task.scheduleEnabled === false) return false;
  const lineType = task.lineType;
  return lineType === 'task' || lineType == null;
}

export function filterScheduleEnabledGanttTasks(
  lineItems: EstimateDomainTask[],
): EstimateDomainTask[] {
  return lineItems.filter(isScheduleEnabledGanttTask);
}

export function indexDomainTaskActivityCodes(tasks: EstimateDomainTask[]): {
  duplicates: string[];
} {
  const seen = new Map<string, number>();

  for (const task of tasks) {
    const code = task.activityCode?.trim();
    if (!code) continue;
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }

  const duplicates = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code)
    .sort((left, right) => compareActivityCodes(left, right));

  return { duplicates };
}

export function hasScheduleEnabledGanttActivities(lineItems: EstimateDomainTask[]): boolean {
  return filterScheduleEnabledGanttTasks(lineItems).length > 0;
}

export function isGanttExportReady(input: {
  lineItems: EstimateDomainTask[];
  plannedPlan: PlannedEstimateSchedulePlan | null;
}): boolean {
  return (
    hasPlannedGanttTasks(input.plannedPlan) &&
    hasScheduleEnabledGanttActivities(input.lineItems)
  );
}

export interface PrepareGanttExportParams {
  lineItems: EstimateDomainTask[];
  projectStartDate: string;
  hoursPerDay?: number;
  includeWeekends?: boolean;
  estimateSettings?: EstimateSettings;
}

export type PrepareGanttExportResult =
  | { ok: true; schedule: BuildGanttScheduleResult }
  | {
      ok: false;
      error: 'duplicate_codes' | 'no_activities';
      message: string;
      duplicates?: string[];
    };

export function prepareGanttExport(
  params: PrepareGanttExportParams,
): PrepareGanttExportResult {
  const scheduleTasks = filterScheduleEnabledGanttTasks(params.lineItems);

  if (scheduleTasks.length === 0) {
    return {
      ok: false,
      error: 'no_activities',
      message: GANTT_EXPORT_DISABLED_TOOLTIP,
    };
  }

  const backfilled = backfillActivityCodesForDomainTasks(scheduleTasks);
  const { duplicates } = indexDomainTaskActivityCodes(backfilled);

  if (duplicates.length > 0) {
    return {
      ok: false,
      error: 'duplicate_codes',
      message: DUPLICATE_GANTT_CODES_MESSAGE,
      duplicates,
    };
  }

  const schedule = buildGanttSchedule({
    lineItems: backfilled,
    projectStartDate: params.projectStartDate,
    hoursPerDay: params.hoursPerDay,
    includeWeekends: params.includeWeekends,
    estimateSettings: params.estimateSettings,
  });

  return { ok: true, schedule };
}
