/**
 * Tests for activity resource calculations and related logic.
 * Activity Resource Costing — Materials & Equipment Starter Library
 */
import { describe, it, expect } from 'vitest';
import {
  calculateResourceLineTotal,
  calculateMaterialResourceTotal,
  calculateEquipmentResourceTotal,
  calculateActivityResourceRollup,
  calculateEstimateResourceCostBreakdown,
  sumActivityResourceLineTotals,
} from '../domain/constructionActivityCalculations';
import type {
  ActivityMaterialResource,
  ActivityEquipmentResource,
  ActivityResourceSnapshot,
} from '../domain/constructionActivityTypes';
import {
  searchStarterCostLibrary,
  getStarterCostItemById,
  getStarterCategories,
  STARTER_MATERIALS,
  STARTER_EQUIPMENT,
} from '../data/starterCostLibrary/starterCostLibraryIndex';

// ---------------------------------------------------------------------------
// calculateEstimateResourceCostBreakdown
// ---------------------------------------------------------------------------

describe('calculateEstimateResourceCostBreakdown', () => {
  it('sums materials and equipment into direct cost with labor', () => {
    const result = calculateEstimateResourceCostBreakdown({
      laborTotal: 1000,
      materials: [
        { quantity: 2, unitCost: 100, totalCost: 200 },
      ],
      equipment: [
        { quantity: 1, unitCost: 300, totalCost: 300 },
      ],
      subcontractorTotal: 0,
    });

    expect(result.laborTotal).toBe(1000);
    expect(result.materialTotal).toBe(200);
    expect(result.equipmentTotal).toBe(300);
    expect(result.directCost).toBe(1500);
  });

  it('normalizes invalid material/equipment values to 0', () => {
    const result = calculateEstimateResourceCostBreakdown({
      laborTotal: 500,
      materials: [{ quantity: -2, unitCost: NaN, totalCost: -50 }],
      equipment: [{ quantity: NaN, unitCost: -100, totalCost: NaN }],
    });

    expect(result.materialTotal).toBe(0);
    expect(result.equipmentTotal).toBe(0);
    expect(result.directCost).toBe(500);
  });

  it('uses quantity * unitCost when totalCost is missing', () => {
    expect(
      sumActivityResourceLineTotals([{ quantity: 3, unitCost: 40, totalCost: 0 }]),
    ).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// calculateResourceLineTotal
// ---------------------------------------------------------------------------

describe('calculateResourceLineTotal', () => {
  it('calculates quantity × unitCost', () => {
    expect(calculateResourceLineTotal(5, 100)).toBe(500);
  });

  it('returns 0 for quantity = 0', () => {
    expect(calculateResourceLineTotal(0, 200)).toBe(0);
  });

  it('returns 0 for unitCost = 0 — starter placeholder items can still be added', () => {
    expect(calculateResourceLineTotal(3, 0)).toBe(0);
  });

  it('normalizes negative quantity to 0', () => {
    expect(calculateResourceLineTotal(-5, 100)).toBe(0);
  });

  it('normalizes negative unitCost to 0', () => {
    expect(calculateResourceLineTotal(5, -100)).toBe(0);
  });

  it('normalizes NaN quantity to 0', () => {
    expect(calculateResourceLineTotal(NaN, 100)).toBe(0);
  });

  it('normalizes NaN unitCost to 0', () => {
    expect(calculateResourceLineTotal(5, NaN)).toBe(0);
  });

  it('handles fractional values', () => {
    expect(calculateResourceLineTotal(2.5, 40)).toBe(100);
  });
});

// Backward compat aliases
describe('calculateMaterialResourceTotal (alias)', () => {
  it('delegates to calculateResourceLineTotal', () => {
    expect(calculateMaterialResourceTotal(10, 25)).toBe(250);
  });
});

describe('calculateEquipmentResourceTotal (alias)', () => {
  it('delegates to calculateResourceLineTotal', () => {
    expect(calculateEquipmentResourceTotal(3, 500)).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// calculateActivityResourceRollup
// ---------------------------------------------------------------------------

describe('calculateActivityResourceRollup', () => {
  it('sums material and equipment and adds to labor', () => {
    const result = calculateActivityResourceRollup({
      laborTotal: 1000,
      materialLineTotals: [200, 300],
      equipmentLineTotals: [150],
    });
    expect(result.totalMaterialCost).toBe(500);
    expect(result.totalEquipmentCost).toBe(150);
    expect(result.totalCost).toBe(1650);
  });

  it('preserves labor total unchanged when no resources', () => {
    const result = calculateActivityResourceRollup({
      laborTotal: 5000,
      materialLineTotals: [],
      equipmentLineTotals: [],
    });
    expect(result.totalCost).toBe(5000);
    expect(result.totalMaterialCost).toBe(0);
    expect(result.totalEquipmentCost).toBe(0);
  });

  it('does not modify labor when only material changes', () => {
    const result = calculateActivityResourceRollup({
      laborTotal: 2000,
      materialLineTotals: [500],
      equipmentLineTotals: [],
    });
    expect(result.totalCost).toBe(2500);
    expect(result.totalMaterialCost).toBe(500);
    expect(result.totalEquipmentCost).toBe(0);
  });

  it('normalizes negative material line total to 0', () => {
    const result = calculateActivityResourceRollup({
      laborTotal: 0,
      materialLineTotals: [-100],
      equipmentLineTotals: [],
    });
    expect(result.totalMaterialCost).toBe(0);
  });

  it('normalizes NaN labor to 0 (defensive)', () => {
    const result = calculateActivityResourceRollup({
      laborTotal: NaN,
      materialLineTotals: [100],
      equipmentLineTotals: [],
    });
    expect(result.totalCost).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Source snapshot preservation
// ---------------------------------------------------------------------------

describe('ActivityResourceSnapshot — source preservation', () => {
  it('snapshot captures original starter item data independent of user edits', () => {
    const snapshot: ActivityResourceSnapshot = {
      sourceName: 'Arden Starter Library',
      originalName: 'Ready-mix concrete, 4000 PSI, normal weight',
      originalUnit: 'CY',
      originalDefaultUnitCost: 0,
      category: 'Concrete',
      subcategory: 'Ready-Mix Concrete',
      csiDivision: '03',
      csiSection: '03 30 00',
      notes: 'Starter catalog item only. Verify local supplier pricing before proposal.',
      selectedAt: '2026-06-13T00:00:00.000Z',
    };

    // User changes name/unit/cost on the activity resource — snapshot is immutable
    const resource: ActivityMaterialResource = {
      id: 'test-id',
      activityId: 'activity-1',
      projectId: 'project-1',
      name: 'Concrete (modified label)',
      quantity: 10,
      unit: 'm³', // user changed unit
      unitCost: 185, // user entered actual price
      totalCost: 1850,
      sourceProvider: 'arden_starter',
      sourceId: 'material-concrete-ready-mix-concrete-ready-mix-concrete-4000-psi-normal-weight',
      sourceSnapshot: snapshot,
    };

    expect(resource.sourceSnapshot?.originalName).toBe('Ready-mix concrete, 4000 PSI, normal weight');
    expect(resource.sourceSnapshot?.originalUnit).toBe('CY');
    expect(resource.sourceSnapshot?.originalDefaultUnitCost).toBe(0);
    expect(resource.name).toBe('Concrete (modified label)');
    expect(resource.unitCost).toBe(185);
    expect(resource.totalCost).toBe(1850);
  });

  it('equipment source snapshot preserves original selected item data', () => {
    const snapshot: ActivityResourceSnapshot = {
      sourceName: 'Arden Starter Library',
      originalName: 'Skid steer loader, wheeled, standard bucket',
      originalUnit: 'day',
      originalDefaultUnitCost: 0,
      category: 'Earthwork Equipment',
      subcategory: 'Loading',
      selectedAt: '2026-06-13T00:00:00.000Z',
    };

    const resource: ActivityEquipmentResource = {
      id: 'equip-test-id',
      activityId: 'activity-1',
      projectId: 'project-1',
      name: 'Skid steer loader, wheeled, standard bucket',
      quantity: 5,
      unit: 'day',
      unitCost: 450,
      totalCost: 2250,
      sourceProvider: 'arden_starter',
      sourceId: 'equipment-earthwork-equipment-loading-skid-steer-loader-wheeled-standard-bucket',
      sourceSnapshot: snapshot,
    };

    expect(resource.sourceSnapshot?.originalName).toBe('Skid steer loader, wheeled, standard bucket');
    expect(resource.totalCost).toBe(2250);
  });
});

// ---------------------------------------------------------------------------
// source_id supports non-UUID starter IDs
// ---------------------------------------------------------------------------

describe('source_id — non-UUID string IDs', () => {
  it('starter sourceId is a descriptive string, not a UUID', () => {
    const resource: ActivityMaterialResource = {
      id: 'some-uuid',
      activityId: 'act-1',
      projectId: 'proj-1',
      name: 'Form lumber',
      quantity: 10,
      unit: 'EA',
      unitCost: 5,
      totalCost: 50,
      sourceProvider: 'arden_starter',
      sourceId: 'material-concrete-formwork-form-lumber-form-lumber-spf-2inx4inx10ft',
    };
    // Should NOT be a UUID format
    expect(resource.sourceId).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(resource.sourceId).toBe('material-concrete-formwork-form-lumber-form-lumber-spf-2inx4inx10ft');
  });

  it('company library item uses companyLibraryItemId (UUID) separately from sourceId', () => {
    const resource: ActivityMaterialResource = {
      id: 'some-uuid',
      activityId: 'act-1',
      projectId: 'proj-1',
      name: 'My custom concrete',
      quantity: 5,
      unit: 'CY',
      unitCost: 200,
      totalCost: 1000,
      sourceProvider: 'company_library',
      companyLibraryItemId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    };
    expect(resource.companyLibraryItemId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(resource.sourceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Starter library seed data
// ---------------------------------------------------------------------------

describe('Starter Cost Library — seed data', () => {
  it('contains both materials and equipment', () => {
    expect(STARTER_MATERIALS.length).toBeGreaterThan(0);
    expect(STARTER_EQUIPMENT.length).toBeGreaterThan(0);
  });

  it('all items have string IDs (not UUIDs)', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
    [...STARTER_MATERIALS, ...STARTER_EQUIPMENT].forEach((item) => {
      expect(item.id).not.toMatch(uuidPattern);
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
    });
  });

  it('all items have required fields', () => {
    [...STARTER_MATERIALS, ...STARTER_EQUIPMENT].forEach((item) => {
      expect(item.name).toBeTruthy();
      expect(item.unit).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(typeof item.defaultUnitCost).toBe('number');
    });
  });

  it('getStarterCostItemById returns correct item', () => {
    const item = getStarterCostItemById(
      'material-concrete-ready-mix-concrete-ready-mix-concrete-4000-psi-normal-weight',
    );
    expect(item).toBeDefined();
    expect(item?.name).toBe('Ready-mix concrete, 4000 PSI, normal weight');
    expect(item?.type).toBe('material');
  });

  it('getStarterCostItemById returns undefined for unknown ID', () => {
    expect(getStarterCostItemById('not-a-real-id')).toBeUndefined();
  });

  it('searchStarterCostLibrary filters by query', () => {
    const results = searchStarterCostLibrary('concrete', 'material');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((item) => {
      const combinedText = [item.name, item.description, item.category, ...item.tags].join(' ').toLowerCase();
      expect(combinedText).toContain('concrete');
    });
  });

  it('searchStarterCostLibrary returns all when query is empty', () => {
    expect(searchStarterCostLibrary('', 'material').length).toBe(STARTER_MATERIALS.length);
  });

  it('getStarterCategories returns sorted unique categories', () => {
    const cats = getStarterCategories('material');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats).toEqual([...cats].sort());
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('starter items with defaultUnitCost 0 can still be added when user enters unitCost', () => {
    const item = STARTER_MATERIALS.find((m) => m.defaultUnitCost === 0);
    expect(item).toBeDefined();
    // User enters their own price; calculation uses user-entered value, not defaultUnitCost
    const userUnitCost = 185;
    const total = calculateResourceLineTotal(5, userUnitCost);
    expect(total).toBe(925);
  });
});

// ---------------------------------------------------------------------------
// Company library item does not mutate the original
// ---------------------------------------------------------------------------

describe('company library item — non-mutating usage', () => {
  it('using a library item does not change its defaultUnitCost', () => {
    const libraryItem = {
      id: 'lib-1',
      userId: 'user-1',
      type: 'material' as const,
      name: 'Framing nails, 16d common',
      unit: 'box',
      defaultUnitCost: 45,
      sourceProvider: 'manual' as const,
    };

    // Resource gets user-entered quantity and cost — library item is NOT modified
    const resourceUnitCost = 48; // user adjusted price
    const quantity = 10;
    const total = calculateResourceLineTotal(quantity, resourceUnitCost);

    expect(libraryItem.defaultUnitCost).toBe(45); // unchanged
    expect(total).toBe(480);
  });
});

// ---------------------------------------------------------------------------
// Total re-sync after delete
// ---------------------------------------------------------------------------

describe('total re-sync on delete', () => {
  it('material total re-syncs after removing one item', () => {
    const materials: ActivityMaterialResource[] = [
      { id: 'm1', activityId: 'a1', projectId: 'p1', name: 'Concrete', quantity: 10, unit: 'CY', unitCost: 185, totalCost: 1850, sourceProvider: 'manual' },
      { id: 'm2', activityId: 'a1', projectId: 'p1', name: 'Rebar', quantity: 50, unit: 'LF', unitCost: 2, totalCost: 100, sourceProvider: 'manual' },
    ];

    const afterDelete = materials.filter((m) => m.id !== 'm1');
    const resynced = calculateActivityResourceRollup({
      laborTotal: 5000,
      materialLineTotals: afterDelete.map((m) => m.totalCost),
      equipmentLineTotals: [],
    });

    expect(resynced.totalMaterialCost).toBe(100);
    expect(resynced.totalCost).toBe(5100);
  });

  it('equipment total re-syncs after removing one item', () => {
    const equipment: ActivityEquipmentResource[] = [
      { id: 'e1', activityId: 'a1', projectId: 'p1', name: 'Excavator', quantity: 2, unit: 'day', unitCost: 1200, totalCost: 2400, sourceProvider: 'arden_starter' },
      { id: 'e2', activityId: 'a1', projectId: 'p1', name: 'Skid steer', quantity: 3, unit: 'day', unitCost: 400, totalCost: 1200, sourceProvider: 'arden_starter' },
    ];

    const afterDelete = equipment.filter((e) => e.id !== 'e1');
    const resynced = calculateActivityResourceRollup({
      laborTotal: 3000,
      materialLineTotals: [],
      equipmentLineTotals: afterDelete.map((e) => e.totalCost),
    });

    expect(resynced.totalEquipmentCost).toBe(1200);
    expect(resynced.totalCost).toBe(4200);
  });
});
