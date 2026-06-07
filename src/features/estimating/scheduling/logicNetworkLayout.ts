import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmLogicLink, LogicNetworkLayout } from './cpmTypes';
import { autoLayoutLogicNetwork } from './logic/autoLayoutLogicNetwork';

export const LOGIC_NETWORK_CANVAS_HEIGHT_CLASS = 'h-[calc(100vh-300px)] min-h-[640px] w-full';

export const LOGIC_NETWORK_AUTO_LAYOUT_X_SPACING = 160;
export const LOGIC_NETWORK_AUTO_LAYOUT_Y_GAP = 120;

export interface LogicNetworkNodePosition {
  x: number;
  y: number;
}

/** Auto-layout from CPM early start + row index when no saved position exists. */
export function autoLayoutNodePosition(
  activity: ScheduleActivity,
  index: number,
  cpm?: CpmActivityResult,
): LogicNetworkNodePosition {
  return {
    x: (cpm?.earlyStart ?? 0) * LOGIC_NETWORK_AUTO_LAYOUT_X_SPACING,
    y: index * LOGIC_NETWORK_AUTO_LAYOUT_Y_GAP,
  };
}

export function resolveLogicNetworkNodePosition(
  activity: ScheduleActivity,
  index: number,
  savedLayout: LogicNetworkLayout | undefined,
  cpm?: CpmActivityResult,
): LogicNetworkNodePosition {
  if (savedLayout) {
    return { x: savedLayout.x, y: savedLayout.y };
  }
  return autoLayoutNodePosition(activity, index, cpm);
}

export function buildAutoLayoutFromActivities(
  activities: ScheduleActivity[],
  logicLinks: CpmLogicLink[],
): LogicNetworkLayout[] {
  return autoLayoutLogicNetwork({ activities, logicLinks }).layout;
}
