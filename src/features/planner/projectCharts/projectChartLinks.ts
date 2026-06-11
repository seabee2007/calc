import {
  plannerChangeOrdersHref,
  plannerDocumentsHref,
  plannerEstimateHref,
} from '../../../utils/plannerRoutes';

export function projectChartsCostHealthHref(projectId: string): string {
  return plannerEstimateHref(projectId, 'overview');
}

export function projectChartsScopeHref(projectId: string): string {
  return plannerEstimateHref(projectId, 'activities');
}

export function projectChartsLaborDemandHref(projectId: string): string {
  return plannerEstimateHref(projectId, 'level-iii-gantt');
}

export function projectChartsScheduleReadinessHref(projectId: string): string {
  return plannerEstimateHref(projectId, 'logic-network');
}

export function projectChartsQcRiskHref(projectId: string): string {
  return plannerDocumentsHref(projectId, { tab: 'qc-reports' });
}

export function projectChartsRfiHref(projectId: string): string {
  return `/projects/${projectId}/planner/rfis`;
}

export function projectChartsChangeOrdersHref(projectId: string): string {
  return plannerChangeOrdersHref(projectId);
}
