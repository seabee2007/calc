import { describe, expect, it } from 'vitest';
import {
  buildAssemblyGroupsFromRates,
  buildProductionRateCategorySourceTemplateKey,
  createDraftLineItemFromProductionRate,
  getAssemblyCategoriesByDivision,
  getRatesForAssemblyCategory,
  instantiateManualConstructionActivity,
  instantiateProductionRateAssembly,
  MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
  previewDraftProductionRateActivity,
  updateDraftLineItemQuantity,
  type ProductionRateAssemblyGroup,
} from '../application/productionRateAssemblyBuilder';
import {
  mapProductionRateToLaborRoleKey,
  resolveLaborRoleForProductionRate,
} from '../application/laborRoleMapping';
import {
  calculateActivityDurationDays,
  calculateLineItemManHours,
  rollupConstructionActivity,
} from '../domain/constructionActivityCalculations';
import { isScheduleActivityLineItem } from '../domain/constructionActivityInstantiation';
import { constructionActivitiesToScheduleActivities } from '../scheduling/adapters/constructionActivitiesToScheduleActivities';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: '03-11-13.65-0040',
    divisionCode: '03',
    divisionName: 'Concrete',
    figure: 'Figure 5-C-7',
    figureTitle: 'Figure 5-C-7 Production',
    sourcePage: '5-C-7',
    sourcePdfPage: 64,
    workElementNumber: '03 11 13.65',
    workElementLineNumber: '0040',
    category: 'Place Slab on Grade',
    subcategory: null,
    activityName: 'Vapor barrier, polyethylene',
    description: 'Vapor barrier, polyethylene',
    unitOfMeasure: 'SF',
    manHoursPerUnit: 0.002,
    crewSize: 4,
    sourceDocumentFull: 'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
    sourceEdition: 'October 2021, Change 1 October 2022',
    referenceNote: 'Reference rate',
    keywords: ['vapor', 'barrier'],
    ...overrides,
  };
}

const projectLaborRates: ProjectLaborRate[] = [
  {
    id: 'rate-carpenter',
    projectId: 'project-1',
    roleKey: 'carpenter',
    roleName: 'Carpenter',
    tradeCategory: 'Carpentry',
    hourlyRate: 40,
    burdenPercent: 25,
    fullyBurdenedRate: 50,
    billingRate: 75,
    isActive: true,
    isDefault: false,
    isOverride: false,
  },
  {
    id: 'rate-general',
    projectId: 'project-1',
    roleKey: 'general_trade',
    roleName: 'General Trade',
    tradeCategory: 'General',
    hourlyRate: 35,
    burdenPercent: 20,
    fullyBurdenedRate: 42,
    billingRate: 60,
    isActive: true,
    isDefault: true,
    isOverride: false,
  },
];

describe('productionRateAssemblyBuilder', () => {
  const rates = [
    sampleRate(),
    sampleRate({
      id: '03-11-13.65-0060',
      activityName: 'Place concrete, slab on grade',
      description: 'Place concrete, slab on grade',
      unitOfMeasure: 'CYD',
      manHoursPerUnit: 0.654,
    }),
    sampleRate({
      id: '31-31-00.00-0010',
      divisionCode: '31',
      divisionName: 'Earthwork',
      category: 'Clear and Grub Site',
      activityName: 'Clear and grub, wooded area',
      unitOfMeasure: 'AC',
      manHoursPerUnit: 12.5,
    }),
  ];

  it('buildAssemblyGroupsFromRates groups by division/category', () => {
    const groups = buildAssemblyGroupsFromRates(rates);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.category === 'Place Slab on Grade')?.rates).toHaveLength(2);
    expect(groups.find((g) => g.category === 'Clear and Grub Site')?.rates).toHaveLength(1);
  });

  it('getAssemblyCategoriesByDivision works', () => {
    expect(getAssemblyCategoriesByDivision(rates, '03')).toEqual(['Place Slab on Grade']);
    expect(getAssemblyCategoriesByDivision(rates, '31')).toEqual(['Clear and Grub Site']);
  });

  it('getRatesForAssemblyCategory returns approved rates only for the category', () => {
    const slabRates = getRatesForAssemblyCategory(rates, '03', 'Place Slab on Grade');
    expect(slabRates).toHaveLength(2);
    expect(slabRates.every((rate) => rate.divisionCode === '03')).toBe(true);
    expect(slabRates.every((rate) => rate.category === 'Place Slab on Grade')).toBe(true);
  });

  it('createDraftLineItemFromProductionRate copies sourceProductionRateKey', () => {
    const draft = createDraftLineItemFromProductionRate(sampleRate(), 'project-1');
    expect(draft.lineItem.sourceProductionRateKey).toBe('03-11-13.65-0040');
    expect(draft.lineItem.productionRateId).toBeNull();
  });

  it('quantity × manHoursPerUnit = totalManHours on draft updates', () => {
    const draft = createDraftLineItemFromProductionRate(sampleRate(), 'project-1');
    const updated = updateDraftLineItemQuantity(draft, 120);
    expect(updated.lineItem.calculatedManHours).toBe(
      calculateLineItemManHours(120, 0.002, 1),
    );
  });

  it('activity totalManHours and totalLaborCost sum line items', () => {
    const group: ProductionRateAssemblyGroup = {
      divisionCode: '03',
      divisionName: 'Concrete',
      category: 'Place Slab on Grade',
      rates: rates.filter((rate) => rate.divisionCode === '03'),
      defaultTitle: 'Place Slab on Grade',
      suggestedCrewSize: 4,
      suggestedHoursPerDay: 8,
    };

    const result = instantiateProductionRateAssembly({
      projectId: 'project-1',
      group,
      selectedLineItems: [
        { rate: rates[0], quantity: 1000 },
        { rate: rates[1], quantity: 120 },
      ],
      identity: { activityName: 'Place Slab on Grade' },
      assigned: {
        activityCode: '03-01-01',
        activitySequence: 1,
        instanceSequence: 1,
        baseTitle: 'Place Slab on Grade',
        title: 'Place Slab on Grade',
      },
      crewSize: 4,
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates,
    });

    const expectedManHours =
      calculateLineItemManHours(1000, 0.002, 1) + calculateLineItemManHours(120, 0.654, 1);
    expect(result.rollup.totalManHours).toBeCloseTo(expectedManHours, 4);
    expect(result.rollup.totalLaborCost).toBeGreaterThan(0);
    expect(result.projectLineItems.every((item) => item.productionRateId == null)).toBe(true);
    expect(result.projectLineItems.every((item) => item.sourceProductionRateKey)).toBeTruthy();
  });

  it('crew size affects duration only', () => {
    const group: ProductionRateAssemblyGroup = {
      divisionCode: '03',
      divisionName: 'Concrete',
      category: 'Place Slab on Grade',
      rates: [rates[1]],
      defaultTitle: 'Place Slab on Grade',
      suggestedCrewSize: 4,
      suggestedHoursPerDay: 8,
    };
    const baseInput = {
      projectId: 'project-1',
      group,
      selectedLineItems: [{ rate: rates[1], quantity: 120 }],
      identity: { activityName: 'Place Slab on Grade' },
      assigned: {
        activityCode: '03-01-01',
        activitySequence: 1,
        instanceSequence: 1,
        baseTitle: 'Place Slab on Grade',
        title: 'Place Slab on Grade',
      },
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates,
    };

    const crew4 = instantiateProductionRateAssembly({ ...baseInput, crewSize: 4 });
    const crew8 = instantiateProductionRateAssembly({ ...baseInput, crewSize: 8 });

    expect(crew4.rollup.totalManHours).toBe(crew8.rollup.totalManHours);
    expect(crew4.rollup.totalLaborCost).toBe(crew8.rollup.totalLaborCost);
    expect(crew4.rollup.calculatedDurationDays).toBeGreaterThan(
      crew8.rollup.calculatedDurationDays,
    );
  });

  it('manual line item is marked Manual', () => {
    const result = instantiateManualConstructionActivity({
      projectId: 'project-1',
      divisionCode: '03',
      divisionName: 'Concrete',
      lineItems: [
        {
          description: 'Custom mobilization',
          unit: 'LS',
          quantity: 1,
          manHoursPerUnit: 16,
          laborRoleId: 'rate-general',
        },
      ],
      identity: { activityName: 'Custom Activity' },
      assigned: {
        activityCode: '03-99-01',
        activitySequence: 99,
        instanceSequence: 1,
        baseTitle: 'Custom Activity',
        title: 'Custom Activity',
      },
      crewSize: 2,
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates,
    });

    expect(result.projectActivity.sourceTemplateKey).toBe(MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY);
    expect(result.projectLineItems[0].pricingSource).toBe('manual');
    expect(result.projectLineItems[0].sourceProductionRateKey).toBeNull();
  });

  it('schedule adapter sees parent activity only', () => {
    const group: ProductionRateAssemblyGroup = {
      divisionCode: '03',
      divisionName: 'Concrete',
      category: 'Place Slab on Grade',
      rates: [rates[1]],
      defaultTitle: 'Place Slab on Grade',
      suggestedCrewSize: 4,
      suggestedHoursPerDay: 8,
    };
    const result = instantiateProductionRateAssembly({
      projectId: 'project-1',
      group,
      selectedLineItems: [{ rate: rates[1], quantity: 120 }],
      identity: { activityName: 'Place Slab on Grade' },
      assigned: {
        activityCode: '03-01-01',
        activitySequence: 1,
        instanceSequence: 1,
        baseTitle: 'Place Slab on Grade',
        title: 'Place Slab on Grade',
      },
      crewSize: 4,
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates,
    });

    for (const lineItem of result.projectLineItems) {
      expect(isScheduleActivityLineItem(lineItem)).toBe(false);
    }

    const schedule = constructionActivitiesToScheduleActivities([result.projectActivity]);
    expect(schedule.activities).toHaveLength(1);
    expect(schedule.activities[0].activityCode).toBe('03-01-01');
    expect(schedule.activities[0].durationDays).toBe(result.projectActivity.effectiveDurationDays);
  });

  it('buildProductionRateCategorySourceTemplateKey is stable', () => {
    expect(buildProductionRateCategorySourceTemplateKey('03', 'Place Slab on Grade')).toBe(
      'production_rate_category:03:place-slab-on-grade',
    );
  });
});

describe('laborRoleMapping', () => {
  it('returns expected mapped role for forming work', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({ activityName: 'Edge forms, plywood', description: 'forming edge' }),
      ),
    ).toBe('carpenter');
  });

  it('returns concrete finisher for place/finish concrete', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({ activityName: 'Place concrete, slab on grade', description: 'place concrete' }),
      ),
    ).toBe('concrete_finisher');
  });

  it('falls back to General Trade when mapped role is missing', () => {
    const mapping = resolveLaborRoleForProductionRate(
      sampleRate({
        activityName: 'Install rebar',
        description: 'reinforcing steel',
      }),
      projectLaborRates,
    );
    expect(mapping.mappedRoleKey).toBe('ironworker');
    expect(mapping.resolvedRoleKey).toBe('general_trade');
    expect(mapping.projectRate?.roleKey).toBe('general_trade');
    expect(mapping.usedFallback).toBe(true);
  });

  it('totalManHours × hourly burdened rate = laborCost', () => {
    const item = createDraftLineItemFromProductionRate(sampleRate(), 'project-1');
    const updated = updateDraftLineItemQuantity(item, 100);
    const manHours = updated.lineItem.calculatedManHours;
    const laborCost = manHours * 42;
    const group: ProductionRateAssemblyGroup = {
      divisionCode: '03',
      divisionName: 'Concrete',
      category: 'Place Slab on Grade',
      rates: [sampleRate()],
      defaultTitle: 'Place Slab on Grade',
      suggestedCrewSize: 4,
      suggestedHoursPerDay: 8,
    };
    const result = instantiateProductionRateAssembly({
      projectId: 'project-1',
      group,
      selectedLineItems: [{ rate: sampleRate(), quantity: 100 }],
      identity: { activityName: 'Place Slab on Grade' },
      assigned: {
        activityCode: '03-01-01',
        activitySequence: 1,
        instanceSequence: 1,
        baseTitle: 'Place Slab on Grade',
        title: 'Place Slab on Grade',
      },
      crewSize: 4,
      hoursPerDay: 8,
      scheduleEnabled: true,
      projectLaborRates,
    });
    expect(result.projectLineItems[0].laborCost).toBeCloseTo(laborCost, 2);
  });

  it('calculateActivityDurationDays matches rollup formula', () => {
    const manHours = 78.48;
    expect(calculateActivityDurationDays(manHours, 4, 8)).toBe(Math.ceil(manHours / (4 * 8)));
  });

  it('rollupConstructionActivity uses effectiveDurationDays from override', () => {
    const activity = {
      id: 'a1',
      projectId: 'p1',
      divisionCode: '03',
      divisionName: 'Concrete',
      activityCode: '03-01-01',
      title: 'Test',
      scheduleEnabled: true,
      crewSize: 4,
      hoursPerDay: 8,
      productionFactor: 1,
      durationDaysOverride: 10,
    };
    const lineItems = [
      {
        id: 'li1',
        projectActivityId: 'a1',
        projectId: 'p1',
        name: 'Item',
        unit: 'EA',
        quantity: 1,
        manHoursPerUnit: 8,
        productionFactor: 1,
        calculatedManHours: 8,
        laborCost: 100,
        materialCost: 0,
        equipmentCost: 0,
        hourlyRateSnapshot: 0,
        burdenPercentSnapshot: 0,
        fullyBurdenedRateSnapshot: 0,
        billingRateSnapshot: 0,
      },
    ];
    const rollup = rollupConstructionActivity(activity, lineItems);
    expect(rollup.effectiveDurationDays).toBe(10);
  });
});
