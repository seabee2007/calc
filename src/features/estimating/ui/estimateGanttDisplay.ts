import type { EstimateScheduleDependencyPreview } from '../application/estimateScheduleDependencies';
import type {
  PlannedEstimateSchedulePlan,
  PlannedEstimateScheduleTaskCandidate,
} from '../application/estimateScheduleDatePlanner';
import { formatScheduleGroupLabel } from './estimateScheduleDisplay';
import { ESTIMATE_BLANK } from './estimateFormatters';

export const DEFAULT_GANTT_COLUMN_WIDTH_PX = 36;
export const MIN_GANTT_BAR_WIDTH_FOR_LABEL_PX = 56;
export const GANTT_LABEL_COLUMN_WIDTH_PX = 176;
export const GANTT_LABEL_COLUMN_WIDTH_SM_PX = 224;

export type GanttTimelineScale = 'day' | 'week' | 'month';

export const DEFAULT_GANTT_TIMELINE_SCALE: GanttTimelineScale = 'day';

export const GANTT_COLUMN_WIDTH_BY_SCALE: Record<GanttTimelineScale, number> = {
  day: DEFAULT_GANTT_COLUMN_WIDTH_PX,
  week: 72,
  month: 96,
};

export interface GanttTimelineScaleOption {
  value: GanttTimelineScale;
  label: string;
}

export const GANTT_TIMELINE_SCALE_OPTIONS: GanttTimelineScaleOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export interface GanttTimelineBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export type GanttRowKind = 'division' | 'scope' | 'task';

export const GANTT_ROW_HEIGHT_PX: Record<GanttRowKind, number> = {
  division: 36,
  scope: 32,
  task: 44,
};

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

export interface GanttScaledTimeline extends GanttTimelineRange {
  scale: GanttTimelineScale;
  buckets: GanttTimelineBucket[];
  columnWidth: number;
  totalColumns: number;
  totalWidthPx: number;
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

function formatYmdFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToYmd(date: string, daysToAdd: number): string {
  const safeDays = Number.isFinite(daysToAdd) ? Math.floor(daysToAdd) : 0;
  const parsed = parseYmd(date);
  if (!parsed) return date;

  parsed.setUTCDate(parsed.getUTCDate() + safeDays);
  return formatYmdFromDate(parsed);
}

function getWeekStartMonday(date: string): string {
  const parsed = parseYmd(date);
  if (!parsed) return date;

  const weekday = parsed.getUTCDay();
  const daysToSubtract = weekday === 0 ? 6 : weekday - 1;
  return addDaysToYmd(date, -daysToSubtract);
}

function getWeekEndSunday(date: string): string {
  return addDaysToYmd(getWeekStartMonday(date), 6);
}

function getMonthStart(date: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(date.trim());
  if (!match) return date;
  return `${match[1]}-${match[2]}-01`;
}

function getMonthEnd(date: string): string {
  const monthStart = getMonthStart(date);
  const parsed = parseYmd(monthStart);
  if (!parsed) return date;

  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(0);
  return formatYmdFromDate(parsed);
}

function addMonthsToYmd(date: string, months: number): string {
  const parsed = parseYmd(date);
  if (!parsed) return date;

  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return formatYmdFromDate(parsed);
}

function buildDayDates(startDate: string, endDate: string): string[] {
  const totalDays = inclusiveDaySpan(startDate, endDate);
  const dayDates: string[] = [];
  let current = startDate;

  for (let index = 0; index < totalDays; index += 1) {
    dayDates.push(current);
    current = addDaysToYmd(current, 1);
  }

  return dayDates;
}

function buildDayBuckets(startDate: string, endDate: string): GanttTimelineBucket[] {
  return buildDayDates(startDate, endDate).map((date) => ({
    key: date,
    label: formatGanttDateLabel(date),
    startDate: date,
    endDate: date,
  }));
}

function buildWeekBuckets(startDate: string, endDate: string): GanttTimelineBucket[] {
  const buckets: GanttTimelineBucket[] = [];
  let current = startDate;

  while (current <= endDate) {
    const weekEnd = addDaysToYmd(current, 6);
    buckets.push({
      key: current,
      label: formatGanttWeekLabel(current),
      startDate: current,
      endDate: weekEnd <= endDate ? weekEnd : endDate,
    });
    current = addDaysToYmd(current, 7);
  }

  return buckets;
}

function buildMonthBuckets(startDate: string, endDate: string): GanttTimelineBucket[] {
  const buckets: GanttTimelineBucket[] = [];
  let current = getMonthStart(startDate);

  while (current <= endDate) {
    const monthEnd = getMonthEnd(current);
    buckets.push({
      key: current.slice(0, 7),
      label: formatGanttMonthLabel(current),
      startDate: current,
      endDate: monthEnd <= endDate ? monthEnd : endDate,
    });
    current = addMonthsToYmd(current, 1);
  }

  return buckets;
}

function buildEmptyScaledTimeline(scale: GanttTimelineScale): GanttScaledTimeline {
  const columnWidth = GANTT_COLUMN_WIDTH_BY_SCALE[scale];
  return {
    scale,
    startDate: '',
    endDate: '',
    totalDays: 0,
    dayDates: [],
    buckets: [],
    isEmpty: true,
    columnWidth,
    totalColumns: 0,
    totalWidthPx: 0,
  };
}

function alignTimelineBoundsForScale(
  startDate: string,
  endDate: string,
  scale: GanttTimelineScale,
): { startDate: string; endDate: string } {
  if (scale === 'week') {
    return {
      startDate: getWeekStartMonday(startDate),
      endDate: getWeekEndSunday(endDate),
    };
  }

  if (scale === 'month') {
    return {
      startDate: getMonthStart(startDate),
      endDate: getMonthEnd(endDate),
    };
  }

  return { startDate, endDate };
}

function buildBucketsForScale(
  startDate: string,
  endDate: string,
  scale: GanttTimelineScale,
): GanttTimelineBucket[] {
  if (scale === 'week') return buildWeekBuckets(startDate, endDate);
  if (scale === 'month') return buildMonthBuckets(startDate, endDate);
  return buildDayBuckets(startDate, endDate);
}

function getScaledTimelineWidth(timeline: Pick<GanttScaledTimeline, 'totalColumns' | 'columnWidth'>): number {
  const columns = Math.max(0, Math.floor(toFiniteNumber(timeline.totalColumns)));
  const width = safeColumnWidth(timeline.columnWidth);
  const totalWidth = columns * width;
  return Number.isFinite(totalWidth) ? totalWidth : 0;
}

function calculateDateOffsetPx(date: string, timeline: GanttScaledTimeline): number | null {
  if (!isValidYmd(date) || timeline.isEmpty || timeline.totalDays < 1) return null;

  const dayOffset = offsetDaysFromStart(timeline.startDate, date);
  if (dayOffset < 0) return null;

  const totalWidth = getScaledTimelineWidth(timeline);
  if (totalWidth <= 0) return null;

  const position = (dayOffset / timeline.totalDays) * totalWidth;
  return Number.isFinite(position) ? position : null;
}

function calculateInclusiveEndOffsetPx(date: string, timeline: GanttScaledTimeline): number | null {
  if (!isValidYmd(date) || timeline.isEmpty || timeline.totalDays < 1) return null;

  const dayOffset = offsetDaysFromStart(timeline.startDate, date);
  if (dayOffset < 0) return null;

  const totalWidth = getScaledTimelineWidth(timeline);
  if (totalWidth <= 0) return null;

  const position = ((dayOffset + 1) / timeline.totalDays) * totalWidth;
  return Number.isFinite(position) ? position : null;
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
  return `${safeCount} finish-to-start dependency ${linkLabel} in preview.`;
}

export const GANTT_DEPENDENCY_LINES_NOTE =
  'Dependency lines are preview-only and are not saved to the Planner schedule.';

export function calculateGanttBodyHeight(rows: GanttRow[]): number {
  return rows.reduce((sum, row) => sum + GANTT_ROW_HEIGHT_PX[row.kind], 0);
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
  return buildGanttScaledTimeline(tasks, 'day');
}

export function buildGanttScaledTimeline(
  tasks: GanttTaskInput[],
  scale: GanttTimelineScale = DEFAULT_GANTT_TIMELINE_SCALE,
): GanttScaledTimeline {
  const datedTasks = tasks.filter(hasValidGanttTaskDates);
  if (datedTasks.length === 0) {
    return buildEmptyScaledTimeline(scale);
  }

  let taskStartDate = datedTasks[0].plannedStartDate!.trim();
  let taskEndDate = datedTasks[0].plannedEndDate!.trim();

  for (const task of datedTasks) {
    const start = task.plannedStartDate!.trim();
    const end = task.plannedEndDate!.trim();
    if (start < taskStartDate) taskStartDate = start;
    if (end > taskEndDate) taskEndDate = end;
  }

  const alignedBounds = alignTimelineBoundsForScale(taskStartDate, taskEndDate, scale);
  const startDate = alignedBounds.startDate;
  const endDate = alignedBounds.endDate;
  const totalDays = inclusiveDaySpan(startDate, endDate);
  const dayDates = buildDayDates(startDate, endDate);
  const buckets = buildBucketsForScale(startDate, endDate, scale);
  const columnWidth = GANTT_COLUMN_WIDTH_BY_SCALE[scale];
  const totalColumns = buckets.length;
  const totalWidthPx = getScaledTimelineWidth({ totalColumns, columnWidth });

  return {
    scale,
    startDate,
    endDate,
    totalDays,
    dayDates,
    buckets,
    isEmpty: false,
    columnWidth,
    totalColumns,
    totalWidthPx,
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

export function calculateGanttBarPositionForScale(
  task: Pick<GanttTaskInput, 'plannedStartDate' | 'plannedEndDate' | 'durationDays'>,
  timeline: GanttScaledTimeline,
): GanttBarPosition | null {
  if (timeline.isEmpty || !hasValidGanttTaskDates(task)) return null;

  if (timeline.scale === 'day') {
    return calculateGanttBarPosition(task, timeline.startDate, timeline.columnWidth);
  }

  const startDate = task.plannedStartDate!.trim();
  const endDate = task.plannedEndDate!.trim();
  const dayOffset = offsetDaysFromStart(timeline.startDate, startDate);
  const spanDays = inclusiveDaySpan(startDate, endDate);

  if (dayOffset < 0 || spanDays < 1) return null;

  const leftPx = calculateDateOffsetPx(startDate, timeline);
  const rightPx = calculateInclusiveEndOffsetPx(endDate, timeline);

  if (leftPx == null || rightPx == null || rightPx <= leftPx) return null;

  const widthPx = rightPx - leftPx;
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

export function formatGanttWeekLabel(date: string): string {
  return formatGanttDateLabel(date);
}

export function formatGanttMonthLabel(date: string): string {
  if (!isValidYmd(date)) return ESTIMATE_BLANK;

  const parsed = parseYmd(date)!;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function listGanttTimelineScaleOptions(): GanttTimelineScaleOption[] {
  return GANTT_TIMELINE_SCALE_OPTIONS;
}

export function getGanttTodayDateYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isTodayWithinGanttRange(
  range: Pick<GanttTimelineRange, 'startDate' | 'endDate' | 'isEmpty'>,
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

export function calculateGanttTodayMarkerPositionForScale(
  timeline: GanttScaledTimeline,
  todayYmd: string,
): number | null {
  if (timeline.isEmpty || !isValidYmd(todayYmd)) return null;

  if (timeline.scale === 'day') {
    return calculateGanttTodayMarkerPosition(
      timeline.startDate,
      timeline.columnWidth,
      todayYmd,
    );
  }

  const dayOffset = offsetDaysFromStart(timeline.startDate, todayYmd);
  if (dayOffset < 0 || timeline.totalDays < 1) return null;

  const totalWidth = getScaledTimelineWidth(timeline);
  if (totalWidth <= 0) return null;

  const position = ((dayOffset + 0.5) / timeline.totalDays) * totalWidth;
  return Number.isFinite(position) ? position : null;
}

export function hasPlannedGanttTasks(plan: PlannedEstimateSchedulePlan | null): boolean {
  return extractGanttTasksFromPlan(plan).some(hasValidGanttTaskDates);
}

export function formatGanttDurationLabel(durationDays: number): string {
  const safe = Math.max(1, Math.ceil(toFiniteNumber(durationDays)));
  return `${safe}d`;
}

export function isGanttTaskOnCriticalPath(
  candidateId: string | undefined,
  criticalTaskIds: string[],
  enabled: boolean,
): boolean {
  if (!enabled || !candidateId) return false;
  return criticalTaskIds.includes(candidateId);
}

export function getGanttCriticalBarClassName(isCritical: boolean): string {
  if (!isCritical) {
    return 'border-cyan-700/40 bg-cyan-500/85 dark:border-cyan-400/40 dark:bg-cyan-600/90';
  }

  return 'border-rose-700/70 bg-rose-500/90 shadow-md ring-1 ring-rose-400/40 dark:border-rose-400/70 dark:bg-rose-600/90 dark:ring-rose-300/30';
}

export const GANTT_BASELINE_PREVIEW_NOTE =
  'Baseline is preview-only. It will become the locked comparison schedule after publishing or accepting a schedule.';

export function getGanttBaselineBarClassName(): string {
  return 'border border-dashed border-slate-400/70 bg-slate-300/35 dark:border-slate-500/70 dark:bg-slate-600/25';
}
