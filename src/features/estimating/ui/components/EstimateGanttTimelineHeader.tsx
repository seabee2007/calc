import type { GanttScaledTimeline } from '../estimateGanttDisplay';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  timeline: GanttScaledTimeline;
}

export default function EstimateGanttTimelineHeader({ timeline }: Props) {
  if (timeline.isEmpty) return null;

  return (
    <div
      className="flex h-10 border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/60"
      role="row"
    >
      {timeline.buckets.map((bucket) => (
        <div
          key={bucket.key}
          className={`shrink-0 border-r border-slate-200/80 px-1 py-2 text-center text-[10px] font-medium tabular-nums dark:border-slate-700/80 sm:text-xs ${PLANNER_MUTED}`}
          style={{ width: timeline.columnWidth }}
          role="columnheader"
          aria-label={bucket.label}
        >
          <span className={TEXT_FOREGROUND}>{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}
