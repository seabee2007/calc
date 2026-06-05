import {
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  formatGanttDateLabel,
  type GanttTimelineRange,
} from '../estimateGanttDisplay';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  range: GanttTimelineRange;
  columnWidth?: number;
}

export default function EstimateGanttTimelineHeader({
  range,
  columnWidth = DEFAULT_GANTT_COLUMN_WIDTH_PX,
}: Props) {
  if (range.isEmpty) return null;

  return (
    <div
      className="flex h-10 border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/60"
      role="row"
    >
      {range.dayDates.map((date) => (
        <div
          key={date}
          className={`shrink-0 border-r border-slate-200/80 px-1 py-2 text-center text-[10px] font-medium tabular-nums dark:border-slate-700/80 sm:text-xs ${PLANNER_MUTED}`}
          style={{ width: columnWidth }}
          role="columnheader"
          aria-label={formatGanttDateLabel(date)}
        >
          <span className={TEXT_FOREGROUND}>{formatGanttDateLabel(date)}</span>
        </div>
      ))}
    </div>
  );
}
