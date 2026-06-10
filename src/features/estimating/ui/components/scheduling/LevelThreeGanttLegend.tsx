interface Props {
  className?: string;
  showBarClickHint?: boolean;
}

export default function LevelThreeGanttLegend({
  className = '',
  showBarClickHint = false,
}: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 ${className}`}
      data-testid="level-three-gantt-legend"
    >
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-6 rounded bg-red-500" />
        Critical path
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-6 rounded bg-cyan-500" />
        Noncritical
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-6 rounded border border-dashed border-slate-500 dark:border-slate-400" />
        Estimated float
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-0.5 w-6 bg-cyan-500 dark:bg-cyan-400" />
        Today
      </span>
      {showBarClickHint ? (
        <span className="text-slate-500 dark:text-slate-500">Click a bar for details</span>
      ) : null}
    </div>
  );
}
