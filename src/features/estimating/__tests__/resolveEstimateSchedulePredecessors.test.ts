import { describe, expect, it } from 'vitest';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import type { EstimateDomainVersion } from '../infrastructure/estimateDbTypes';

function versionWithTasks(
  tasks: EstimateDomainVersion['lineItems'],
): EstimateDomainVersion {
  return {
    id: 'version-1',
    estimateId: 'estimate-1',
    projectId: 'project-1',
    versionNumber: 1,
    versionName: 'v1',
    estimateType: 'bid',
    status: 'draft',
    snapshot: {},
    totals: {
      directCost: 0,
      indirectCost: 0,
      overhead: 0,
      profit: 0,
      contingency: 0,
      tax: 0,
      finalSellPrice: 0,
    },
    notes: null,
    lineItems: tasks,
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  };
}

describe('resolveEstimateSchedulePredecessors', () => {
  it('maps predecessorActivityCode to predecessorCandidateIds', () => {
    const plan = buildEstimateSchedulePlan({
      version: versionWithTasks([
        {
          id: 'task-1',
          lineType: 'task',
          title: 'Form slab',
          position: 0,
          activityCode: '03-01-01',
          divisionCode: '03',
          activitySequence: 1,
          lineSequence: 1,
          scheduleEnabled: true,
          overheadPercent: 0,
          profitPercent: 0,
          contingencyPercent: 0,
          taxPercent: 0,
          wastePercent: 0,
          weatherSensitive: false,
          inspectionRequired: false,
          calculatedValues: {
            metrics: { durationDays: 2, adjustedLaborHours: 16, laborHours: 16 },
          },
          lineItem: {
            id: 'task-1',
            description: 'Form slab',
            csiDivision: '03',
            quantity: { formula: 'quantity_with_waste', quantity: 100 },
            labor: {
              productionRate: 1,
              productionRateType: 'units_per_labor_hour',
              crewSize: 2,
              hoursPerDay: 8,
              laborRate: 40,
            },
          },
        },
        {
          id: 'task-2',
          lineType: 'task',
          title: 'Place concrete',
          position: 1,
          activityCode: '03-01-02',
          divisionCode: '03',
          activitySequence: 1,
          lineSequence: 2,
          predecessorActivityCode: '03-01-01',
          relationshipType: 'FS',
          lagDays: 0,
          scheduleEnabled: true,
          overheadPercent: 0,
          profitPercent: 0,
          contingencyPercent: 0,
          taxPercent: 0,
          wastePercent: 0,
          weatherSensitive: false,
          inspectionRequired: false,
          calculatedValues: {
            metrics: { durationDays: 2, adjustedLaborHours: 16, laborHours: 16 },
          },
          lineItem: {
            id: 'task-2',
            description: 'Place concrete',
            csiDivision: '03',
            quantity: { formula: 'quantity_with_waste', quantity: 100 },
            labor: {
              productionRate: 1,
              productionRateType: 'units_per_labor_hour',
              crewSize: 2,
              hoursPerDay: 8,
              laborRate: 40,
            },
          },
        },
      ]),
      estimateId: 'estimate-1',
      projectId: 'project-1',
    });

    const successor = plan.divisions[0]?.scopes[0]?.tasks.find(
      (task) => task.activityCode === '03-01-02',
    );
    const predecessor = plan.divisions[0]?.scopes[0]?.tasks.find(
      (task) => task.activityCode === '03-01-01',
    );

    expect(successor?.predecessorCandidateIds).toEqual([predecessor?.candidateId]);
  });
});
