import type { ScheduleActivity } from './adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmResult, LogicNetworkLayout } from './cpmTypes';

export const LOGIC_NETWORK_CANVAS_HEIGHT_CLASS = 'h-[calc(100vh-260px)] min-h-[640px]';

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
  cpmResult: CpmResult | null,
): LogicNetworkLayout[] {
  const cpmByCode = new Map(cpmResult?.activities.map((a) => [a.activityCode, a]) ?? []);
  return activities.map((activity, index) => {
    const pos = autoLayoutNodePosition(activity, index, cpmByCode.get(activity.activityCode));
    return {
      activityCode: activity.activityCode,
      x: pos.x,
      y: pos.y,
    };
  });
}
