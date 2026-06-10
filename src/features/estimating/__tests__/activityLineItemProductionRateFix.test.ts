/**
 * Regression: FK violation fix for project_activity_line_items.production_rate_id
 *
 * Local/generated production rate keys must NOT be written to production_rate_id (FK).
 * They belong in source_production_rate_key with snapshot manHoursPerUnit values.
 */
import { describe, expect, it } from 'vitest';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import { instantiateConstructionActivity } from '../domain/constructionActivityInstantiation';
import {
  hasConstructionActivityEstimateWarnings,
  isProjectActivityLineItemValid,
  rollupConstructionActivity,
} from '../domain/constructionActivityCalculations';
import { mapProjectLineItemToInsert } from '../infrastructure/activityMappers';
import {
  ASSEMBLY_PLACE_SLAB_ON_GRADE,
} from '../data/activityAssemblyRegistry';
import {
  DIV03_ALL_PRODUCTION_RATES,
  DIV03_CONCRETE,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
  PLACE_SLAB_ON_GRADE_ACTIVITY,
} from '../data/div03ConcreteSeeds';

const RATE_MAP = new Map(DIV03_ALL_PRODUCTION_RATES.map((r) => [r.id, r]));

const SLAB_INPUTS = {
  slabAreaSf: 2000,
  slabConcreteCyd: 25,
  slabPerimeterLf: 180,
  controlJointLf: 350,
};

describe('instantiateFromAssemblySpec — line item production rate FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-lineitem-fk',
    crewSize: 4,
    hoursPerDay: 8,
  });

  it('every line item has productionRateId null', () => {
    for (const li of result.projectLineItems) {
      expect(li.productionRateId).toBeNull();
    }
  });

  it('every line item preserves sourceProductionRateKey from template', () => {
    for (const li of result.projectLineItems) {
      expect(li.sourceProductionRateKey).toBeTruthy();
      expect(typeof li.sourceProductionRateKey).toBe('string');
    }
  });

  it('concrete placement line item snapshots rate metadata', () => {
    const placeConcrete = result.projectLineItems.find(
      (li) => li.sourceProductionRateKey === '03-31-05.70-0320',
    );
    expect(placeConcrete?.sourceProductionRateKey).toBe('03-31-05.70-0320');
    expect(placeConcrete?.sourceProductionRateLabel).toBeTruthy();
    expect(placeConcrete?.sourceFigure).toBeTruthy();
    expect(placeConcrete?.sourcePage).toBeTruthy();
    expect(placeConcrete?.sourceDocumentCode).toContain('NTRP');
  });

  it('insert payload writes production_rate_id null', () => {
    const li = result.projectLineItems[0];
    const row = mapProjectLineItemToInsert({
      ...li,
      projectActivityId: 'act-001',
    });
    expect(row.production_rate_id).toBeNull();
  });

  it('insert payload writes source_production_rate_key', () => {
    const li = result.projectLineItems[0];
    const row = mapProjectLineItemToInsert({
      ...li,
      projectActivityId: 'act-001',
    });
    expect(row.source_production_rate_key).toBe(li.sourceProductionRateKey);
    expect(row.man_hours_per_unit).toBe(li.manHoursPerUnit);
    expect(row.quantity).toBe(li.quantity);
    expect(row.calculated_man_hours).toBe(li.calculatedManHours);
  });

  it('generated production rate IDs are not written to FK field', () => {
    for (const li of result.projectLineItems) {
      const row = mapProjectLineItemToInsert({ ...li, projectActivityId: 'act-001' });
      expect(row.production_rate_id).toBeNull();
      expect(row.source_production_rate_key).toBe(li.sourceProductionRateKey);
    }
  });
});

describe('line item validation — warnings do not require production_rate_id FK', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: SLAB_INPUTS,
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-lineitem-valid',
  });

  it('valid line items with sourceProductionRateKey pass validation', () => {
    for (const li of result.projectLineItems) {
      if (li.quantity > 0 && li.manHoursPerUnit > 0) {
        expect(isProjectActivityLineItemValid(li)).toBe(true);
      }
    }
  });

  it('activity with valid line items does not show estimate warnings', () => {
    expect(hasConstructionActivityEstimateWarnings(result.projectActivity, result.projectLineItems)).toBe(false);
  });

  it('line item with zero quantity fails validation', () => {
    const invalid = {
      ...result.projectLineItems[0],
      quantity: 0,
      productionRateId: null,
      sourceProductionRateKey: '03-31-05.70-0320',
    };
    expect(isProjectActivityLineItemValid(invalid)).toBe(false);
  });

  it('line item with zero manHoursPerUnit fails validation', () => {
    const invalid = {
      ...result.projectLineItems[0],
      manHoursPerUnit: 0,
      productionRateId: null,
      sourceProductionRateKey: '03-31-05.70-0320',
    };
    expect(isProjectActivityLineItemValid(invalid)).toBe(false);
  });

  it('line item without rate reference fails validation', () => {
    const invalid = {
      ...result.projectLineItems[0],
      productionRateId: null,
      sourceProductionRateKey: null,
    };
    expect(isProjectActivityLineItemValid(invalid)).toBe(false);
  });
});

describe('rollup uses saved line item snapshot values', () => {
  const footingResult = instantiateConstructionActivity({
    projectId: 'proj-rollup-snapshot',
    division: DIV03_CONCRETE,
    template: PLACE_SLAB_ON_GRADE_ACTIVITY,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    quantityMap: {
      'ali-form-slab-edge': 180,
      'ali-vapor-barrier': 2000,
      'ali-wwf': 2000,
      'ali-place-concrete': 25,
      'ali-finish-concrete': 2000,
      'ali-cure-concrete': 2000,
      'ali-sawcut-joints': 350,
    },
    crewSize: 4,
    hoursPerDay: 8,
  });

  it('rollup totalManHours equals sum of line item calculatedManHours snapshots', () => {
    const expected = footingResult.projectLineItems.reduce(
      (sum, li) => sum + li.calculatedManHours,
      0,
    );
    expect(footingResult.rollup.totalManHours).toBeCloseTo(expected, 6);
  });

  it('rollup from saved snapshots matches instantiate rollup', () => {
    const rollupFromSnapshots = rollupConstructionActivity(
      footingResult.projectActivity,
      footingResult.projectLineItems,
    );
    expect(rollupFromSnapshots.totalManHours).toBeCloseTo(footingResult.rollup.totalManHours, 6);
    expect(rollupFromSnapshots.calculatedDurationDays).toBe(
      footingResult.rollup.calculatedDurationDays,
    );
  });

  it('changing crew size on activity does not change line item man-hours', () => {
    const crew4 = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: SLAB_INPUTS,
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: RATE_MAP,
      projectId: 'proj-crew-mh-4',
      crewSize: 4,
      hoursPerDay: 8,
    });

    const crew8 = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: SLAB_INPUTS,
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: RATE_MAP,
      projectId: 'proj-crew-mh-8',
      crewSize: 8,
      hoursPerDay: 8,
    });

    for (let i = 0; i < crew4.projectLineItems.length; i++) {
      expect(crew8.projectLineItems[i].calculatedManHours).toBeCloseTo(
        crew4.projectLineItems[i].calculatedManHours,
        6,
      );
      expect(crew8.projectLineItems[i].sourceProductionRateKey).toBe(
        crew4.projectLineItems[i].sourceProductionRateKey,
      );
    }
  });
});
