import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { CpmActivityResult } from '../../../scheduling/cpmTypes';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';

export interface CpmActivityNodeData {
  activity: ScheduleActivity;
  cpmResult?: CpmActivityResult;
  [key: string]: unknown;
}

interface Props {
  data: CpmActivityNodeData;
  selected?: boolean;
}

function formatDay(day: number | undefined): string {
  if (day === undefined || day === null) return '–';
  return String(day);
}

export const CpmActivityNode = memo(function CpmActivityNode({ data, selected }: Props) {
  const { activity, cpmResult } = data;

  const isCritical = cpmResult?.isCritical ?? false;
  const missingDuration = activity.durationDays < 1;

  const borderColor = isCritical
    ? 'border-red-500 dark:border-red-400'
    : selected
      ? 'border-cyan-500 dark:border-cyan-400'
      : 'border-slate-300 dark:border-slate-600';

  return (
    <div
      className={`relative w-52 rounded border-2 bg-white text-xs shadow-sm dark:bg-slate-900 ${borderColor}`}
    >
      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-slate-400 !bg-white dark:!bg-slate-700"
      />
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-slate-400 !bg-white dark:!bg-slate-700"
      />

      {/* Top row: code + duration */}
      <div
        className={`flex items-center justify-between px-2 py-1 font-mono font-semibold ${
          isCritical
            ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
            : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
        }`}
      >
        <span className="truncate">{activity.activityCode}</span>
        <span className="ml-2 shrink-0 tabular-nums">
          {activity.durationDays}d
          {missingDuration ? (
            <span className="ml-1 text-amber-500" title="Missing or invalid duration">
              ⚠
            </span>
          ) : null}
        </span>
      </div>

      {/* Description */}
      <div className="border-t border-slate-200 px-2 py-1 dark:border-slate-700">
        <span
          className="line-clamp-2 text-slate-800 dark:text-slate-100"
          title={activity.activityDescription}
        >
          {activity.activityDescription}
        </span>
      </div>

      {/* ES / EF / LS / LF */}
      <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700">
        <div className="border-r border-slate-200 px-2 py-1 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">ES </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {formatDay(cpmResult?.earlyStart)}
          </span>
        </div>
        <div className="px-2 py-1">
          <span className="text-slate-500 dark:text-slate-400">EF </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {formatDay(cpmResult?.earlyFinish)}
          </span>
        </div>
        <div className="border-r border-t border-slate-200 px-2 py-1 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">LS </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {formatDay(cpmResult?.lateStart)}
          </span>
        </div>
        <div className="border-t border-slate-200 px-2 py-1 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">LF </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {formatDay(cpmResult?.lateFinish)}
          </span>
        </div>
      </div>

      {/* TF / FF */}
      <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700">
        <div className="border-r border-slate-200 px-2 py-1 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400">TF </span>
          <span
            className={`tabular-nums ${
              (cpmResult?.totalFloat ?? 0) === 0
                ? 'font-semibold text-red-600 dark:text-red-400'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {formatDay(cpmResult?.totalFloat)}
          </span>
        </div>
        <div className="px-2 py-1">
          <span className="text-slate-500 dark:text-slate-400">FF </span>
          <span className="tabular-nums text-slate-800 dark:text-slate-100">
            {formatDay(cpmResult?.freeFloat)}
          </span>
        </div>
      </div>
    </div>
  );
});
