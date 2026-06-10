import type {
  ActivityLineItemTemplate,
  ConstructionActivityTemplate,
  EstimateDivision,
  ProductionRate,
} from '../domain/seabeeActivityTypes';

/** Division 03 — Concrete */
export const SEABEE_DIVISION_03_CONCRETE: EstimateDivision = {
  id: 'div-03-concrete',
  code: '03',
  name: 'Concrete',
  description: 'CSI Division 03 — Concrete',
};

/** Production rates aligned with existing Division 03 residential reference values. */
export const SEABEE_DIVISION_03_PRODUCTION_RATES: readonly ProductionRate[] = [
  {
    id: '03-11-16-slab-edge-forms',
    description: 'Set and brace continuous slab edge forms',
    unit: 'LF',
    manHoursPerUnit: 0.12,
    defaultCrewSize: 3,
    trade: 'Concrete',
    sourceReference: '03 11 16',
  },
  {
    id: '03-24-00-slab-vapor-barrier',
    description: 'Lay and tape polyethylene slab vapor barrier membrane',
    unit: 'SF',
    manHoursPerUnit: 0.004,
    defaultCrewSize: 2,
    trade: 'Concrete',
    sourceReference: '03 24 00',
  },
  {
    id: '03-21-11-slab-wwf',
    description: 'Place welded wire fabric reinforcement on chairs',
    unit: 'SF',
    manHoursPerUnit: 0.005,
    defaultCrewSize: 2,
    trade: 'Concrete',
    sourceReference: '03 21 11',
  },
  {
    id: '03-31-00-slab-on-grade-pump',
    description: 'Place slab-on-grade concrete via pump truck',
    unit: 'CY',
    manHoursPerUnit: 0.286,
    defaultCrewSize: 5,
    trade: 'Concrete',
    sourceReference: '03 31 00',
  },
  {
    id: '03-35-00-slab-finish',
    description: 'Place, strike-off, and hand float finish on slab',
    unit: 'SF',
    manHoursPerUnit: 0.016,
    defaultCrewSize: 4,
    trade: 'Concrete',
    sourceReference: '03 35 00',
  },
  {
    id: '03-01-00-cure-concrete',
    description: 'Apply curing compound and maintain cure period',
    unit: 'SF',
    manHoursPerUnit: 0.002,
    defaultCrewSize: 2,
    trade: 'Concrete',
    sourceReference: '03 01 00',
    notes: 'Seabee seed — starter rate for cure operations',
  },
  {
    id: '03-01-00-sawcut-joints',
    description: 'Sawcut control joints in hardened concrete',
    unit: 'LF',
    manHoursPerUnit: 0.025,
    defaultCrewSize: 2,
    trade: 'Concrete',
    sourceReference: '03 01 00',
    notes: 'Seabee seed — starter rate for sawcutting',
  },
];

export const SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY: ConstructionActivityTemplate = {
  id: 'ca-03-place-slab-on-grade',
  divisionId: SEABEE_DIVISION_03_CONCRETE.id,
  code: '03-01-01',
  name: 'Place Slab on Grade',
  description: 'Schedulable work package for slab-on-grade placement',
  scheduleEnabled: true,
  defaultCrewSize: 4,
  defaultHoursPerDay: 8,
  defaultProductionFactor: 1,
};

export const SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS: readonly ActivityLineItemTemplate[] = [
  {
    id: 'ali-form-slab-edge',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Form slab edge',
    unit: 'LF',
    productionRateId: '03-11-16-slab-edge-forms',
    defaultManHoursPerUnit: 0.12,
    sortOrder: 1,
  },
  {
    id: 'ali-vapor-barrier',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Place vapor barrier',
    unit: 'SF',
    productionRateId: '03-24-00-slab-vapor-barrier',
    defaultManHoursPerUnit: 0.004,
    sortOrder: 2,
  },
  {
    id: 'ali-wwf',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Place welded wire fabric',
    unit: 'SF',
    productionRateId: '03-21-11-slab-wwf',
    defaultManHoursPerUnit: 0.005,
    sortOrder: 3,
  },
  {
    id: 'ali-place-concrete',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Place concrete',
    unit: 'CY',
    productionRateId: '03-31-00-slab-on-grade-pump',
    defaultManHoursPerUnit: 0.286,
    sortOrder: 4,
  },
  {
    id: 'ali-finish-concrete',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Finish concrete',
    unit: 'SF',
    productionRateId: '03-35-00-slab-finish',
    defaultManHoursPerUnit: 0.016,
    sortOrder: 5,
  },
  {
    id: 'ali-cure-concrete',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Cure concrete',
    unit: 'SF',
    productionRateId: '03-01-00-cure-concrete',
    defaultManHoursPerUnit: 0.002,
    sortOrder: 6,
  },
  {
    id: 'ali-sawcut-joints',
    constructionActivityTemplateId: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY.id,
    name: 'Sawcut control joints',
    unit: 'LF',
    productionRateId: '03-01-00-sawcut-joints',
    defaultManHoursPerUnit: 0.025,
    sortOrder: 7,
  },
];

export const SEABEE_DIVISION_03_PRODUCTION_RATE_MAP = new Map<string, ProductionRate>(
  SEABEE_DIVISION_03_PRODUCTION_RATES.map((rate) => [rate.id, rate]),
);

/** Full Division 03 Concrete seed bundle for tests and future UI wiring. */
export const SEABEE_DIVISION_03_CONCRETE_SEED = {
  division: SEABEE_DIVISION_03_CONCRETE,
  productionRates: SEABEE_DIVISION_03_PRODUCTION_RATES,
  constructionActivity: SEABEE_PLACE_SLAB_ON_GRADE_ACTIVITY,
  lineItemTemplates: SEABEE_PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} as const;
