import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateLineItemRow, EstimateVersionRow } from '../infrastructure/estimateDbTypes';
import {
  mapCalculatedLineSnapshotToInsert,
  mapDraftLineToLineItemInsert,
  mapCalculatedTaskToLineItemInsert,
  mapDomainTaskToLineItemInsert,
  mapEstimateSnapshotToVersionInsert,
  mapEstimateTotalsToJson,
  mapEstimateVersionRowToDomain,
  mapLineItemRowToDomainTask,
  mapLineItemRowsToEstimateVersion,
} from '../infrastructure/estimateMappers';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

const VERSION_ROW: EstimateVersionRow = {
  id: 'ver-001',
  estimate_id: 'est-001',
  project_id: 'proj-001',
  version_number: 1,
  version_name: 'Initial estimate',
  estimate_type: 'detailed',
  status: 'draft',
  snapshot: {
    meta: {
      estimateId: 'est-001',
      projectId: 'proj-001',
      version: 1,
      estimateType: 'detailed',
      status: 'draft',
      currencyCode: 'USD',
      preparedAtIso: '2026-06-04T00:00:00.000Z',
    },
  },
  totals: {
    directCost: 100,
    indirectCost: 10,
    overhead: 5,
    profit: 2,
    contingency: 1,
    tax: 3,
    finalSellPrice: 121,
  },
  notes: null,
  created_by: 'user-001',
  created_at: '2026-06-04T00:00:00.000Z',
};

function buildLineItemRow(overrides: Partial<EstimateLineItemRow> = {}): EstimateLineItemRow {
  return {
    id: 'line-001',
    estimate_version_id: 'ver-001',
    project_id: 'proj-001',
    parent_line_item_id: null,
    line_type: 'task',
    csi_division: '03',
    csi_section: '03 30 00',
    scope_name: 'Concrete',
    title: 'Slab pour',
    description: 'Slab pour - sample line',
    trade: 'Concrete',
    activity: 'Pour',
    quantity: 100,
    unit: 'sf',
    production_rate: 10,
    production_rate_type: 'units_per_labor_hour',
    crew_size: 2,
    hours_per_day: 8,
    labor_rate: 50,
    burden_percent: 20,
    overhead_percent: 10,
    profit_percent: 5,
    contingency_percent: 2,
    tax_percent: 8,
    waste_percent: 10,
    difficulty_factor: 1,
    location_factor: 1,
    material_cost: 5,
    equipment_cost: 100,
    subcontractor_cost: 300,
    indirect_cost: 0,
    calculated_values: {
      quantityFormula: 'area',
      quantityInput: {
        formula: 'area',
        quantity: 100,
        wastePercent: 10,
        dimensions: { length: 10, width: 10 },
      },
      laborInput: {
        productionRate: 10,
        productionRateType: 'units_per_labor_hour',
        hoursPerDay: 8,
        crewSize: 2,
        laborRate: 50,
        burdenPercent: 20,
      },
      materialInput: { unitCost: 5 },
      equipmentInput: { rate: 100, rateType: 'day', usageUnits: 2 },
      subcontractorInput: { cost: 300 },
    },
    schedule_enabled: true,
    weather_sensitive: true,
    inspection_required: false,
    position: 2,
    created_at: '2026-06-04T00:00:00.000Z',
    ...overrides,
  };
}

function buildDomainTaskFromFixture(): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[0];
  const input = sampleEstimateVersion.lineItems[0];

  return {
    id: input.id,
    lineType: 'task',
    title: input.description,
    description: input.description,
    scopeName: 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: 0,
    lineItem: input,
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 10,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: true,
    calculatedValues: {
      quantityFormula: line.quantityFormula,
      metrics: line.metrics,
      costs: line.costs,
    },
    equipmentRate: input.equipment?.rate,
    equipmentRateType: input.equipment?.rateType,
    equipmentUsageUnits: input.equipment?.usageUnits,
  };
}

describe('estimateMappers', () => {
  it('maps a DB line item row into the domain task shape', () => {
    const row = buildLineItemRow();
    const task = mapLineItemRowToDomainTask(row);

    expect(task.id).toBe('line-001');
    expect(task.scopeName).toBe('Concrete');
    expect(task.trade).toBe('Concrete');
    expect(task.activity).toBe('Pour');
    expect(task.lineItem.csiDivision).toBe('03');
    expect(task.lineItem.csiSection).toBe('03 30 00');
    expect(task.lineItem.description).toBe('Slab pour - sample line');
    expect(task.lineItem.quantity.formula).toBe('area');
    expect(task.lineItem.quantity.wastePercent).toBe(10);
    expect(task.lineItem.labor?.productionRate).toBe(10);
    expect(task.lineItem.labor?.crewSize).toBe(2);
    expect(task.scheduleEnabled).toBe(true);
    expect(task.weatherSensitive).toBe(true);
    expect(task.position).toBe(2);
  });

  it('maps a domain task into a DB insert shape with snake_case columns', () => {
    const task = buildDomainTaskFromFixture();
    const insert = mapDomainTaskToLineItemInsert({
      task,
      estimateVersionId: 'ver-001',
      projectId: 'proj-001',
    });

    expect(insert.estimate_version_id).toBe('ver-001');
    expect(insert.project_id).toBe('proj-001');
    expect(insert.scope_name).toBe('Concrete Scope');
    expect(insert.trade).toBe('Concrete');
    expect(insert.activity).toBe('Pour');
    expect(insert.csi_division).toBe('03');
    expect(insert.csi_section).toBe('03 30 00');
    expect(insert.production_rate).toBe(10);
    expect(insert.crew_size).toBe(2);
    expect(insert.labor_rate).toBe(50);
    expect(insert.burden_percent).toBe(20);
    expect(insert.overhead_percent).toBe(10);
    expect(insert.profit_percent).toBe(5);
    expect(insert.contingency_percent).toBe(2);
    expect(insert.tax_percent).toBe(8);
    expect(insert.waste_percent).toBe(10);
    expect(insert.schedule_enabled).toBe(true);
    expect(insert.weather_sensitive).toBe(false);
    expect(insert.inspection_required).toBe(true);
    expect(insert.calculated_values?.quantityFormula).toBe('area');
  });

  it('maps snapshot totals to JSON safely', () => {
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
    const json = mapEstimateTotalsToJson(snapshot.totals);

    expect(json.directCost).toBe(snapshot.totals.directCost);
    expect(json.finalSellPrice).toBe(snapshot.totals.finalSellPrice);
    expect(typeof json.overhead).toBe('number');
  });

  it('does not crash when optional JSON fields are missing', () => {
    const row = buildLineItemRow({
      calculated_values: {},
      csi_division: null,
      scope_name: null,
      trade: null,
      activity: null,
      production_rate_type: null,
    });

    const warnings: string[] = [];
    const task = mapLineItemRowToDomainTask(row, warnings);
    const version = mapEstimateVersionRowToDomain({
      ...VERSION_ROW,
      totals: {},
      snapshot: {},
    });

    expect(task.lineItem.quantity.formula).toBe('quantity_with_waste');
    expect(task.scopeName).toBeUndefined();
    expect(version.totals.directCost).toBe(0);
    expect(version.warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('csi_division'))).toBe(true);
  });

  it('preserves line item position sort order when mapping a version', () => {
    const rows = [
      buildLineItemRow({ id: 'line-b', position: 5, title: 'Second' }),
      buildLineItemRow({ id: 'line-a', position: 1, title: 'First' }),
    ];

    const version = mapLineItemRowsToEstimateVersion(VERSION_ROW, rows);

    expect(version.lineItems.map((item) => item.id)).toEqual(['line-a', 'line-b']);
    expect(version.lineItems[0].title).toBe('First');
    expect(version.lineItems[1].title).toBe('Second');
  });

  it('maps an estimate snapshot into a version insert row', () => {
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
    const insert = mapEstimateSnapshotToVersionInsert({
      snapshot,
      estimateId: 'est-001',
      projectId: 'proj-001',
      versionNumber: 2,
      versionName: 'Revision A',
      createdBy: 'user-001',
    });

    expect(insert.estimate_id).toBe('est-001');
    expect(insert.project_id).toBe('proj-001');
    expect(insert.version_number).toBe(2);
    expect(insert.version_name).toBe('Revision A');
    expect(insert.totals?.directCost).toBe(snapshot.totals.directCost);
    expect(insert.snapshot?.meta).toEqual(snapshot.meta);
  });

  it('maps calculated task values into calculated_values on insert', () => {
    const task = buildDomainTaskFromFixture();
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
    const calculatedLine = snapshot.lineItems[0];

    const insert = mapCalculatedLineSnapshotToInsert({
      task,
      estimateVersionId: 'ver-001',
      projectId: 'proj-001',
      calculatedLine,
    });

    expect(insert.material_cost).toBe(calculatedLine.costs.materialCost);
    expect(insert.equipment_cost).toBe(calculatedLine.costs.equipmentCost);
    expect(insert.subcontractor_cost).toBe(calculatedLine.costs.subcontractorCost);
    expect(insert.calculated_values?.metrics).toEqual(calculatedLine.metrics);
    expect(insert.calculated_values?.costs).toEqual(calculatedLine.costs);

    const viaRecord = mapCalculatedTaskToLineItemInsert({
      task,
      estimateVersionId: 'ver-001',
      projectId: 'proj-001',
      calculatedValues: {
        metrics: calculatedLine.metrics,
        costs: calculatedLine.costs,
      },
    });

    expect(viaRecord.material_cost).toBe(calculatedLine.costs.materialCost);
  });

  it('maps draft line unit and indirect cost into insert row and calculated_values', () => {
    const task = buildDomainTaskFromFixture();
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
    const calculatedLine = snapshot.lineItems[0];

    const insert = mapDraftLineToLineItemInsert({
      task,
      unit: 'CY',
      indirectCost: 75,
      calculatedLine,
      estimateVersionId: 'ver-001',
      projectId: 'proj-001',
      position: 4,
    });

    expect(insert.unit).toBe('CY');
    expect(insert.indirect_cost).toBe(75);
    expect(insert.position).toBe(4);
    expect(insert.line_type).toBe('task');
    expect(insert.calculated_values?.unit).toBe('CY');
    expect((insert.calculated_values?.costs as { indirectCost?: number })?.indirectCost).toBe(75);
  });
});
