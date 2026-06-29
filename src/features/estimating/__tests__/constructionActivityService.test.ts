import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import {
  DUPLICATE_ACTIVITY_CODE_MESSAGE,
  instantiateAndSaveManualActivity,
  updateProjectConstructionActivity,
} from '../application/constructionActivityService';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

const repositoryMocks = vi.hoisted(() => ({
  fetchProjectActivities: vi.fn(),
  fetchProjectLineItems: vi.fn(),
  deleteProjectActivity: vi.fn(),
  saveActivityBundle: vi.fn(),
}));

vi.mock('../infrastructure/activityRepository', () => repositoryMocks);

const duplicateCodeError =
  'duplicate key value violates unique constraint "idx_project_construction_activities_code_unique"';

function manualInput() {
  return {
    divisionCode: '03',
    divisionName: 'Concrete',
    lineItems: [
      {
        description: 'Place concrete',
        quantity: 10,
        unit: 'CYD',
        manHoursPerUnit: 0.5,
      },
    ],
    projectId: 'project-1',
    identity: {
      activityName: 'Slab on grade',
    },
    projectLaborRates: [],
  };
}

function activity(): ProjectConstructionActivity {
  return {
    id: 'activity-1',
    projectId: 'project-1',
    estimateId: 'estimate-1',
    sourceTemplateKey: 'design-builder-test',
    divisionCode: '04',
    divisionName: 'Masonry',
    activityCode: '04-01-01',
    title: 'CMU wall system',
    baseTitle: 'CMU wall system',
    scheduleEnabled: true,
    crewSize: 2,
    hoursPerDay: 8,
    calculatedManHours: 0,
    calculatedManDays: 0,
    calculatedDurationDays: 0,
    effectiveDurationDays: 0,
    totalLaborCost: 0,
    totalMaterialCost: 0,
    totalEquipmentCost: 0,
    totalSubcontractCost: 0,
    totalCost: 0,
  } as ProjectConstructionActivity;
}

function lineItem(): ProjectActivityLineItem {
  return {
    id: 'line-1',
    projectActivityId: 'activity-1',
    projectId: 'project-1',
    productionRateId: null,
    sourceProductionRateKey: null,
    sourceProductionRateLabel: null,
    name: 'CMU blocks',
    description: 'CMU blocks',
    unit: 'EA',
    quantity: 100,
    manHoursPerUnit: 0,
    productionFactor: 1,
    calculatedManHours: 0,
    laborCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    subcontractCost: 0,
    totalCost: 0,
    laborRoleId: null,
    laborRoleKey: null,
    laborRoleName: null,
    tradeCategory: null,
    hourlyRateSnapshot: 0,
    burdenPercentSnapshot: 0,
    fullyBurdenedRateSnapshot: 0,
    billingRateSnapshot: 0,
    pricingSource: 'unset',
    pricingSnapshotAt: null,
    productionRateAssignmentStatus: 'unassigned',
  };
}

function laborRate(): ProjectLaborRate {
  return {
    id: 'labor-1',
    projectId: 'project-1',
    roleKey: 'mason',
    roleName: 'Mason',
    tradeCategory: 'Masonry',
    hourlyRate: 50,
    burdenPercent: 20,
    fullyBurdenedRate: 60,
    billingRate: 75,
    isActive: true,
    isDefault: true,
    isOverride: false,
  };
}

function productionRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: 'rate-cmu',
    divisionCode: '04',
    divisionName: 'Masonry',
    figure: '04-22-10',
    figureTitle: 'CMU block wall',
    sourcePage: '12',
    sourcePdfPage: 12,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: 'Masonry',
    subcategory: 'CMU',
    activityName: 'Install CMU blocks',
    description: 'Install concrete masonry units',
    unitOfMeasure: 'EA',
    manHoursPerUnit: 0.08,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data' as ProductionRateLibraryEntry['sourceDocumentFull'],
    sourceEdition: '2026' as ProductionRateLibraryEntry['sourceEdition'],
    referenceNote: 'Figure 04-22-10',
    keywords: ['cmu', 'block', 'masonry'],
    ...overrides,
  };
}

describe('constructionActivityService activity-code retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.fetchProjectActivities.mockResolvedValue({ data: [], error: null });
  });

  it('regenerates and retries once when Supabase reports a duplicate activity code', async () => {
    const attemptedCodes: string[] = [];
    repositoryMocks.saveActivityBundle
      .mockImplementationOnce((activity: ProjectConstructionActivity) => {
        attemptedCodes.push(activity.activityCode);
        return Promise.resolve({ data: null, error: duplicateCodeError });
      })
      .mockImplementationOnce((activity: ProjectConstructionActivity, lineItems) => {
        attemptedCodes.push(activity.activityCode);
        return Promise.resolve({
          data: {
            activity: { ...activity, id: 'saved-activity' },
            lineItems,
          },
          error: null,
        });
      });

    const result = await instantiateAndSaveManualActivity(manualInput());

    expect(result.error).toBeNull();
    expect(result.data?.activity.activityCode).toBe('03-02-01');
    expect(attemptedCodes).toEqual(['03-01-01', '03-02-01']);
    expect(repositoryMocks.saveActivityBundle).toHaveBeenCalledTimes(2);
  });

  it('returns a friendly message if duplicate-code retry also fails', async () => {
    repositoryMocks.saveActivityBundle.mockResolvedValue({ data: null, error: duplicateCodeError });

    const result = await instantiateAndSaveManualActivity(manualInput());

    expect(result.data).toBeNull();
    expect(result.error).toBe(DUPLICATE_ACTIVITY_CODE_MESSAGE);
    expect(result.error).not.toContain('idx_project_construction_activities_code_unique');
    expect(repositoryMocks.saveActivityBundle).toHaveBeenCalledTimes(2);
  });
});

describe('constructionActivityService line-item production-rate assignment updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates source rate fields, labor rollups, and preserves existing line item IDs', async () => {
    repositoryMocks.saveActivityBundle.mockImplementation((savedActivity, savedLineItems) =>
      Promise.resolve({
        data: {
          activity: savedActivity,
          lineItems: savedLineItems,
        },
        error: null,
      }),
    );

    const result = await updateProjectConstructionActivity(
      {
        activity: activity(),
        lineItems: [lineItem()],
        identity: { activityName: 'CMU wall system' },
        crewSize: 2,
        hoursPerDay: 8,
        durationDaysOverride: null,
        scheduleEnabled: true,
        lineItemQuantities: { 'line-1': 100 },
        lineItemLaborRoles: { 'line-1': 'labor-1' },
        lineItemProductionRateAssignments: {
          'line-1': {
            status: 'verified_rate',
            productionRate: productionRate(),
            matchConfidence: 0.92,
            matchReason: 'Estimator verified approved CMU rate.',
          },
        },
      },
      [laborRate()],
    );

    expect(result.error).toBeNull();
    expect(repositoryMocks.saveActivityBundle).toHaveBeenCalledTimes(1);
    const [savedActivity, savedLineItems] = repositoryMocks.saveActivityBundle.mock.calls[0];
    expect(savedLineItems[0]).toEqual(
      expect.objectContaining({
        id: 'line-1',
        sourceProductionRateKey: 'rate-cmu',
        sourceProductionRateLabel: 'Install CMU blocks',
        unit: 'EA',
        quantity: 100,
        manHoursPerUnit: 0.08,
        calculatedManHours: 8,
        laborRoleId: 'labor-1',
        laborRoleKey: 'mason',
        fullyBurdenedRateSnapshot: 60,
        laborCost: 480,
        productionRateAssignmentStatus: 'verified_rate',
        productionRateMatchConfidence: 0.92,
        productionRateMatchReason: 'Estimator verified approved CMU rate.',
      }),
    );
    expect(savedActivity).toEqual(
      expect.objectContaining({
        calculatedManHours: 8,
        totalLaborCost: 480,
      }),
    );
  });

  it('blocks scheduled saves when a manual override is not documented', async () => {
    const result = await updateProjectConstructionActivity(
      {
        activity: activity(),
        lineItems: [lineItem()],
        identity: { activityName: 'CMU wall system' },
        crewSize: 2,
        hoursPerDay: 8,
        durationDaysOverride: null,
        scheduleEnabled: true,
        lineItemQuantities: { 'line-1': 100 },
        lineItemLaborRoles: {},
        lineItemProductionRateAssignments: {
          'line-1': {
            status: 'manual_override',
            manHoursPerUnit: 0.08,
            reason: '',
            sourceNote: 'Estimator historical production record.',
          },
        },
      },
      [laborRate()],
    );

    expect(result.data).toBeNull();
    expect(result.error).toContain('Assign a production rate or documented manual override');
    expect(repositoryMocks.saveActivityBundle).not.toHaveBeenCalled();
  });

  it('blocks assignment updates when the selected production-rate unit is incompatible', async () => {
    const result = await updateProjectConstructionActivity(
      {
        activity: activity(),
        lineItems: [lineItem()],
        identity: { activityName: 'CMU wall system' },
        crewSize: 2,
        hoursPerDay: 8,
        durationDaysOverride: null,
        scheduleEnabled: true,
        lineItemQuantities: { 'line-1': 100 },
        lineItemLaborRoles: {},
        lineItemProductionRateAssignments: {
          'line-1': {
            status: 'verified_rate',
            productionRate: productionRate({ unitOfMeasure: 'SF' }),
          },
        },
      },
      [laborRate()],
    );

    expect(result.data).toBeNull();
    expect(result.error).toContain('not compatible');
    expect(repositoryMocks.saveActivityBundle).not.toHaveBeenCalled();
  });
});
