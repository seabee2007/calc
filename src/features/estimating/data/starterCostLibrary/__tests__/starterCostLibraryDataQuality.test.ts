/**
 * QA validator for Arden Starter Cost Library seed data (Track A output / Track B integration).
 */
import { describe, it, expect } from 'vitest';
import {
  STARTER_COST_LIBRARY_ITEMS,
  STARTER_MATERIALS,
  STARTER_EQUIPMENT,
} from '../starterCostLibraryIndex';
import type { StarterCostLibraryItem } from '../starterCostLibraryTypes';

const GENERIC_NAME_PATTERNS = [
  /^2x4$/i,
  /^compactor$/i,
  /^concrete$/i,
  /^pipe$/i,
  /^wire$/i,
  /^lumber$/i,
  /^nails$/i,
];

const MATERIAL_UNITS = new Set([
  'EA', 'LF', 'SF', 'SY', 'CY', 'TON', 'LB', 'BAG', 'ROLL', 'BOX', 'SQ', 'GAL', 'MBF',
  'bag', 'pallet', 'm³', 'gal', 'pail', 'roll', 'box', 'Sq', 'sq', 'bundle', 'lb',
]);
const EQUIPMENT_UNITS = new Set(['HR', 'DAY', 'WEEK', 'MONTH', 'hour', 'day', 'week', 'month']);

function assertItemQuality(item: StarterCostLibraryItem) {
  expect(item.id.length).toBeGreaterThan(0);
  expect(item.name.length).toBeGreaterThanOrEqual(12);
  expect(item.description.length).toBeGreaterThanOrEqual(40);
  expect(item.unit.length).toBeGreaterThan(0);
  expect(item.category.length).toBeGreaterThan(0);
  expect(item.subcategory.length).toBeGreaterThan(0);
  expect(item.tags.length).toBeGreaterThan(0);
  expect(item.pricingRequired).toBe(true);
  expect(['placeholder', 'low', 'medium', 'high']).toContain(item.costConfidence);
  expect(typeof item.defaultUnitCost).toBe('number');
  expect(Number.isFinite(item.defaultUnitCost)).toBe(true);
  expect(item.defaultUnitCost).toBeGreaterThanOrEqual(0);

  const normalizedName = item.name.trim();
  for (const pattern of GENERIC_NAME_PATTERNS) {
    expect(normalizedName).not.toMatch(pattern);
  }

  if (item.type === 'material') {
    expect(MATERIAL_UNITS.has(item.unit) || item.commonUnits.some((u) => MATERIAL_UNITS.has(u))).toBe(true);
  } else {
    expect(EQUIPMENT_UNITS.has(item.unit) || item.commonUnits.some((u) => EQUIPMENT_UNITS.has(u))).toBe(true);
  }
}

describe('starterCostLibraryDataQuality', () => {
  it('has at least 400 material items and 100 equipment items', () => {
    expect(STARTER_MATERIALS.length).toBeGreaterThanOrEqual(750);
    expect(STARTER_EQUIPMENT.length).toBeGreaterThanOrEqual(200);
  });

  it('has unique ids across the full catalog', () => {
    const ids = STARTER_COST_LIBRARY_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('validates every catalog item', () => {
    for (const item of STARTER_COST_LIBRARY_ITEMS) {
      assertItemQuality(item);
    }
  });

  it('includes placeholder pricing metadata on generated items', () => {
    const withCost = STARTER_COST_LIBRARY_ITEMS.filter((item) => item.defaultUnitCost > 0);
    expect(withCost.length).toBeGreaterThan(0);
    for (const item of withCost) {
      expect(item.costConfidence).toBe('placeholder');
      expect(item.notes.toLowerCase()).toContain('verify');
    }
  });

  it('preserves legacy starter items by id', () => {
    expect(
      STARTER_COST_LIBRARY_ITEMS.some(
        (item) => item.id === 'material-concrete-ready-mix-concrete-ready-mix-concrete-4000-psi-normal-weight',
      ),
    ).toBe(true);
    expect(
      STARTER_EQUIPMENT.some(
        (item) => item.id === 'equipment-lifting-access-material-handling-forklift-rough-terrain-5-000-lb',
      ),
    ).toBe(true);
  });
});
