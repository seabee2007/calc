import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, LogicNetworkLayout } from '../cpmTypes';
import { sanitizeLogicLinksForActivities } from '../scheduleAssumptions';
import type { GraphLayoutNode } from '../logicNetworkLayout';

/** Matches fixed `LOGIC_NODE_WIDTH` on CpmActivityNode. */
export const LOGIC_NETWORK_NODE_WIDTH = 220;
export const LOGIC_NETWORK_NODE_HEIGHT = 118;

export const LOGIC_NETWORK_AUTO_LAYOUT_START_X = 80;
export const LOGIC_NETWORK_AUTO_LAYOUT_START_Y = 80;
export const LOGIC_NETWORK_COLUMN_SPACING = 280;
export const LOGIC_NETWORK_ROW_SPACING = 190;
export const LOGIC_NETWORK_DIVISION_COLUMN_SPACING = 420;
export const LOGIC_NETWORK_ACTIVITY_ROW_SPACING = 150;
export const LOGIC_NETWORK_LINKED_UNLINKED_GAP = 300;

export const CIRCULAR_LOGIC_AUTO_LAYOUT_WARNING =
  'Circular logic detected. Auto layout used division grouping.';

export interface AutoLayoutLogicNetworkResult {
  layout: LogicNetworkLayout[];
  warning?: string;
}

interface LayoutOrigin {
  x: number;
  y: number;
}

interface DependencyLayoutResult {
  layout: LogicNetworkLayout[];
  maxY: number;
}

export function getDivisionCode(activity: ScheduleActivity): string {
  return activity.divisionCode?.trim() || 'Other';
}

export function getActivitySortKey(activity: ScheduleActivity): string[] {
  return [
    getDivisionCode(activity),
    activity.workPackageName?.trim() ?? '',
    activity.activityCode,
    activity.activityDescription,
  ];
}

function compareActivities(a: ScheduleActivity, b: ScheduleActivity): number {
  const keyA = getActivitySortKey(a);
  const keyB = getActivitySortKey(b);
  for (let index = 0; index < keyA.length; index += 1) {
    const diff = keyA[index]!.localeCompare(keyB[index]!, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareDivisionCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function buildAdjacencyMaps(
  codes: string[],
  links: CpmLogicLink[],
): {
  predecessorsByCode: Map<string, string[]>;
  successorsByCode: Map<string, string[]>;
} {
  const predecessorsByCode = new Map<string, string[]>();
  const successorsByCode = new Map<string, string[]>();

  for (const code of codes) {
    predecessorsByCode.set(code, []);
    successorsByCode.set(code, []);
  }

  for (const link of links) {
    if (
      predecessorsByCode.has(link.predecessorActivityCode) &&
      successorsByCode.has(link.successorActivityCode)
    ) {
      successorsByCode.get(link.predecessorActivityCode)!.push(link.successorActivityCode);
      predecessorsByCode.get(link.successorActivityCode)!.push(link.predecessorActivityCode);
    }
  }

  return { predecessorsByCode, successorsByCode };
}

export function detectCycle(codes: string[], links: CpmLogicLink[]): boolean {
  const { predecessorsByCode, successorsByCode } = buildAdjacencyMaps(codes, links);
  const inDegree = new Map<string, number>();

  for (const code of codes) {
    inDegree.set(code, predecessorsByCode.get(code)?.length ?? 0);
  }

  const queue = codes.filter((code) => (inDegree.get(code) ?? 0) === 0);
  const visited: string[] = [];

  while (queue.length > 0) {
    const code = queue.shift()!;
    visited.push(code);
    for (const successor of successorsByCode.get(code) ?? []) {
      const nextDegree = (inDegree.get(successor) ?? 0) - 1;
      inDegree.set(successor, nextDegree);
      if (nextDegree === 0) {
        queue.push(successor);
      }
    }
  }

  return visited.length < codes.length;
}

export function getTopologicalColumns(
  codes: string[],
  links: CpmLogicLink[],
): Map<string, number> {
  const { predecessorsByCode, successorsByCode } = buildAdjacencyMaps(codes, links);
  const inDegree = new Map<string, number>();

  for (const code of codes) {
    inDegree.set(code, predecessorsByCode.get(code)?.length ?? 0);
  }

  const queue = [...codes]
    .filter((code) => (inDegree.get(code) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const topoOrder: string[] = [];

  while (queue.length > 0) {
    const code = queue.shift()!;
    topoOrder.push(code);
    for (const successor of successorsByCode.get(code) ?? []) {
      const nextDegree = (inDegree.get(successor) ?? 0) - 1;
      inDegree.set(successor, nextDegree);
      if (nextDegree === 0) {
        queue.push(successor);
        queue.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
      }
    }
  }

  const columnByCode = new Map<string, number>();
  for (const code of topoOrder) {
    const predecessors = predecessorsByCode.get(code) ?? [];
    if (predecessors.length === 0) {
      columnByCode.set(code, 0);
      continue;
    }
    const maxPredecessorColumn = Math.max(
      ...predecessors.map((predecessor) => columnByCode.get(predecessor) ?? 0),
    );
    columnByCode.set(code, maxPredecessorColumn + 1);
  }

  for (const code of codes) {
    if (!columnByCode.has(code)) {
      columnByCode.set(code, 0);
    }
  }

  return columnByCode;
}

export function layoutByDivision(
  activities: ScheduleActivity[],
  origin: LayoutOrigin = {
    x: LOGIC_NETWORK_AUTO_LAYOUT_START_X,
    y: LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
  },
): LogicNetworkLayout[] {
  const activitiesByDivision = new Map<string, ScheduleActivity[]>();

  for (const activity of activities) {
    const divisionCode = getDivisionCode(activity);
    const bucket = activitiesByDivision.get(divisionCode) ?? [];
    bucket.push(activity);
    activitiesByDivision.set(divisionCode, bucket);
  }

  const sortedDivisions = [...activitiesByDivision.keys()].sort(compareDivisionCodes);
  const layout: LogicNetworkLayout[] = [];

  sortedDivisions.forEach((divisionCode, divisionIndex) => {
    const divisionActivities = [...(activitiesByDivision.get(divisionCode) ?? [])].sort(
      compareActivities,
    );
    divisionActivities.forEach((activity, activityIndex) => {
      layout.push({
        activityCode: activity.activityCode,
        x: origin.x + divisionIndex * LOGIC_NETWORK_DIVISION_COLUMN_SPACING,
        y: origin.y + activityIndex * LOGIC_NETWORK_ACTIVITY_ROW_SPACING,
      });
    });
  });

  return layout;
}

export function layoutByDependencies(
  activities: ScheduleActivity[],
  links: CpmLogicLink[],
  origin: LayoutOrigin = {
    x: LOGIC_NETWORK_AUTO_LAYOUT_START_X,
    y: LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
  },
): DependencyLayoutResult & { graphNodes: GraphLayoutNode[] } {
  const codes = activities.map((activity) => activity.activityCode);
  const columnByCode = getTopologicalColumns(codes, links);
  const activitiesByColumn = new Map<number, ScheduleActivity[]>();

  for (const activity of activities) {
    const column = columnByCode.get(activity.activityCode) ?? 0;
    const bucket = activitiesByColumn.get(column) ?? [];
    bucket.push(activity);
    activitiesByColumn.set(column, bucket);
  }

  const sortedColumns = [...activitiesByColumn.keys()].sort((left, right) => left - right);
  const layout: LogicNetworkLayout[] = [];
  const graphNodes: GraphLayoutNode[] = [];
  let maxY = origin.y;

  for (const column of sortedColumns) {
    const columnActivities = [...(activitiesByColumn.get(column) ?? [])].sort(compareActivities);
    columnActivities.forEach((activity, rowIndex) => {
      const y = origin.y + rowIndex * LOGIC_NETWORK_ROW_SPACING;
      const x = origin.x + column * LOGIC_NETWORK_COLUMN_SPACING;
      layout.push({
        activityCode: activity.activityCode,
        x,
        y,
      });
      graphNodes.push({
        activityId: activity.activityCode,
        rank: column,
        orderInRank: rowIndex,
        x,
        y,
        durationDays: activity.durationDays,
      });
      maxY = Math.max(maxY, y);
    });
  }

  return { layout, maxY, graphNodes };
}

function getLinkedActivityCodes(links: CpmLogicLink[]): Set<string> {
  const linkedCodes = new Set<string>();
  for (const link of links) {
    linkedCodes.add(link.predecessorActivityCode);
    linkedCodes.add(link.successorActivityCode);
  }
  return linkedCodes;
}

export function autoLayoutLogicNetwork({
  activities,
  logicLinks,
}: {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  existingLayout?: LogicNetworkLayout[];
}): AutoLayoutLogicNetworkResult {
  if (activities.length === 0) {
    return { layout: [] };
  }

  const validActivityCodes = new Set(activities.map((activity) => activity.activityCode));
  const sanitizedLinks = sanitizeLogicLinksForActivities(logicLinks, validActivityCodes);

  if (sanitizedLinks.length === 0) {
    return { layout: layoutByDivision(activities) };
  }

  const linkedCodes = getLinkedActivityCodes(sanitizedLinks);
  const linkedCodesList = [...linkedCodes].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );

  if (detectCycle(linkedCodesList, sanitizedLinks)) {
    return {
      layout: layoutByDivision(activities),
      warning: CIRCULAR_LOGIC_AUTO_LAYOUT_WARNING,
    };
  }

  const linkedActivities = activities.filter((activity) =>
    linkedCodes.has(activity.activityCode),
  );
  const unlinkedActivities = activities.filter(
    (activity) => !linkedCodes.has(activity.activityCode),
  );

  const linkedLinks = sanitizedLinks.filter(
    (link) =>
      linkedCodes.has(link.predecessorActivityCode) &&
      linkedCodes.has(link.successorActivityCode),
  );

  const linkedResult = layoutByDependencies(linkedActivities, linkedLinks);
  const unlinkedLayout =
    unlinkedActivities.length > 0
      ? layoutByDivision(unlinkedActivities, {
          x: LOGIC_NETWORK_AUTO_LAYOUT_START_X,
          y: linkedResult.maxY + LOGIC_NETWORK_LINKED_UNLINKED_GAP,
        })
      : [];

  if (import.meta.env.DEV) {
    console.table(
      linkedResult.graphNodes.map((node) => ({
        activityId: node.activityId,
        rank: node.rank,
        x: node.x,
        y: node.y,
        durationDays: node.durationDays,
        earlyStart: undefined,
        leveledOffsetDays: undefined,
      })),
    );
  }

  return {
    layout: [...linkedResult.layout, ...unlinkedLayout],
  };
}
