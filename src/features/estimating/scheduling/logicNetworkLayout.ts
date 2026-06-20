import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, LogicNetworkLayout } from './cpmTypes';
import {
  LOGIC_NETWORK_AUTO_LAYOUT_START_X,
  LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
  LOGIC_NETWORK_COLUMN_SPACING,
  LOGIC_NETWORK_ROW_SPACING,
  autoLayoutLogicNetwork,
} from './logic/autoLayoutLogicNetwork';

export {
  LOGIC_NETWORK_AUTO_LAYOUT_START_X,
  LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
  LOGIC_NETWORK_COLUMN_SPACING,
  LOGIC_NETWORK_ROW_SPACING,
} from './logic/autoLayoutLogicNetwork';

export const LOGIC_NETWORK_CANVAS_HEIGHT_CLASS = 'h-[calc(100vh-300px)] min-h-[640px] w-full';

/** Fixed precedence-diagram node dimensions — duration must not affect width. */
export const LOGIC_NODE_WIDTH = 220;
export const LOGIC_NODE_HEIGHT = 118;
export const LOGIC_NETWORK_NODE_WIDTH = LOGIC_NODE_WIDTH;
export const LOGIC_NETWORK_NODE_HEIGHT = LOGIC_NODE_HEIGHT;

/** Topology column/row spacing — not time-scaled. */
export const NODE_HORIZONTAL_GAP = LOGIC_NETWORK_COLUMN_SPACING;
export const NODE_VERTICAL_GAP = LOGIC_NETWORK_ROW_SPACING;

/** @deprecated Time-scaled spacing — do not use for graph coordinates. */
export const LOGIC_NETWORK_AUTO_LAYOUT_X_SPACING = 160;
/** @deprecated Use NODE_VERTICAL_GAP for topology layout. */
export const LOGIC_NETWORK_AUTO_LAYOUT_Y_GAP = LOGIC_NETWORK_ROW_SPACING;

export interface LogicNetworkNodePosition {
  x: number;
  y: number;
}

export type GraphLayoutNode = {
  activityId: string;
  rank: number;
  orderInRank: number;
  x: number;
  y: number;
  durationDays?: number;
  earlyStart?: number;
  leveledOffsetDays?: number;
};

export interface LogicNetworkLayoutScheduleHints {
  earlyStart?: number;
  durationDays?: number;
  leveledOffsetDays?: number;
  leveledStartDayIndex?: number;
}

/**
 * Development guard: layout coordinates must not be derived from schedule timing.
 */
export function assertTopologyOnlyLayout(
  activity: ScheduleActivity,
  layoutNode: LogicNetworkNodePosition,
  schedule?: LogicNetworkLayoutScheduleHints,
): void {
  if (!import.meta.env.DEV) return;

  const legacyTimeScaleX = LOGIC_NETWORK_AUTO_LAYOUT_X_SPACING;
  const checks: Array<{ field: string; scaledX: number }> = [];

  if (schedule?.earlyStart != null) {
    checks.push({ field: 'earlyStart', scaledX: schedule.earlyStart * legacyTimeScaleX });
  }
  if (schedule?.leveledStartDayIndex != null) {
    checks.push({
      field: 'leveledStartDayIndex',
      scaledX: schedule.leveledStartDayIndex * legacyTimeScaleX + LOGIC_NETWORK_AUTO_LAYOUT_START_X,
    });
  }
  if (schedule?.durationDays != null) {
    checks.push({ field: 'durationDays', scaledX: schedule.durationDays * legacyTimeScaleX });
  }
  if (schedule?.leveledOffsetDays != null && schedule.leveledOffsetDays > 0) {
    checks.push({
      field: 'leveledOffsetDays',
      scaledX: schedule.leveledOffsetDays * legacyTimeScaleX,
    });
  }

  for (const check of checks) {
    if (Math.abs(layoutNode.x - check.scaledX) < 1) {
      console.warn(
        `[Logic Network] Layout X for ${activity.activityCode} appears time-scaled from ${check.field}`,
        { layoutNode, schedule },
      );
    }
  }
}

/** Topology-only fallback before auto-layout persists positions. */
export function autoLayoutNodePosition(
  _activity: ScheduleActivity,
  index: number,
): LogicNetworkNodePosition {
  return {
    x: LOGIC_NETWORK_AUTO_LAYOUT_START_X,
    y: LOGIC_NETWORK_AUTO_LAYOUT_START_Y + index * NODE_VERTICAL_GAP,
  };
}

export function resolveLogicNetworkNodePosition(
  activity: ScheduleActivity,
  index: number,
  savedLayout: LogicNetworkLayout | undefined,
  scheduleHints?: LogicNetworkLayoutScheduleHints,
): LogicNetworkNodePosition {
  const position = savedLayout
    ? { x: savedLayout.x, y: savedLayout.y }
    : autoLayoutNodePosition(activity, index);
  assertTopologyOnlyLayout(activity, position, scheduleHints);
  return position;
}

export function buildAutoLayoutFromActivities(
  activities: ScheduleActivity[],
  logicLinks: CpmLogicLink[],
): LogicNetworkLayout[] {
  return autoLayoutLogicNetwork({ activities, logicLinks }).layout;
}
