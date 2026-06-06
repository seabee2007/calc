import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmActivityResult, CpmLogicLink, CpmRelationshipType, CpmResult } from '../cpmTypes';

export interface CalculateCpmParams {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  projectStartDay?: number;
}

// ── Internal node ────────────────────────────────────────────────────────────

interface CpmNode {
  activityCode: string;
  durationDays: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

// ── Forward pass helpers ─────────────────────────────────────────────────────

/** Earliest possible ES for the successor given one predecessor and a link. */
function fsConstraintStart(predEF: number, lag: number): number {
  return predEF + lag;
}

function ssConstraintStart(predES: number, lag: number): number {
  return predES + lag;
}

function ffConstraintStart(predEF: number, lag: number, succDuration: number): number {
  return predEF + lag - succDuration;
}

function sfConstraintStart(predES: number, lag: number, succDuration: number): number {
  return predES + lag - succDuration;
}

/** Returns the minimum ES this link imposes on the successor. */
function constrainedStart(
  link: CpmLogicLink,
  relationshipType: CpmRelationshipType,
  pred: CpmNode,
  succDuration: number,
): number {
  switch (relationshipType) {
    case 'SS':
      return ssConstraintStart(pred.earlyStart, link.lagDays);
    case 'FF':
      return ffConstraintStart(pred.earlyFinish, link.lagDays, succDuration);
    case 'SF':
      return sfConstraintStart(pred.earlyStart, link.lagDays, succDuration);
    case 'FS':
    default:
      return fsConstraintStart(pred.earlyFinish, link.lagDays);
  }
}

// ── Backward pass helpers ────────────────────────────────────────────────────

/** Returns the latest LF this link allows the predecessor (constraining backward). */
function constrainedPredLF(
  link: CpmLogicLink,
  relationshipType: CpmRelationshipType,
  succ: CpmNode,
  predDuration: number,
): number {
  switch (relationshipType) {
    case 'SS':
      return succ.lateStart - link.lagDays + predDuration;
    case 'FF':
      return succ.lateFinish - link.lagDays;
    case 'SF':
      return succ.lateFinish - link.lagDays + predDuration;
    case 'FS':
    default:
      return succ.lateStart - link.lagDays;
  }
}

// ── Topological sort (Kahn's algorithm) ─────────────────────────────────────

function topoSort(
  codes: string[],
  successorMap: Map<string, string[]>,
  predecessorMap: Map<string, string[]>,
): { order: string[]; hasCycle: boolean } {
  const inDegree = new Map<string, number>();
  for (const code of codes) inDegree.set(code, 0);
  for (const [, succs] of successorMap) {
    for (const succ of succs) {
      inDegree.set(succ, (inDegree.get(succ) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [code, deg] of inDegree) {
    if (deg === 0) queue.push(code);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const succ of successorMap.get(current) ?? []) {
      const newDeg = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  return { order, hasCycle: order.length < codes.length };
}

// ── Main function ─────────────────────────────────────────────────────────────

export function calculateCpm(params: CalculateCpmParams): CpmResult {
  const warnings: string[] = [];
  const { activities, logicLinks, projectStartDay = 0 } = params;

  if (activities.length === 0) {
    return { activities: [], projectDurationDays: 0, criticalPathActivityCodes: [], warnings };
  }

  // Validate unique codes
  const codeSet = new Set<string>();
  const duplicates: string[] = [];
  for (const activity of activities) {
    if (codeSet.has(activity.activityCode)) {
      duplicates.push(activity.activityCode);
    }
    codeSet.add(activity.activityCode);
  }
  if (duplicates.length > 0) {
    warnings.push(`Duplicate activity codes found: ${duplicates.join(', ')}.`);
  }

  // Validate logic link predecessors exist
  for (const link of logicLinks) {
    if (!codeSet.has(link.predecessorActivityCode)) {
      warnings.push(
        `Logic link references missing predecessor "${link.predecessorActivityCode}" for "${link.successorActivityCode}".`,
      );
    }
    if (!codeSet.has(link.successorActivityCode)) {
      warnings.push(
        `Logic link references missing successor "${link.successorActivityCode}".`,
      );
    }
  }

  // Build successor / predecessor maps (only valid links)
  const validLinks = logicLinks.filter(
    (l) => codeSet.has(l.predecessorActivityCode) && codeSet.has(l.successorActivityCode),
  );

  const successorMap = new Map<string, string[]>();
  const predecessorMap = new Map<string, string[]>();
  const linkMap = new Map<string, CpmLogicLink[]>(); // key = successorCode

  for (const code of codeSet) {
    successorMap.set(code, []);
    predecessorMap.set(code, []);
    linkMap.set(code, []);
  }

  for (const link of validLinks) {
    successorMap.get(link.predecessorActivityCode)!.push(link.successorActivityCode);
    predecessorMap.get(link.successorActivityCode)!.push(link.predecessorActivityCode);
    linkMap.get(link.successorActivityCode)!.push(link);
  }

  const codes = [...codeSet];
  const { order, hasCycle } = topoSort(codes, successorMap, predecessorMap);

  if (hasCycle) {
    warnings.push('Circular dependency detected. Some activities will be scheduled from project start.');
    // Add unscheduled codes at the end (they'll get default ES = projectStartDay)
    const orderedSet = new Set(order);
    for (const code of codes) {
      if (!orderedSet.has(code)) order.push(code);
    }
  }

  const activityByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const nodes = new Map<string, CpmNode>();

  // Initialize nodes
  for (const code of codes) {
    const activity = activityByCode.get(code);
    nodes.set(code, {
      activityCode: code,
      durationDays: activity?.durationDays ?? 1,
      earlyStart: projectStartDay,
      earlyFinish: projectStartDay + (activity?.durationDays ?? 1),
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: false,
    });
  }

  // Forward pass
  for (const code of order) {
    const node = nodes.get(code)!;
    let es = projectStartDay;

    for (const link of linkMap.get(code) ?? []) {
      const pred = nodes.get(link.predecessorActivityCode);
      if (!pred) continue;
      const constrained = constrainedStart(link, link.relationshipType, pred, node.durationDays);
      if (constrained > es) es = constrained;
    }

    node.earlyStart = Math.max(projectStartDay, es);
    node.earlyFinish = node.earlyStart + node.durationDays;
  }

  // Project finish = max EF
  const projectFinish = Math.max(...[...nodes.values()].map((n) => n.earlyFinish));

  // Build successor links map (key = predecessorCode)
  const succLinkMap = new Map<string, CpmLogicLink[]>();
  for (const code of codes) succLinkMap.set(code, []);
  for (const link of validLinks) {
    succLinkMap.get(link.predecessorActivityCode)!.push(link);
  }

  // Backward pass (reverse topo order)
  for (const code of [...order].reverse()) {
    const node = nodes.get(code)!;
    const succLinks = succLinkMap.get(code) ?? [];

    if (succLinks.length === 0) {
      node.lateFinish = projectFinish;
    } else {
      let lf = Infinity;
      for (const link of succLinks) {
        const succ = nodes.get(link.successorActivityCode);
        if (!succ) continue;
        const constrainedLF = constrainedPredLF(link, link.relationshipType, succ, node.durationDays);
        if (constrainedLF < lf) lf = constrainedLF;
      }
      node.lateFinish = Number.isFinite(lf) ? lf : projectFinish;
    }

    node.lateStart = node.lateFinish - node.durationDays;
  }

  // Float + critical
  for (const node of nodes.values()) {
    node.totalFloat = node.lateStart - node.earlyStart;
    node.isCritical = node.totalFloat <= 0;
  }

  // Free float: min gap to each successor minus own EF (FS only for simplicity)
  for (const code of codes) {
    const node = nodes.get(code)!;
    const succLinks = succLinkMap.get(code) ?? [];

    if (succLinks.length === 0) {
      node.freeFloat = projectFinish - node.earlyFinish;
    } else {
      let minGap = Infinity;
      for (const link of succLinks) {
        const succ = nodes.get(link.successorActivityCode);
        if (!succ) continue;
        const gap = succ.earlyStart - node.earlyFinish - link.lagDays;
        if (gap < minGap) minGap = gap;
      }
      node.freeFloat = Number.isFinite(minGap) ? Math.max(0, minGap) : 0;
    }
  }

  const resultActivities: CpmActivityResult[] = [...nodes.values()].map((node) => ({
    activityCode: node.activityCode,
    earlyStart: node.earlyStart,
    earlyFinish: node.earlyFinish,
    lateStart: node.lateStart,
    lateFinish: node.lateFinish,
    totalFloat: node.totalFloat,
    freeFloat: node.freeFloat,
    isCritical: node.isCritical,
  }));

  const criticalPathActivityCodes = resultActivities
    .filter((a) => a.isCritical)
    .map((a) => a.activityCode);

  return {
    activities: resultActivities,
    projectDurationDays: projectFinish - projectStartDay,
    criticalPathActivityCodes,
    warnings,
  };
}
