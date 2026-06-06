import { useMemo } from 'react';
import { addDaysToScheduleDate } from '../../../application/mapScheduleCandidateToScheduleEventInput';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmResult, ScheduleSettings } from '../../../scheduling/cpmTypes';
import Button from '../../../../../components/ui/Button';

const COL_CODE = 'w-24 shrink-0';
const COL_DESC = 'w-48 shrink-0';
const COL_META = 'w-14 shrink-0 text-right tabular-nums';
const ROW_HEIGHT = 36;
const MIN_BAR_PX = 4;
const TIMELINE_TOTAL_PX = 800;

function formatDateShort(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[2]}/${match[3]}`;
}

interface GanttRow {
  activity: ScheduleActivity;
  cpm: CpmActivityResult;
  plannedStart: string;
  plannedFinish: string;
  floatFinish: string;
  leveledStart?: string;
}

interface Props {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  scheduleSettings: ScheduleSettings;
  leveledOffsets?: Record<string, number>;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exportReady?: boolean;
}

function getLevelThreeGanttRows(
  activities: ScheduleActivity[],
  cpmResult: CpmResult,
  projectStartDate: string,
  leveledOffsets: Record<string, number>,
): GanttRow[] {
  const cpmByCode = new Map(cpmResult.activities.map((a) => [a.activityCode, a]));
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));

  return cpmResult.activities
    .slice()
    .sort((left, right) => {
      if (left.earlyStart !== right.earlyStart) return left.earlyStart - right.earlyStart;
      return left.activityCode.localeCompare(right.activityCode);
    })
    .map((cpm) => {
      const activity = actByCode.get(cpm.activityCode);
      if (!activity) return null;
      const leveledOffset = leveledOffsets[cpm.activityCode] ?? 0;
      const es = cpm.earlyStart + leveledOffset;
      const ef = es + (actByCode.get(cpm.activityCode)?.durationDays ?? 1);
      const tf = Math.max(0, cpm.totalFloat - leveledOffset);
      return {
        activity,
        cpm,
        plannedStart: addDaysToScheduleDate(projectStartDate, es),
        plannedFinish: addDaysToScheduleDate(projectStartDate, ef - 1),
        floatFinish: addDaysToScheduleDate(projectStartDate, es + (actByCode.get(cpm.activityCode)?.durationDays ?? 1) + tf - 1),
        leveledStart:
          leveledOffset > 0 ? addDaysToScheduleDate(projectStartDate, es) : undefined,
      };
    })
    .filter((row): row is GanttRow => row !== null);
}

function GanttBar({
  cpm,
  activity,
  projectDuration,
  leveledOffset,
}: {
  cpm: CpmActivityResult;
  activity: ScheduleActivity;
  projectDuration: number;
  leveledOffset: number;
}) {
  const totalDays = Math.max(projectDuration, 1);
  const es = cpm.earlyStart + leveledOffset;
  const duration = activity.durationDays;
  const tf = Math.max(0, cpm.totalFloat - leveledOffset);

  const leftPct = (es / totalDays) * 100;
  const widthPct = (duration / totalDays) * 100;
  const floatWidthPct = (tf / totalDays) * 100;

  const barColor = cpm.isCritical
    ? 'bg-red-500 dark:bg-red-600'
    : 'bg-cyan-500 dark:bg-cyan-600';

  return (
    <div className="relative flex h-full items-center" style={{ minWidth: TIMELINE_TOTAL_PX }}>
      {/* Solid activity bar */}
      <div
        className={`absolute h-5 rounded ${barColor}`}
        style={{
          left: `max(${MIN_BAR_PX}px, ${leftPct}%)`,
          width: `max(${MIN_BAR_PX}px, ${widthPct}%)`,
        }}
        title={`${activity.activityDescription}: ${activity.durationDays}d`}
      />
      {/* Float bar (dotted) */}
      {tf > 0 && (
        <div
          className="absolute h-5 rounded border-2 border-dashed border-slate-400 bg-transparent dark:border-slate-500"
          style={{
            left: `max(${MIN_BAR_PX}px, ${leftPct + widthPct}%)`,
            width: `max(${MIN_BAR_PX}px, ${floatWidthPct}%)`,
          }}
          title={`Float: ${tf}d`}
        />
      )}
    </div>
  );
}

export default function LevelThreeGantt({
  activities,
  cpmResult,
  scheduleSettings,
  leveledOffsets = {},
  onExportPdf,
  onExportExcel,
  exportReady = false,
}: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const projectStartDate = scheduleSettings.projectStartDate || today;

  const rows = useMemo(() => {
    if (!cpmResult || cpmResult.activities.length === 0) return [];
    return getLevelThreeGanttRows(activities, cpmResult, projectStartDate, leveledOffsets);
  }, [activities, cpmResult, projectStartDate, leveledOffsets]);

  const projectDuration = cpmResult?.projectDurationDays ?? 0;

  const todayOffset = useMemo(() => {
    if (!projectStartDate) return null;
    const startMs = Date.parse(`${projectStartDate}T00:00:00Z`);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const offset = Math.round((todayMs - startMs) / 86_400_000);
    if (offset < 0 || offset >= projectDuration) return null;
    return offset;
  }, [projectStartDate, today, projectDuration]);

  if (!cpmResult || rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-20 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No scheduled activities. Add activities in the Estimate tab, then wire them in Logic Network.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Level III Gantt
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Activities sorted by early start · {rows.length} activities · {projectDuration} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!exportReady}
            title={!exportReady ? 'Run CPM before exporting.' : undefined}
            onClick={onExportPdf}
          >
            Export PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!exportReady}
            title={!exportReady ? 'Run CPM before exporting.' : undefined}
            onClick={onExportExcel}
          >
            Export Excel
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          {/* Header row */}
          <div
            className="flex border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            style={{ minWidth: COL_CODE + COL_DESC + COL_META + COL_META + COL_META }}
          >
            <span className={COL_CODE}>Code</span>
            <span className={`${COL_DESC} px-2`}>Description</span>
            <span className={COL_META}>Float</span>
            <span className={COL_META}>Dur</span>
            <span className={COL_META}>Start</span>
            <span className={`${COL_META} mr-2`}>Finish</span>
            <span className="ml-2 flex-1 text-center">Timeline →</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.activity.activityCode}
              className="flex items-center border-b border-slate-100 px-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className={`${COL_CODE} font-mono text-xs font-medium ${
                  row.cpm.isCritical
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {row.activity.activityCode}
              </span>
              <span
                className={`${COL_DESC} truncate px-2 text-xs text-slate-800 dark:text-slate-100`}
                title={row.activity.activityDescription}
              >
                {row.activity.activityDescription}
              </span>
              <span className={`${COL_META} text-xs text-slate-600 dark:text-slate-400`}>
                {row.cpm.totalFloat}d
              </span>
              <span className={`${COL_META} text-xs text-slate-600 dark:text-slate-400`}>
                {row.activity.durationDays}d
              </span>
              <span className={`${COL_META} text-xs text-slate-500 dark:text-slate-500`}>
                {formatDateShort(row.plannedStart)}
              </span>
              <span className={`${COL_META} mr-2 text-xs text-slate-500 dark:text-slate-500`}>
                {formatDateShort(row.plannedFinish)}
              </span>

              {/* Timeline bar area */}
              <div
                className="relative ml-2 flex-1 overflow-hidden"
                style={{ height: ROW_HEIGHT, minWidth: TIMELINE_TOTAL_PX }}
              >
                {todayOffset !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 w-px bg-blue-500 opacity-60"
                    style={{
                      left: `${(todayOffset / projectDuration) * 100}%`,
                    }}
                    title="Today"
                  />
                )}
                <GanttBar
                  cpm={row.cpm}
                  activity={row.activity}
                  projectDuration={projectDuration}
                  leveledOffset={leveledOffsets[row.activity.activityCode] ?? 0}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-red-500" />
          Critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-cyan-500" />
          Noncritical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded border-2 border-dashed border-slate-400" />
          Total float
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-blue-500" />
          Today
        </span>
      </div>
    </div>
  );
}
