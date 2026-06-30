import { describe, expect, it } from 'vitest';
import {
  SOURCE_DOCUMENT_FULL,
  SOURCE_EDITION,
  type ProductionRateLibraryEntry,
} from '../data/productionRates/productionRateTypes';
import { mapProductionRateToLaborRoleKey } from '../application/laborRoleMapping';
import { STARTER_LABOR_ROLES } from '../domain/laborRateTypes';

function sampleRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: 'test-rate',
    divisionCode: '08',
    divisionName: 'Openings',
    figure: 'Test Figure',
    figureTitle: 'Test Figure Title',
    sourcePage: 'Test Page',
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
    sourceDocumentFull: SOURCE_DOCUMENT_FULL,
    sourceEdition: SOURCE_EDITION,
    referenceNote: 'Test reference',
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
  it('includes Welder in starter company labor roles', () => {
    expect(STARTER_LABOR_ROLES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleKey: 'welder',
          roleName: 'Welder',
          tradeCategory: 'Welding',
          hourlyRate: 27.29,
          burdenPercent: 30,
          billingRate: 53.22,
        }),
      ]),
    );
  });

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

describe('steel welding labor mapping', () => {
  it.each([
    [
      'Trusses-Welded connection',
      'Structural Steel',
      'Trusses-Welded connection',
      ['metals', 'structural', 'steel', 'trusses', 'welded'],
    ],
    [
      'Cleaning and welding plates, bars, or rods to existing beams, columns, or trusses',
      'Structural Steel',
      'Continuous fillet, stick welding, including equipment, Single pass',
      ['metals', 'welding', 'structural', 'steel', 'continuous', 'fillet'],
    ],
    [
      'Trusses',
      'Structural Steel',
      'Trusses',
      ['metals', 'structural', 'steel', 'trusses'],
    ],
  ])('maps "%s" to Welder', (activityName, category, subcategory, keywords) => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          divisionCode: '05',
          divisionName: 'Metals',
          figureTitle: 'Structural Steel Welding Production',
          category,
          subcategory,
          activityName,
          description: activityName,
          keywords,
        }),
      ),
    ).toBe('welder');
  });

  it('keeps welded wire reinforcement on Ironworker', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          divisionCode: '03',
          divisionName: 'Concrete',
          category: 'Concrete Reinforcement',
          activityName: 'Welded wire fabric reinforcement',
          description: 'Install welded wire fabric, WWF',
          keywords: ['welded', 'wire', 'wwf', 'reinforcement'],
        }),
      ),
    ).toBe('ironworker');
  });

  it('does not map structural steel truss erection to Welder without welding context', () => {
    expect(
      mapProductionRateToLaborRoleKey(
        sampleRate({
          divisionCode: '05',
          divisionName: 'Metals',
          figureTitle: 'Structural Steel Erection Production',
          category: 'Structural Steel',
          subcategory: 'Trusses',
          activityName: 'Erection of Trusses',
          description: 'Erection of Trusses',
          keywords: ['metals', 'structural', 'steel', 'erection', 'trusses'],
        }),
      ),
    ).toBe('general_trade');
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
