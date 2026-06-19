import { describe, expect, it, vi, beforeEach } from 'vitest';
import { addBimTakeoffToEstimate } from '../application/bimTakeoffToEstimate';

const instantiateMock = vi.fn();
const createTakeoffMock = vi.fn();
const updateObjectMock = vi.fn();

vi.mock('../../estimating/application/constructionActivityService', () => ({
  instantiateAndSaveFromProductionRateAssembly: (...args: unknown[]) => instantiateMock(...args),
}));

vi.mock('../services/bimModelService', () => ({
  createTakeoffItem: (...args: unknown[]) => createTakeoffMock(...args),
  updateObjectTakeoffStatus: (...args: unknown[]) => updateObjectMock(...args),
}));

describe('addBimTakeoffToEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    instantiateMock.mockResolvedValue({
      data: {
        activity: {
          id: 'act-1',
          projectId: 'proj-1',
          divisionCode: '06',
          divisionName: 'Wood',
          activityCode: '06-01-01',
          title: 'Decking',
          scheduleEnabled: true,
          crewSize: 4,
          hoursPerDay: 8,
          productionFactor: 1,
          calculatedManHours: 10,
          calculatedManDays: 1.25,
          calculatedDurationDays: 1,
          effectiveDurationDays: 1,
        },
        lineItems: [
          {
            id: 'line-1',
            projectActivityId: 'act-1',
            projectId: 'proj-1',
            name: 'Decking',
            unit: 'SF',
            quantity: 100,
            manHoursPerUnit: 0.1,
            productionFactor: 1,
            calculatedManHours: 10,
            laborCost: 0,
            materialCost: 0,
            equipmentCost: 0,
          },
        ],
      },
      error: null,
    });
    createTakeoffMock.mockResolvedValue({
      data: { id: 'takeoff-1' },
      error: null,
    });
    updateObjectMock.mockResolvedValue({ data: {}, error: null });
  });

  it('calls production-rate save and writes bim_takeoff_items with estimate_line_id', async () => {
    const result = await addBimTakeoffToEstimate({
      projectId: 'proj-1',
      estimateId: 'est-1',
      modelId: 'model-1',
      bimObjectId: 'obj-1',
      group: {
        divisionCode: '06',
        divisionName: 'Wood',
        category: 'Decking',
        rates: [],
        defaultTitle: 'Decking',
        suggestedCrewSize: 4,
        suggestedHoursPerDay: 8,
      },
      selectedLineItems: [{ rateId: 'rate-1', quantity: 100 }],
      quantity: 100,
      unit: 'SF',
      source: 'measured_from_model',
      confidence: 'measured_from_model',
      metadata: {
        measurement_type: 'area',
        converted_quantity: 100,
        converted_unit: 'SF',
      },
      identity: { activityName: 'Decking' },
      existingActivities: [],
      projectLaborRates: [],
    });

    expect(instantiateMock).toHaveBeenCalled();
    expect(createTakeoffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateLineId: 'line-1',
        modelId: 'model-1',
        objectId: 'obj-1',
        quantity: 100,
        unit: 'SF',
        metadata: {
          measurement_type: 'area',
          converted_quantity: 100,
          converted_unit: 'SF',
        },
      }),
    );
    expect(result.data?.estimateLineId).toBe('line-1');
  });
});
