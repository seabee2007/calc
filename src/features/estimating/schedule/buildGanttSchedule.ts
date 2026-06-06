import {
  compareActivityCodes,
  normalizeRelationshipType,
} from '../application/estimateActivityCoding';
import { computeTaskRollupSlice } from '../application/estimateGroupRollups';
import { extractScheduleLaborPlan } from '../application/extractScheduleLaborPlan';
import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import { getCsiDivisionByCode, normalizeCsiDivisionCode } from '../domain/csiDivisions';
import type { EstimateRelationshipType, EstimateSettings } from '../domain/estimateTypes';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import {
  addInclusiveDuration,
  countInclusiveSpanDays,
  resolveDurationDays,
  snapToWorkingDay,
  startFromInclusiveFinish,
  type GanttScheduleDateOptions,
  type PlannedDateRange,
} from './ganttScheduleDateUtils';

export type GanttRelationshipType = EstimateRelationshipType;

export interface GanttActivity {
  activityCode: string;
  title: string;
  divisionCode: string;
  divisionName: string;
  workPackageCode?: string;
  workPackageName?: string;
  durationDays: number;
  plannedStart: string;
  plannedFinish: string;
  predecessorActivityCode?: string;
  relationshipType: GanttRelationshipType;
  lagDays: number;
  crewSize?: number;
  laborHours?: number;
  manDays?: number;
  crewDays?: number;
  totalCost?: number;
  notes?: string;
}

export interface LogicLink {
  predecessorActivityCode: string;
  predecessorTitle: string;
  successorActivityCode: string;
  successorTitle: string;
  relationshipType: GanttRelationshipType;
  lagDays: number;
}

export interface BuildGanttScheduleParams {
  lineItems: EstimateDomainTask[];
  projectStartDate: string;
  hoursPerDay?: number;
  includeWeekends?: boolean;
  estimateSettings?: EstimateSettings;
}

export interface BuildGanttScheduleResult {
  activities: GanttActivity[];
  logicLinks: LogicLink[];
  plannedDurationDays: number;
  warnings: string[];
}

interface ActivityDraft {
  task: EstimateDomainTask;
  activityCode: string;
  title: string;
  divisionCode: string;
  divisionName: string;
  workPackageCode?: string;
  workPackageName?: string;
  durationDays: number;
  predecessorActivityCode?: string;
  relationshipType: GanttRelationshipType;
  lagDays: number;
  crewSize?: number;
  laborHours?: number;
  manDays?: number;
  crewDays?: number;
  totalCost?: number;
  notes?: string;
}

function parseImportedNotes(task: EstimateDomainTask): string | undefined {
  const imported = task.calculatedValues.importedEstimate;
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
    return task.description?.trim() || undefined;
  }
  const notes = (imported as Record<string, unknown>).notes;
  if (typeof notes === 'string' && notes.trim()) return notes.trim();
  return task.description?.trim() || undefined;
}

function resolveDivisionCode(task: EstimateDomainTask, activityCode: string): string {
  if (task.divisionCode?.trim()) {
    return normalizeCsiDivisionCode(task.divisionCode);
  }
  const fromLine = task.lineItem.csiDivision?.trim();
  if (fromLine) return normalizeCsiDivisionCode(fromLine);
  const parsed = activityCode.split('-')[0];
  return parsed ? normalizeCsiDivisionCode(parsed) : '00';
}

function resolveDivisionName(task: EstimateDomainTask, divisionCode: string): string {
  if (task.divisionName?.trim()) return task.divisionName.trim();
  return getCsiDivisionByCode(divisionCode)?.name ?? divisionCode;
}

function buildActivityDraft(task: EstimateDomainTask): ActivityDraft | null {
  const activityCode = task.activityCode?.trim();
  if (!activityCode) return null;

  const extraction = extractScheduleLaborPlan(task);
  const rollup = computeTaskRollupSlice(task);
  const durationDays = resolveDurationDays(extraction.labor.durationDays);
  const divisionCode = resolveDivisionCode(task, activityCode);

  return {
    task,
    activityCode,
    title: task.title?.trim() || task.description?.trim() || task.lineItem.description,
    divisionCode,
    divisionName: resolveDivisionName(task, divisionCode),
    workPackageCode: task.workPackageCode?.trim() || undefined,
    workPackageName: task.workPackageName?.trim() || task.scopeName?.trim() || undefined,
    durationDays,
    predecessorActivityCode: task.predecessorActivityCode?.trim() || undefined,
    relationshipType: normalizeRelationshipType(task.relationshipType),
    lagDays: Math.max(0, task.lagDays ?? 0),
    crewSize: extraction.labor.crewSize,
    laborHours: extraction.labor.adjustedLaborHours || extraction.labor.laborHours,
    manDays: extraction.labor.manDays,
    crewDays: extraction.labor.crewDays,
    totalCost: rollup.directCost > 0 ? rollup.directCost : undefined,
    notes: parseImportedNotes(task),
  };
}

function resolveConstraintStartDate(
  draft: ActivityDraft,
  predecessorRange: PlannedDateRange,
  relationshipType: GanttRelationshipType,
  lagDays: number,
  dateOptions: GanttScheduleDateOptions,
): string {
  const workWeek = dateOptions.workWeek ?? [1, 2, 3, 4, 5];
  const includeWeekends = dateOptions.includeWeekends ?? false;

  if (relationshipType === 'SS') {
    return snapToWorkingDay(
      addDaysToScheduleDate(predecessorRange.startDate, lagDays),
      workWeek,
      includeWeekends,
    );
  }

  if (relationshipType === 'FF') {
    const targetFinish = addDaysToScheduleDate(predecessorRange.endDate, lagDays);
    return startFromInclusiveFinish(targetFinish, draft.durationDays, dateOptions);
  }

  return snapToWorkingDay(
    addDaysToScheduleDate(predecessorRange.endDate, lagDays + 1),
    workWeek,
    includeWeekends,
  );
}

function scheduleActivities(
  drafts: ActivityDraft[],
  projectStartDate: string,
  dateOptions: GanttScheduleDateOptions,
): {
  ranges: Map<string, PlannedDateRange>;
  warnings: string[];
} {
  const ranges = new Map<string, PlannedDateRange>();
  const warnings: string[] = [];
  const byCode = new Map(drafts.map((draft) => [draft.activityCode, draft]));
  const scheduled = new Set<string>();

  const scheduleDraft = (draft: ActivityDraft, startDate: string): void => {
    const range = addInclusiveDuration(startDate, draft.durationDays, dateOptions);
    ranges.set(draft.activityCode, range);
    scheduled.add(draft.activityCode);
  };

  const resolveStartDate = (draft: ActivityDraft): string => {
    let startDate = projectStartDate;
    const predecessorCode = draft.predecessorActivityCode;

    if (!predecessorCode) {
      return snapToWorkingDay(
        startDate,
        dateOptions.workWeek ?? [1, 2, 3, 4, 5],
        dateOptions.includeWeekends ?? false,
      );
    }

    if (!byCode.has(predecessorCode)) {
      warnings.push(
        `Activity "${draft.activityCode}" references missing predecessor "${predecessorCode}".`,
      );
      return snapToWorkingDay(
        startDate,
        dateOptions.workWeek ?? [1, 2, 3, 4, 5],
        dateOptions.includeWeekends ?? false,
      );
    }

    const predecessorRange = ranges.get(predecessorCode);
    if (!predecessorRange) return startDate;

    let relationshipType = draft.relationshipType;
    if (relationshipType === 'SF') {
      warnings.push(
        `Activity "${draft.activityCode}" uses unsupported SF relationship; falling back to FS.`,
      );
      relationshipType = 'FS';
    }

    const candidateStart = resolveConstraintStartDate(
      draft,
      predecessorRange,
      relationshipType,
      draft.lagDays,
      dateOptions,
    );

    return candidateStart > startDate ? candidateStart : startDate;
  };

  let guard = 0;
  while (scheduled.size < drafts.length && guard < drafts.length * drafts.length) {
    guard += 1;
    let progressed = false;

    for (const draft of drafts) {
      if (scheduled.has(draft.activityCode)) continue;

      const predecessorCode = draft.predecessorActivityCode;
      if (predecessorCode && byCode.has(predecessorCode) && !ranges.has(predecessorCode)) {
        continue;
      }

      scheduleDraft(draft, resolveStartDate(draft));
      progressed = true;
    }

    if (!progressed) {
      warnings.push('Circular dependency detected; some activities were scheduled from project start.');
      for (const draft of drafts) {
        if (!scheduled.has(draft.activityCode)) {
          scheduleDraft(draft, projectStartDate);
        }
      }
      break;
    }
  }

  return { ranges, warnings };
}

function buildLogicLinks(drafts: ActivityDraft[]): LogicLink[] {
  const byCode = new Map(drafts.map((draft) => [draft.activityCode, draft]));
  const links: LogicLink[] = [];

  for (const draft of drafts) {
    const predecessorCode = draft.predecessorActivityCode;
    if (!predecessorCode) continue;
    const predecessor = byCode.get(predecessorCode);
    links.push({
      predecessorActivityCode: predecessorCode,
      predecessorTitle: predecessor?.title ?? predecessorCode,
      successorActivityCode: draft.activityCode,
      successorTitle: draft.title,
      relationshipType: draft.relationshipType,
      lagDays: draft.lagDays,
    });
  }

  return links;
}

export function buildGanttSchedule(params: BuildGanttScheduleParams): BuildGanttScheduleResult {
  const warnings: string[] = [];
  const dateOptions: GanttScheduleDateOptions = {
    includeWeekends: params.includeWeekends ?? false,
  };

  const drafts = params.lineItems
    .map(buildActivityDraft)
    .filter((draft): draft is ActivityDraft => draft != null)
    .sort((left, right) => compareActivityCodes(left.activityCode, right.activityCode));

  for (const draft of drafts) {
    const rawDuration = extractScheduleLaborPlan(draft.task).labor.durationDays;
    if (!Number.isFinite(rawDuration) || rawDuration < 1) {
      warnings.push(
        `Duration was missing or less than 1 day for "${draft.title}"; planned as 1 day.`,
      );
    }
  }

  const projectStartDate = params.projectStartDate.trim() || new Date().toISOString().slice(0, 10);
  const { ranges, warnings: scheduleWarnings } = scheduleActivities(
    drafts,
    projectStartDate,
    dateOptions,
  );
  warnings.push(...scheduleWarnings);

  const activities: GanttActivity[] = drafts.map((draft) => {
    const range = ranges.get(draft.activityCode) ?? {
      startDate: projectStartDate,
      endDate: projectStartDate,
    };

    return {
      activityCode: draft.activityCode,
      title: draft.title,
      divisionCode: draft.divisionCode,
      divisionName: draft.divisionName,
      workPackageCode: draft.workPackageCode,
      workPackageName: draft.workPackageName,
      durationDays: draft.durationDays,
      plannedStart: range.startDate,
      plannedFinish: range.endDate,
      predecessorActivityCode: draft.predecessorActivityCode,
      relationshipType: draft.relationshipType,
      lagDays: draft.lagDays,
      crewSize: draft.crewSize,
      laborHours: draft.laborHours,
      manDays: draft.manDays,
      crewDays: draft.crewDays,
      totalCost: draft.totalCost,
      notes: draft.notes,
    };
  });

  let plannedStart = projectStartDate;
  let plannedFinish = projectStartDate;

  for (const activity of activities) {
    if (activity.plannedStart < plannedStart) plannedStart = activity.plannedStart;
    if (activity.plannedFinish > plannedFinish) plannedFinish = activity.plannedFinish;
  }

  const plannedDurationDays =
    activities.length > 0
      ? countInclusiveSpanDays(plannedStart, plannedFinish, dateOptions)
      : 0;

  return {
    activities,
    logicLinks: buildLogicLinks(drafts),
    plannedDurationDays,
    warnings,
  };
}
