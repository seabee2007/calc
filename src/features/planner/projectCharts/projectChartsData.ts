import { calculateEstimateTotalsFromConstructionActivities } from '../../estimating/application/constructionActivityEstimateTotals';
import type { CurrentEstimate } from '../../estimating/application/currentEstimateService';
import { parseEstimateSettingsFromAssumptions } from '../../estimating/application/estimateSettings';
import type { ProjectConstructionActivity } from '../../estimating/domain/constructionActivityTypes';
import { isRfiClosed } from '../../../services/rfiService';
import type { ChangeOrder } from '../../../types/changeOrder';
import type { QCRecord } from '../../../types';
import type { RfiRequest } from '../../../types/fieldPlanner';
import {
  countOverallocatedDays,
  countScheduleActivitiesMissingLogic,
  countScheduledConstructionActivities,
  extractProjectChartsScheduleState,
  peakRequiredCrew,
  type ProjectChartsScheduleState,
} from './projectChartsScheduleState';
import type {
  ProjectChartsChangeOrderImpact,
  ProjectChartsCostHealth,
  ProjectChartsLaborDemand,
  ProjectChartsQcRiskSnapshot,
  ProjectChartsScheduleReadiness,
  ProjectChartsScopeByDivision,
  ProjectChartsSnapshot,
  DivisionScopeRollup,
} from './projectChartsTypes';

const PENDING_CHANGE_ORDER_STATUSES = new Set(['draft', 'sent', 'viewed']);
const APPROVED_CHANGE_ORDER_STATUSES = new Set(['accepted']);
const DECLINED_CHANGE_ORDER_STATUSES = new Set(['declined', 'void']);

export function buildCostHealthChartData(input: {
  activities: ProjectConstructionActivity[];
  estimate: CurrentEstimate | null;
}): ProjectChartsCostHealth {
  if (input.activities.length === 0) {
    return {
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      subcontractorCost: 0,
      directCostSubtotal: 0,
      finalSellPrice: null,
      hasActivities: false,
    };
  }

  const markupSettings = input.estimate
    ? parseEstimateSettingsFromAssumptions(input.estimate.assumptions)
    : undefined;
  const totals = calculateEstimateTotalsFromConstructionActivities({
    activities: input.activities,
    markupSettings,
  });

  return {
    laborCost: totals.laborCost,
    materialCost: totals.materialCost,
    equipmentCost: totals.equipmentCost,
    subcontractorCost: totals.subcontractorCost,
    directCostSubtotal: totals.directCostSubtotal,
    finalSellPrice: totals.grandTotal,
    hasActivities: true,
  };
}

export function buildScopeByDivisionChartData(
  activities: ProjectConstructionActivity[],
): ProjectChartsScopeByDivision {
  const map = new Map<string, DivisionScopeRollup>();

  for (const activity of activities) {
    const key = activity.divisionCode;
    const existing = map.get(key) ?? {
      divisionCode: activity.divisionCode,
      divisionName: activity.divisionName,
      activityCount: 0,
      totalManHours: 0,
      laborCost: 0,
    };
    existing.activityCount += 1;
    existing.totalManHours += activity.calculatedManHours ?? 0;
    existing.laborCost += activity.totalLaborCost ?? 0;
    map.set(key, existing);
  }

  return {
    divisions: [...map.values()].sort((left, right) =>
      left.divisionCode.localeCompare(right.divisionCode),
    ),
    totalActivities: activities.length,
  };
}

export function buildLaborDemandChartData(
  scheduleState: ProjectChartsScheduleState,
): ProjectChartsLaborDemand {
  const hasCpm = scheduleState.cpmResult?.hasRunCpm === true;
  const histogram = hasCpm ? scheduleState.resourceHistogram : [];

  return {
    hasCpm,
    peakCrew: hasCpm ? peakRequiredCrew(histogram) : 0,
    availableCrew: scheduleState.availableCrewSize,
    overallocatedDays: hasCpm ? countOverallocatedDays(histogram) : 0,
    histogram,
  };
}

export function buildScheduleReadinessChartData(input: {
  constructionActivities: ProjectConstructionActivity[];
  scheduleState: ProjectChartsScheduleState;
}): ProjectChartsScheduleReadiness {
  const hasCpm = input.scheduleState.cpmResult?.hasRunCpm === true;

  return {
    scheduledActivities: countScheduledConstructionActivities(input.constructionActivities),
    totalActivities: input.constructionActivities.length,
    activitiesMissingLogic: countScheduleActivitiesMissingLogic(
      input.scheduleState.scheduleActivities,
      input.scheduleState.logicLinks,
    ),
    criticalActivityCount: hasCpm
      ? (input.scheduleState.cpmResult?.validCriticalPathActivityCodes.length ?? 0)
      : null,
    projectDurationDays: hasCpm
      ? (input.scheduleState.cpmResult?.projectDurationDays ?? null)
      : null,
    hasCpm,
    cpmStale: Boolean(input.scheduleState.cpmWarningMessage),
  };
}

export function buildQcRiskSnapshotChartData(input: {
  qcRecords: QCRecord[];
  qcAlerts: { openThisWeek: number; overdue: number };
  rfis: RfiRequest[];
  workflowStageLabel: string | null;
}): ProjectChartsQcRiskSnapshot {
  const openRfiCount = input.rfis.filter((rfi) => !isRfiClosed(rfi.status)).length;

  return {
    openQcItems: input.qcRecords.length,
    dueQcItems: input.qcAlerts.openThisWeek,
    overdueQcItems: input.qcAlerts.overdue,
    qcRecordCount: input.qcRecords.length,
    openRfiCount,
    riskLabel: input.workflowStageLabel,
    hasAnyData:
      input.qcRecords.length > 0 ||
      input.qcAlerts.openThisWeek > 0 ||
      input.qcAlerts.overdue > 0 ||
      openRfiCount > 0,
  };
}

export function buildChangeOrderImpactChartData(
  changeOrders: ChangeOrder[],
): ProjectChartsChangeOrderImpact {
  const statusMap = new Map<string, { count: number; value: number }>();
  let pendingValue = 0;
  let approvedValue = 0;
  let declinedValue = 0;

  for (const order of changeOrders) {
    const total = Number.isFinite(order.total) ? order.total : 0;
    const existing = statusMap.get(order.status) ?? { count: 0, value: 0 };
    existing.count += 1;
    existing.value += total;
    statusMap.set(order.status, existing);

    if (PENDING_CHANGE_ORDER_STATUSES.has(order.status)) pendingValue += total;
    else if (APPROVED_CHANGE_ORDER_STATUSES.has(order.status)) approvedValue += total;
    else if (DECLINED_CHANGE_ORDER_STATUSES.has(order.status)) declinedValue += total;
  }

  return {
    pendingValue,
    approvedValue,
    declinedValue,
    statusCounts: [...statusMap.entries()]
      .map(([status, entry]) => ({ status, count: entry.count, value: entry.value }))
      .sort((left, right) => left.status.localeCompare(right.status)),
    totalCount: changeOrders.length,
  };
}

export function buildProjectChartsSnapshotFromInputs(input: {
  estimate: CurrentEstimate | null;
  activities: ProjectConstructionActivity[];
  projectCrewSize?: number | null;
  qcRecords: QCRecord[];
  qcAlerts: { openThisWeek: number; overdue: number };
  rfis: RfiRequest[];
  changeOrders: ChangeOrder[];
  workflowStageLabel: string | null;
}): ProjectChartsSnapshot {
  const scheduleState = extractProjectChartsScheduleState({
    estimate: input.estimate,
    constructionActivities: input.activities,
    projectCrewSize: input.projectCrewSize,
  });

  return {
    costHealth: buildCostHealthChartData({
      activities: input.activities,
      estimate: input.estimate,
    }),
    scopeByDivision: buildScopeByDivisionChartData(input.activities),
    laborDemand: buildLaborDemandChartData(scheduleState),
    scheduleReadiness: buildScheduleReadinessChartData({
      constructionActivities: input.activities,
      scheduleState,
    }),
    qcRisk: buildQcRiskSnapshotChartData({
      qcRecords: input.qcRecords,
      qcAlerts: input.qcAlerts,
      rfis: input.rfis,
      workflowStageLabel: input.workflowStageLabel,
    }),
    changeOrders: buildChangeOrderImpactChartData(input.changeOrders),
  };
}
