import { describe, expect, it } from 'vitest';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import { mapProductionRateToLaborRoleKey } from '../application/laborRoleMapping';

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: 'test-rate',
    divisionCode: '08',
    divisionName: 'Openings',
    figure: null,
    figureTitle: null,
    sourcePage: null,
    sourcePdfPage: null,
    workElementNumber: '08 00 00',
    workElementLineNumber: '0010',
    category: 'Accessories',
    subcategory: null,
    activityName: 'Test activity',
    description: 'Test activity',
    unitOfMeasure: 'EA',
    manHoursPerUnit: 0.5,
    crewSize: 2,
    sourceDocumentFull: 'Test',
    sourceEdition: 'Test',
    referenceNote: null,
    keywords: [],
    ...overrides,
  };
}

function wallFormworkRate(
  overrides: Partial<ProductionRateLibraryEntry> = {},
): ProductionRateLibraryEntry {
  return sampleRate({
    id: '03-03-11-13.85-0010',
    divisionCode: '03',
    divisionName: 'Concrete',
    workElementNumber: '03 11 13.85',
    workElementLineNumber: '0010',
    category: 'Walls, Forms in Place',
    subcategory: 'Wall, job-built plywood, to 8 feet',
    activityName: 'Wall, Job-built Plywood, To 8 Feet',
    description: 'Wall, job-built plywood, to 8 feet',
    unitOfMeasure: 'SF of contact surface',
    manHoursPerUnit: 0.173,
    keywords: [
      'concrete',
      'figure',
      'placing',
      'forming',
      'accessories',
      'production',
      'walls',
      'forms',
      'place',
      'wall',
      'job',
      'built',
      'plywood',
      'feet',
      'contact',
      'surface',
    ],
    ...overrides,
  });
}

describe('laborRoleMapping priority buckets', () => {
  it.each([
    ['weatherstripping', 'carpenter'],
    ['door sweep', 'carpenter'],
    ['aluminum louver', 'carpenter'],
    ['HVAC duct louver', 'hvac_technician'],
    ['supply air diffuser', 'hvac_technician'],
    ['flagpole', 'general_trade'],
    ['flagpole foundation', 'equipment_operator'],
    ['Place concrete slab on grade', 'concrete_finisher'],
    ['Edge forms, plywood', 'carpenter'],
    ['Install rebar', 'ironworker'],
    ['Excavate footing', 'equipment_operator'],
  ])('maps "%s" to %s', (activityName, expectedRoleKey) => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName,
          description: activityName,
        }),
      ),
    ).toBe(expectedRoleKey);
  });

  it('maps slab keyword to concrete finisher', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName: 'Slab vapor barrier',
          description: 'Slab preparation',
        }),
      ),
    ).toBe('concrete_finisher');
  });

  it('maps formwork vocabulary to carpenter', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName: 'Formwork for wall',
          description: 'formwork installation',
        }),
      ),
    ).toBe('carpenter');
  });
});

describe('concrete formwork labor mapping', () => {
  it.each([
    ['Wall, Job-built Plywood, To 8 Feet'],
    ['Wall, Over 8 To 16 Feet High'],
    ['Beam forms, plywood'],
    ['Column forms, plywood'],
    ['Slab on grade, edge forms, wood'],
    ['Footing, continuous wall, plywood, one use'],
  ])('maps "%s" to Carpenter', (activityName) => {
    expect(
      mapProductionRateToLaborRoleKey(
        wallFormworkRate({
          activityName,
          description: activityName.toLowerCase(),
        }),
      ),
    ).toBe('carpenter');
  });

  it('maps walls forms in place category to Carpenter even with production keywords', () => {
    expect(mapProductionRateToLaborRoleKey(wallFormworkRate())).toBe('carpenter');
  });

  it('does not map plain wall text to HVAC Technician', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName: 'Interior partition wall',
          description: 'Interior partition wall',
          category: 'Walls',
          keywords: ['wall', 'production'],
        }),
      ),
    ).not.toBe('hvac_technician');
  });

  it('maps louver to Carpenter without HVAC context', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName: 'Aluminum louver',
          description: 'Aluminum louver',
        }),
      ),
    ).toBe('carpenter');
  });

  it('maps HVAC duct wall penetration to HVAC Technician when duct context exists', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          activityName: 'HVAC duct wall penetration',
          description: 'Install duct through wall',
          keywords: ['hvac', 'duct', 'wall'],
        }),
      ),
    ).toBe('hvac_technician');
  });
});
