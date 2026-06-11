import { describe, expect, it } from 'vitest';
import type { CurrentEstimate } from '../../../estimating/application/currentEstimateService';
import { DEFAULT_ESTIMATE_SETTINGS } from '../../../estimating/application/estimateSettings';
import type { ProjectConstructionActivity } from '../../../estimating/domain/constructionActivityTypes';
import { constructionActivitiesToScheduleActivities } from '../../../estimating/scheduling/adapters/constructionActivitiesToScheduleActivities';
import { buildPrecedenceDiagramRunState } from '../../../estimating/scheduling/precedenceDiagram';
import { precedenceDiagramToAssumptions } from '../../../estimating/scheduling/precedenceDiagram';
import type { ScheduleActivity } from '../../../estimating/scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { ChangeOrder } from '../../../../types/changeOrder';
import {
  buildChangeOrderImpactChartData,
  buildCostHealthChartData,
  buildLaborDemandChartData,
  buildProjectChartsSnapshotFromInputs,
  buildQcRiskSnapshotChartData,
  buildScheduleReadinessChartData,
  buildScopeByDivisionChartData,
} from '../projectChartsData';
import {
  extractProjectChartsScheduleState,
  countScheduleActivitiesMissingLogic,
} from '../projectChartsScheduleState';
import {
  projectChartsCostHealthHref,
  projectChartsLaborDemandHref,
  projectChartsScheduleReadinessHref,
  projectChartsScopeHref,
} from '../projectChartLinks';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'act-1',
    projectId: 'project-1',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-01-01',
    title: 'Slab',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 40,
    totalLaborCost: 2500,
    ...overrides,
  };
}

function makeScheduleActivity(code: string): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '03',
    divisionName: 'Concrete',
    durationDays: 2,
    laborHours: 16,
    manDays: 2,
    crewDays: 2,
    crewSize: 4,
    totalCost: 2500,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

describe('projectChartsData', () => {
  it('builds cost health from activity labor cost', () => {
    const result = buildCostHealthChartData({
      activities: [
        makeActivity({ totalLaborCost: 2500 }),
        makeActivity({
          id: 'act-2',
          activityCode: '03-01-02',
          totalLaborCost: 1830.97,
          calculatedManHours: 20,
        }),
      ],
      estimate: {
        assumptions: { estimateSettings: DEFAULT_ESTIMATE_SETTINGS },
      } as CurrentEstimate,
    });

    expect(result.hasActivities).toBe(true);
    expect(result.laborCost).toBe(4330.97);
    expect(result.materialCost).toBe(0);
    expect(result.directCostSubtotal).toBe(4330.97);
    expect(result.finalSellPrice).toBe(4330.97);
  });

  it('groups scope by division with man-hours and labor cost', () => {
    const result = buildScopeByDivisionChartData([
      makeActivity({ divisionCode: '03', totalLaborCost: 1000, calculatedManHours: 10 }),
      makeActivity({
        id: 'act-2',
        divisionCode: '03',
        activityCode: '03-01-02',
        totalLaborCost: 500,
        calculatedManHours: 5,
      }),
      makeActivity({
        id: 'act-3',
        divisionCode: '06',
        divisionName: 'Wood',
        activityCode: '06-01-01',
        totalLaborCost: 800,
        calculatedManHours: 12,
      }),
    ]);

    expect(result.totalActivities).toBe(3);
    expect(result.divisions).toHaveLength(2);
    const concrete = result.divisions.find((division) => division.divisionCode === '03');
    expect(concrete?.activityCount).toBe(2);
    expect(concrete?.laborCost).toBe(1500);
    expect(concrete?.totalManHours).toBe(15);
  });

  it('shows labor demand empty state when CPM has not been run', () => {
    const scheduleState = extractProjectChartsScheduleState({
      estimate: null,
      constructionActivities: [],
    });
    const result = buildLaborDemandChartData(scheduleState);
    expect(result.hasCpm).toBe(false);
    expect(result.histogram).toEqual([]);
  });

  it('builds schedule readiness stats when CPM exists', () => {
    const activities = [
      makeActivity({
        scheduleEnabled: true,
        effectiveDurationDays: 5,
        calculatedDurationDays: 5,
      }),
      makeActivity({
        id: 'act-2',
        activityCode: '03-01-02',
        scheduleEnabled: true,
        effectiveDurationDays: 2,
        calculatedDurationDays: 2,
      }),
    ];
    const { activities: scheduleActivities } = constructionActivitiesToScheduleActivities(activities);
    const logicLinks = [
      {
        predecessorActivityCode: '03-01-01',
        successorActivityCode: '03-01-02',
        relationshipType: 'FS' as const,
        lagDays: 0,
        predecessorRuntimeId: 'act-1',
        successorRuntimeId: 'act-2',
      },
    ];
    const scheduleSettings = {
      projectStartDate: '2026-06-01',
      hoursPerDay: 8,
      availableCrewSize: 8,
      includeWeekends: false,
    };
    const precedenceDiagram = buildPrecedenceDiagramRunState({
      activities: scheduleActivities,
      logicLinks,
      scheduleSettings,
    });
    const estimate = {
      estimateType: 'detailed',
      schedulingEnabled: true,
      assumptions: precedenceDiagramToAssumptions(precedenceDiagram, {
        logicLinks,
        scheduleSettings,
      }),
      lineItems: [],
    } as CurrentEstimate;

    const scheduleState = extractProjectChartsScheduleState({
      estimate,
      constructionActivities: activities,
      projectCrewSize: 8,
    });

    const readiness = buildScheduleReadinessChartData({
      constructionActivities: activities,
      scheduleState,
    });

    expect(readiness.scheduledActivities).toBe(2);
    expect(readiness.totalActivities).toBe(2);
    expect(readiness.hasCpm).toBe(true);
    expect(readiness.projectDurationDays).not.toBeNull();
    expect(readiness.criticalActivityCount).not.toBeNull();
  });

  it('does not include planned-vs-actual fields in schedule readiness', () => {
    const readiness = buildScheduleReadinessChartData({
      constructionActivities: [makeActivity()],
      scheduleState: extractProjectChartsScheduleState({
        estimate: null,
        constructionActivities: [makeActivity()],
      }),
    });

    expect(readiness).not.toHaveProperty('plannedVsActual');
    expect(readiness).not.toHaveProperty('percentComplete');
  });

  it('handles QC/Risk card with no records', () => {
    const result = buildQcRiskSnapshotChartData({
      qcRecords: [],
      qcAlerts: { openThisWeek: 0, overdue: 0 },
      rfis: [],
      workflowStageLabel: null,
    });
    expect(result.hasAnyData).toBe(false);
  });

  it('handles change order card with no records', () => {
    const result = buildChangeOrderImpactChartData([]);
    expect(result.totalCount).toBe(0);
    expect(result.pendingValue).toBe(0);
  });

  it('summarizes change orders by status', () => {
    const result = buildChangeOrderImpactChartData([
      { status: 'draft', total: 1000 } as ChangeOrder,
      { status: 'accepted', total: 5000 } as ChangeOrder,
      { status: 'declined', total: 250 } as ChangeOrder,
    ]);
    expect(result.pendingValue).toBe(1000);
    expect(result.approvedValue).toBe(5000);
    expect(result.declinedValue).toBe(250);
    expect(result.totalCount).toBe(3);
  });

  it('builds empty snapshot safely when project has no data', () => {
    const snapshot = buildProjectChartsSnapshotFromInputs({
      estimate: null,
      activities: [],
      projectCrewSize: 8,
      qcRecords: [],
      qcAlerts: { openThisWeek: 0, overdue: 0 },
      rfis: [],
      changeOrders: [],
      workflowStageLabel: null,
    });

    expect(snapshot.costHealth.hasActivities).toBe(false);
    expect(snapshot.laborDemand.hasCpm).toBe(false);
    expect(snapshot.qcRisk.hasAnyData).toBe(false);
    expect(snapshot.changeOrders.totalCount).toBe(0);
  });

  it('counts activities missing logic', () => {
    expect(
      countScheduleActivitiesMissingLogic(
        [makeScheduleActivity('A'), makeScheduleActivity('B')],
        [],
      ),
    ).toBe(2);
    expect(
      countScheduleActivitiesMissingLogic(
        [makeScheduleActivity('A'), makeScheduleActivity('B')],
        [
          {
            predecessorActivityCode: 'A',
            successorActivityCode: 'B',
            relationshipType: 'FS',
            lagDays: 0,
          },
        ],
      ),
    ).toBe(0);
  });
});

describe('projectChartLinks', () => {
  it('routes chart cards to the correct planner destinations', () => {
    expect(projectChartsCostHealthHref('proj-1')).toContain('/planner/estimate/overview');
    expect(projectChartsScopeHref('proj-1')).toContain('/planner/estimate');
    expect(projectChartsLaborDemandHref('proj-1')).toContain('/planner/estimate/level-iii-gantt');
    expect(projectChartsScheduleReadinessHref('proj-1')).toContain('/planner/estimate/logic-network');
  });
});
