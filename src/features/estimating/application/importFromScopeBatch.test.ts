import { vi, describe, expect, it } from 'vitest';
import { batchImportActivitiesFromScope } from './importFromScopeBatch';
import * as constructionActivityService from './constructionActivityService';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

vi.mock('./constructionActivityService', () => ({
  instantiateAndSaveManualActivity: vi.fn(),
  instantiateAndSaveFromProductionRateAssembly: vi.fn(),
}));

const EARTHWORK_RATE: ProductionRateLibraryEntry = {
  id: '31-earth-001',
  divisionCode: '31',
  divisionName: 'Earthwork',
  figure: 'Figure 5-R-9',
  figureTitle: 'Excavation',
  sourcePage: '5-R-9',
  activityName: 'Excavate common material, 0 to 6 feet deep',
  description: 'Excavate common material, 0 to 6 feet deep',
  category: 'Excavation',
  unitOfMeasure: 'Bank CYD',
  manHoursPerUnit: 0.18,
  sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
  sourceEdition: 'October 2021, Change 1 October 2022',
  referenceNote: 'Reference rate',
  keywords: ['excavate', 'earthwork'],
};

describe('batchImportActivitiesFromScope', () => {
  it('reclassifies excavation to Division 31 before save', async () => {
    const saveMock = vi.mocked(constructionActivityService.instantiateAndSaveManualActivity);
    saveMock.mockResolvedValueOnce({
      data: {
        activity: {
          id: 'act-earth',
          divisionCode: '31',
          title: 'Excavate for Foundation',
        } as never,
        lineItems: [],
      },
      error: null,
    });

    await batchImportActivitiesFromScope({
      projectId: 'project-1',
      projectLaborRates: [],
      productionRates: [],
      items: [
        {
          divisionCode: '03',
          divisionName: 'Concrete',
          activityTitle: 'Excavate for Foundation',
        },
      ],
    });

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        divisionCode: '31',
        divisionName: 'Earthwork',
      }),
    );
  });

  it('creates production-rate-backed activities when a rate is selected', async () => {
    const productionMock = vi.mocked(
      constructionActivityService.instantiateAndSaveFromProductionRateAssembly,
    );
    productionMock.mockResolvedValueOnce({
      data: {
        activity: {
          id: 'act-priced',
          divisionCode: '31',
          title: 'Excavate for Foundation',
        } as never,
        lineItems: [],
      },
      error: null,
    });

    const summary = await batchImportActivitiesFromScope({
      projectId: 'project-1',
      projectLaborRates: [],
      productionRates: [EARTHWORK_RATE],
      items: [
        {
          divisionCode: '31',
          divisionName: 'Earthwork',
          activityTitle: 'Excavate for Foundation',
          selectedProductionRateId: '31-earth-001',
          suggestedQuantity: 45,
        },
      ],
    });

    expect(productionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedLineItems: [{ rateId: '31-earth-001', quantity: 45 }],
        sourceTemplateKey: 'scope_import:31:excavate-for-foundation',
      }),
    );
    expect(summary.results[0]?.pricedWithProductionRate).toBe(true);
  });

  it('records created activities using SavedActivityBundle.activity', async () => {
    const saveMock = vi.mocked(constructionActivityService.instantiateAndSaveManualActivity);
    saveMock.mockResolvedValueOnce({
      data: {
        activity: {
          id: 'act-1',
          divisionCode: '03',
          title: 'Place Slab',
        } as never,
        lineItems: [],
      },
      error: null,
    });
    saveMock.mockResolvedValueOnce({
      data: null,
      error: 'This activity already exists in the estimate.',
    });

    const summary = await batchImportActivitiesFromScope({
      projectId: 'project-1',
      projectLaborRates: [],
      productionRates: [],
      items: [
        {
          divisionCode: '03',
          divisionName: 'Concrete',
          activityTitle: 'Place Slab',
        },
        {
          divisionCode: '06',
          divisionName: 'Wood',
          activityTitle: 'Framing',
        },
      ],
    });

    expect(summary.created).toBe(1);
    expect(summary.skippedDuplicate).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.results[0]?.status).toBe('created');
    expect(summary.results[0]?.activityId).toBe('act-1');
  });
});
