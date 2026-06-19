import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { CpmActivityResult, LogicNetworkViewMode } from '../../../scheduling/cpmTypes';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { TopologyLabel } from '../../../scheduling/cpm/cpmDisplayCritical';
import type { LogicTopologyLabel } from '../../../scheduling/logic/logicNetworkTopology';

const TOPOLOGY_LABEL_TEXT: Record<TopologyLabel, string> = {
  'open-start': 'Open start',
  'open-finish': 'Open finish',
  disconnected: 'Disconnected',
  'missing-logic': 'Missing logic',
};

const LOGIC_TOPOLOGY_LABEL_TEXT: Record<LogicTopologyLabel, string> = {
  'open-start': 'Open start',
  'open-finish': 'Open finish',
  'missing-duration': 'Missing duration',
  circular: 'Circular logic',
};

export interface CpmActivityNodeData {
  activity: ScheduleActivity;
  viewMode: LogicNetworkViewMode;
  cpmResult?: CpmActivityResult;
  isDisplayCritical?: boolean;
  topologyLabel?: TopologyLabel | null;
  logicTopologyLabel?: LogicTopologyLabel | null;
  predecessorCount?: number;
  successorCount?: number;
  showCpmFields?: boolean;
  /** Resource-leveled view overlay state. */
  leveledViewActive?: boolean;
  leveledOffsetDays?: number;
  effectiveTotalFloat?: number | null;
  controllingAfterLeveling?: boolean;
  baselineEarlyStart?: number | null;
  baselineEarlyFinish?: number | null;
  baselineTotalFloat?: number | null;
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
  const {
    activity,
    viewMode,
    cpmResult,
    isDisplayCritical = false,
    topologyLabel = null,
    logicTopologyLabel = null,
    predecessorCount = 0,
    successorCount = 0,
    showCpmFields = false,
    leveledViewActive = false,
    leveledOffsetDays = 0,
    effectiveTotalFloat = null,
    controllingAfterLeveling = false,
    baselineEarlyStart = null,
    baselineEarlyFinish = null,
    baselineTotalFloat = null,
  } = data;

  const isLogicMode = viewMode === 'logic-network';
  const activeTopologyLabel = isLogicMode ? logicTopologyLabel : topologyLabel;
  const isCircularError = isLogicMode && logicTopologyLabel === 'circular';

  const borderColor = isLogicMode
    ? isCircularError
      ? 'border-red-500 dark:border-red-400'
      : activeTopologyLabel
        ? 'border-amber-500 dark:border-amber-400'
        : selected
          ? 'border-cyan-500 dark:border-cyan-400'
          : 'border-slate-300 dark:border-slate-600'
    : isDisplayCritical
      ? 'border-red-500 dark:border-red-400'
      : activeTopologyLabel
        ? 'border-amber-500 dark:border-amber-400'
        : selected
          ? 'border-cyan-500 dark:border-cyan-400'
          : 'border-slate-300 dark:border-slate-600';

  const headerClass = isLogicMode
    ? isCircularError
      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
      : activeTopologyLabel
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200'
    : isDisplayCritical
      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
      : activeTopologyLabel
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200';

  const cardShadowClass = isDisplayCritical || isCircularError
    ? 'shadow-xl shadow-red-900/15 dark:shadow-black/40'
    : 'shadow-xl shadow-slate-900/15 dark:shadow-black/40';

  return (
    <div
      className={`relative w-52 rounded border-2 bg-white text-xs transition-shadow hover:border-cyan-400 hover:shadow-2xl dark:bg-slate-900 dark:hover:border-cyan-400 ${borderColor} ${cardShadowClass}`}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white hover:!border-cyan-500 dark:!border-slate-400 dark:!bg-slate-900"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white hover:!border-cyan-500 dark:!border-slate-400 dark:!bg-slate-900"
      />

      <div className={`flex items-center justify-between px-2 py-1 font-mono font-semibold ${headerClass}`}>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate">{activity.displayCode ?? activity.activityCode}</span>
          {activity.isCustomActivity ? (
            <span
              className="shrink-0 rounded bg-amber-200 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-700 dark:text-amber-100"
              title="Custom activity (not in the master dataset)"
            >
              Custom
            </span>
          ) : null}
        </span>
        <span className="ml-2 flex shrink-0 items-center gap-1 tabular-nums">
          {leveledViewActive && leveledOffsetDays > 0 ? (
            <span
              className="rounded bg-orange-200 px-1 text-[9px] font-bold text-orange-900 dark:bg-orange-700 dark:text-orange-100"
              title={`Resource leveling delayed this activity by ${leveledOffsetDays} day(s)`}
            >
              +{leveledOffsetDays}d
            </span>
          ) : null}
          {activity.durationDays}d
          {activity.durationDays < 1 ? (
            <span className="ml-1 text-amber-500" title="Missing or invalid duration">
              ⚠
            </span>
          ) : null}
        </span>
      </div>

      {leveledViewActive ? (
        <div
          className={`border-t px-2 py-0.5 text-[10px] font-medium ${
            controllingAfterLeveling
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {controllingAfterLeveling
            ? 'Controlling after leveling'
            : `Leveled · eff. float ${effectiveTotalFloat ?? '–'}d`}
        </div>
      ) : null}

      {leveledViewActive ? (
        <div className="border-t border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Base ES/EF {formatDay(baselineEarlyStart)} / {formatDay(baselineEarlyFinish)} · Base TF{' '}
          {formatDay(baselineTotalFloat ?? undefined)}
        </div>
      ) : null}

      {activeTopologyLabel ? (
        <div
          className={`border-t px-2 py-0.5 text-[10px] font-medium ${
            isCircularError
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
          }`}
        >
          {isLogicMode
            ? LOGIC_TOPOLOGY_LABEL_TEXT[logicTopologyLabel!]
            : TOPOLOGY_LABEL_TEXT[topologyLabel!]}
        </div>
      ) : null}

      <div className="border-t border-slate-200 px-2 py-1 dark:border-slate-700">
        <span
          className="line-clamp-2 text-slate-900 dark:text-slate-100"
          title={activity.activityDescription}
        >
          {activity.activityDescription}
        </span>
      </div>

      {isLogicMode ? (
        <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700">
          <div className="border-r border-slate-200 px-2 py-1 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Pred </span>
            <span className="tabular-nums text-slate-900 dark:text-slate-100">
              {predecessorCount}
            </span>
          </div>
          <div className="px-2 py-1">
            <span className="text-slate-600 dark:text-slate-400">Succ </span>
            <span className="tabular-nums text-slate-900 dark:text-slate-100">{successorCount}</span>
          </div>
        </div>
      ) : showCpmFields ? (
        <>
          <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700">
            <div className="border-r border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">ES </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatDay(cpmResult?.earlyStart)}
              </span>
            </div>
            <div className="px-2 py-1">
              <span className="text-slate-600 dark:text-slate-400">EF </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatDay(cpmResult?.earlyFinish)}
              </span>
            </div>
            <div className="border-r border-t border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">LS </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatDay(cpmResult?.lateStart)}
              </span>
            </div>
            <div className="border-t border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">LF </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatDay(cpmResult?.lateFinish)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-700">
            <div className="border-r border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">
                {leveledViewActive ? 'TF (leveled) ' : 'TF '}
              </span>
              <span
                className={`tabular-nums ${
                  isDisplayCritical && !leveledViewActive
                    ? 'font-semibold text-red-700 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatDay(cpmResult?.totalFloat)}
              </span>
            </div>
            <div className="px-2 py-1">
              <span className="text-slate-600 dark:text-slate-400">FF </span>
              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                {formatDay(cpmResult?.freeFloat)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="border-t border-slate-200 px-2 py-2 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-400">
          Run CPM to calculate ES, EF, LS, LF, TF, and FF.
        </div>
      )}
    </div>
  );
});
