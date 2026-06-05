import type { EstimateScheduleDependencyPreview } from '../application/estimateScheduleDependencies';
import type {
  PlannedEstimateSchedulePlan,
  PlannedEstimateScheduleTaskCandidate,
} from '../application/estimateScheduleDatePlanner';
import { addDaysToScheduleDate } from '../application/mapScheduleCandidateToScheduleEventInput';
import { formatScheduleGroupLabel } from './estimateScheduleDisplay';
import { ESTIMATE_BLANK } from './estimateFormatters';

export const DEFAULT_GANTT_COLUMN_WIDTH_PX = 36;
export const MIN_GANTT_BAR_WIDTH_FOR_LABEL_PX = 56;

export type GanttRowKind = 'division' | 'scope' | 'task';

export interface GanttTaskInput {
  candidateId: string;
  title: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  durationDays: number;
  weatherSensitive: boolean;
  inspectionRequired: boolean;
  divisionKey: string;
  divisionLabel: string;
  scopeKey: string;
  scopeLabel: string;
}

export interface GanttRow {
  id: string;
  kind: GanttRowKind;
  label: string;
  indentLevel: number;
  task?: GanttTaskInput;
  hasFinishToStartPredecessor?: boolean;
}

export interface GanttTimelineRange {
  startDate: string;
  endDate: string;
  totalDays: number;
  dayDates: string[];
  isEmpty: boolean;
}

export interface GanttBarPosition {
  leftPx: number;
  widthPx: number;
  dayOffset: number;
  spanDays: number;
  showDurationLabel: boolean;
}

function parseYmd(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function isValidYmd(date: string | null | undefined): date is string {
  if (!date?.trim()) return false;
  return parseYmd(date) != null;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function safeColumnWidth(columnWidth: number): number {
  const safe = toFiniteNumber(columnWidth);
  return safe > 0 ? safe : DEFAULT_GANTT_COLUMN_WIDTH_PX;
}

export function hasValidGanttTaskDates(
  task: Pick<GanttTaskInput, 'plannedStartDate' | 'plannedEndDate'>,
): boolean {
  const start = task.plannedStartDate?.trim();
  const end = task.plannedEndDate?.trim();
  if (!isValidYmd(start) || !isValidYmd(end)) return false;
  return start <= end;
}

function offsetDaysFromStart(timelineStart: string, date: string): number {
  const start = parseYmd(timelineStart);
  const target = parseYmd(date);
  if (!start || !target) return -1;

  const diffMs = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return Number.isFinite(diffDays) ? diffDays : -1;
}

function inclusiveDaySpan(startDate: string, endDate: string): number {
  const offset = offsetDaysFromStart(startDate, endDate);
  if (offset < 0) return 0;
  return offset + 1;
}

function mapTaskToGanttInput(
  task: PlannedEstimateScheduleTaskCandidate,
  divisionKey: string,
  divisionLabel: string,
  scopeKey: string,
  scopeLabel: string,
): GanttTaskInput {
  return {
    candidateId: task.candidateId,
    title: task.title,
    plannedStartDate: task.plannedStartDate,
    plannedEndDate: task.plannedEndDate,
    durationDays: toFiniteNumber(task.labor.durationDays),
    weatherSensitive: task.weatherSensitive,
    inspectionRequired: task.inspectionRequired,
    divisionKey,
    divisionLabel,
    scopeKey,
    scopeLabel,
  };
}

export function extractGanttTasksFromPlan(
  plan: PlannedEstimateSchedulePlan | null,
): GanttTaskInput[] {
  if (!plan) return [];

  return plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) =>
      scope.tasks.map((task) =>
        mapTaskToGanttInput(
          task,
          division.key,
          formatScheduleGroupLabel(division.key, division.label),
          scope.key,
          formatScheduleGroupLabel(scope.key, scope.label),
        ),
      ),
    ),
  );
}

export function buildGanttSuccessorCandidateIds(
  dependencies: EstimateScheduleDependencyPreview[],
): Set<string> {
  return new Set(dependencies.map((dependency) => dependency.successorCandidateId));
}

export function formatGanttDependencyPreviewNote(dependencyCount: number): string {
  const safeCount = Number.isFinite(dependencyCount) ? Math.max(0, Math.floor(dependencyCount)) : 0;
  const linkLabel = safeCount === 1 ? 'link' : 'links';
  return `${safeCount} finish-to-start dependency ${linkLabel} in preview. Dependency lines are preview-only and will be drawn in a later phase.`;
}

export function getGanttTaskRows(
  plan: PlannedEstimateSchedulePlan | null,
  dependencies: EstimateScheduleDependencyPreview[] = [],
): GanttRow[] {
  if (!plan) return [];

  const successorIds = buildGanttSuccessorCandidateIds(dependencies);
  const rows: GanttRow[] = [];

  for (const division of plan.divisions) {
    const divisionLabel = formatScheduleGroupLabel(division.key, division.label);
    rows.push({
      id: `division:${division.key}`,
      kind: 'division',
      label: divisionLabel,
      indentLevel: 0,
    });

    for (const scope of division.scopes) {
      const scopeLabel = formatScheduleGroupLabel(scope.key, scope.label);
      rows.push({
        id: `scope:${division.key}:${scope.key}`,
        kind: 'scope',
        label: scopeLabel,
        indentLevel: 1,
      });

      for (const task of scope.tasks) {
        rows.push({
          id: task.candidateId,
          kind: 'task',
          label: task.title.trim() || ESTIMATE_BLANK,
          indentLevel: 2,
          hasFinishToStartPredecessor: successorIds.has(task.candidateId),
          task: mapTaskToGanttInput(
            task,
            division.key,
            divisionLabel,
            scope.key,
            scopeLabel,
          ),
        });
      }
    }
  }

  return rows;
}

export function buildGanttTimelineRange(tasks: GanttTaskInput[]): GanttTimelineRange {
  const datedTasks = tasks.filter(hasValidGanttTaskDates);
  if (datedTasks.length === 0) {
    return {
      startDate: '',
      endDate: '',
      totalDays: 0,
      dayDates: [],
      isEmpty: true,
    };
  }

  let startDate = datedTasks[0].plannedStartDate!.trim();
  let endDate = datedTasks[0].plannedEndDate!.trim();

  for (const task of datedTasks) {
    const taskStart = task.plannedStartDate!.trim();
    const taskEnd = task.plannedEndDate!.trim();
    if (taskStart < startDate) startDate = taskStart;
    if (taskEnd > endDate) endDate = taskEnd;
  }

  const totalDays = inclusiveDaySpan(startDate, endDate);
  const dayDates: string[] = [];
  let current = startDate;

  for (let index = 0; index < totalDays; index += 1) {
    dayDates.push(current);
    current = addDaysToScheduleDate(current, 1);
  }

  return {
    startDate,
    endDate,
    totalDays,
    dayDates,
    isEmpty: false,
  };
}

export function calculateGanttBarPosition(
  task: Pick<GanttTaskInput, 'plannedStartDate' | 'plannedEndDate' | 'durationDays'>,
  timelineStart: string,
  columnWidth: number,
): GanttBarPosition | null {
  if (!isValidYmd(timelineStart) || !hasValidGanttTaskDates(task)) return null;

  const startDate = task.plannedStartDate!.trim();
  const endDate = task.plannedEndDate!.trim();
  const dayOffset = offsetDaysFromStart(timelineStart, startDate);
  const spanDays = inclusiveDaySpan(startDate, endDate);

  if (dayOffset < 0 || spanDays < 1) return null;

  const width = safeColumnWidth(columnWidth);
  const leftPx = dayOffset * width;
  const widthPx = spanDays * width;

  if (!Number.isFinite(leftPx) || !Number.isFinite(widthPx)) return null;

  return {
    leftPx,
    widthPx,
    dayOffset,
    spanDays,
    showDurationLabel: widthPx >= MIN_GANTT_BAR_WIDTH_FOR_LABEL_PX,
  };
}

export function formatGanttDateLabel(date: string): string {
  if (!isValidYmd(date)) return ESTIMATE_BLANK;

  const parsed = parseYmd(date)!;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function getGanttTodayDateYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isTodayWithinGanttRange(
  range: GanttTimelineRange,
  todayYmd: string,
): boolean {
  if (range.isEmpty || !isValidYmd(todayYmd)) return false;
  return todayYmd >= range.startDate && todayYmd <= range.endDate;
}

export function calculateGanttTodayMarkerPosition(
  timelineStart: string,
  columnWidth: number,
  todayYmd: string,
): number | null {
  if (!isValidYmd(timelineStart) || !isValidYmd(todayYmd)) return null;

  const dayOffset = offsetDaysFromStart(timelineStart, todayYmd);
  if (dayOffset < 0 || !Number.isFinite(dayOffset)) return null;

  const width = safeColumnWidth(columnWidth);
  const position = dayOffset * width + width / 2;
  return Number.isFinite(position) ? position : null;
}

export function hasPlannedGanttTasks(plan: PlannedEstimateSchedulePlan | null): boolean {
  return extractGanttTasksFromPlan(plan).some(hasValidGanttTaskDates);
}

export function formatGanttDurationLabel(durationDays: number): string {
  const safe = Math.max(1, Math.ceil(toFiniteNumber(durationDays)));
  return `${safe}d`;
}
