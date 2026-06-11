import type { ConstructionActivityEstimateTotals } from '../../estimating/application/constructionActivityEstimateTotals';
import type { ProjectConstructionActivity } from '../../estimating/domain/constructionActivityTypes';
import type { ResourceHistogramDay } from '../../estimating/scheduling/cpmTypes';
import type { ChangeOrder } from '../../../types/changeOrder';
import type { QCRecord } from '../../../types';
import type { RfiRequest } from '../../../types/fieldPlanner';

export interface ProjectChartsCostHealth {
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  directCostSubtotal: number;
  finalSellPrice: number | null;
  hasActivities: boolean;
}

export interface DivisionScopeRollup {
  divisionCode: string;
  divisionName: string;
  activityCount: number;
  totalManHours: number;
  laborCost: number;
}

export interface ProjectChartsScopeByDivision {
  divisions: DivisionScopeRollup[];
  totalActivities: number;
}

export interface ProjectChartsLaborDemand {
  hasCpm: boolean;
  peakCrew: number;
  availableCrew: number;
  overallocatedDays: number;
  histogram: ResourceHistogramDay[];
}

export interface ProjectChartsScheduleReadiness {
  scheduledActivities: number;
  totalActivities: number;
  activitiesMissingLogic: number;
  criticalActivityCount: number | null;
  projectDurationDays: number | null;
  hasCpm: boolean;
  cpmStale: boolean;
}

export interface ProjectChartsQcRiskSnapshot {
  openQcItems: number;
  dueQcItems: number;
  overdueQcItems: number;
  qcRecordCount: number;
  openRfiCount: number;
  riskLabel: string | null;
  hasAnyData: boolean;
}

export interface ChangeOrderStatusCount {
  status: string;
  count: number;
  value: number;
}

export interface ProjectChartsChangeOrderImpact {
  pendingValue: number;
  approvedValue: number;
  declinedValue: number;
  statusCounts: ChangeOrderStatusCount[];
  totalCount: number;
}

export interface ProjectChartsSnapshot {
  costHealth: ProjectChartsCostHealth;
  scopeByDivision: ProjectChartsScopeByDivision;
  laborDemand: ProjectChartsLaborDemand;
  scheduleReadiness: ProjectChartsScheduleReadiness;
  qcRisk: ProjectChartsQcRiskSnapshot;
  changeOrders: ProjectChartsChangeOrderImpact;
}

export interface ProjectChartsRawInputs {
  activities: ProjectConstructionActivity[];
  estimateTotals: ConstructionActivityEstimateTotals | null;
  laborDemand: ProjectChartsLaborDemand;
  scheduleReadiness: ProjectChartsScheduleReadiness;
  qcRecords: QCRecord[];
  qcAlerts: { openThisWeek: number; overdue: number };
  rfis: RfiRequest[];
  changeOrders: ChangeOrder[];
  workflowStageLabel: string | null;
}
