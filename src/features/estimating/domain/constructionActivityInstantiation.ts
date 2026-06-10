import {
  DIV03_CONCRETE,
  DIV03_CONCRETE_SEED,
  PLACE_SLAB_ON_GRADE_ACTIVITY,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import {
  calculateLineItemManHours,
  isScheduleActivityLineItem,
  isSchedulableConstructionActivity,
  manHoursPerUnitFromLineItemTemplate,
  resolveProductionFactor,
  rollupConstructionActivity,
} from './constructionActivityCalculations';
import type {
  ActivityLineItemTemplate,
  ActivityRollupResult,
  ConstructionActivityTemplate,
  EstimateDivision,
  ProductionRate,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from './constructionActivityTypes';

/** Quantities keyed by line item template id and/or production rate id. */
export type ActivityQuantityMap = Record<string, number>;

export interface ActivityQuantityInput {
  lineItemTemplateId?: string;
  productionRateId?: string;
  quantity: number;
}

export interface InstantiateConstructionActivityInput {
  projectId: string;
  estimateId?: string;
  division: EstimateDivision;
  template: ConstructionActivityTemplate;
  lineItemTemplates: readonly ActivityLineItemTemplate[];
  productionRates: readonly ProductionRate[] | Map<string, ProductionRate>;
  quantityMap: ActivityQuantityMap;
  crewSize?: number;
  hoursPerDay?: number;
  productionFactor?: number;
  durationDaysOverride?: number | null;
  activityTitleOverride?: string;
  /** Optional stable id for tests; otherwise generated. */
  projectActivityId?: string;
}

export interface InstantiateConstructionActivityResult {
  projectActivity: ProjectConstructionActivity;
  projectLineItems: ProjectActivityLineItem[];
  rollup: ActivityRollupResult;
}

export interface SampleSlabOnGradeInputs {
  slabAreaSf: number;
  slabConcreteCy: number;
  slabPerimeterLf: number;
  controlJointLf: number;
  crewSize?: number;
  productionFactor?: number;
  hoursPerDay?: number;
  durationDaysOverride?: number | null;
  activityTitleOverride?: string;
  estimateId?: string;
}

const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_CREW_SIZE = 1;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toProductionRateMap(
  rates: readonly ProductionRate[] | Map<string, ProductionRate>,
): Map<string, ProductionRate> {
  if (rates instanceof Map) return rates;
  return new Map(rates.map((rate) => [rate.id, rate]));
}

export function findProductionRateById(
  rates: readonly ProductionRate[] | Map<string, ProductionRate>,
  id: string,
): ProductionRate | undefined {
  const map = rates instanceof Map ? rates : toProductionRateMap(rates);
  return map.get(id);
}

export function findActivityTemplateById(
  templates: readonly ConstructionActivityTemplate[],
  id: string,
): ConstructionActivityTemplate | undefined {
  return templates.find((template) => template.id === id);
}

export function getLineItemTemplatesForActivity(
  lineItemTemplates: readonly ActivityLineItemTemplate[],
  activityTemplateId: string,
): ActivityLineItemTemplate[] {
  return lineItemTemplates
    .filter((template) => template.constructionActivityTemplateId === activityTemplateId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function resolveQuantityForLineItemTemplate(
  template: ActivityLineItemTemplate,
  quantityMap: ActivityQuantityMap,
  warnings: string[],
): number {
  const byTemplateId = quantityMap[template.id];
  if (byTemplateId !== undefined) {
    return Number.isFinite(byTemplateId) && byTemplateId >= 0 ? byTemplateId : 0;
  }

  if (template.productionRateId) {
    const byRateId = quantityMap[template.productionRateId];
    if (byRateId !== undefined) {
      return Number.isFinite(byRateId) && byRateId >= 0 ? byRateId : 0;
    }
  }

  warnings.push(`Quantity missing for line item "${template.name}"; defaulting to 0.`);
  return 0;
}

export interface LineItemRateSnapshot {
  manHoursPerUnit: number;
  sourceProductionRateKey: string | null;
  sourceProductionRateLabel: string | null;
  sourceFigure: string | null;
  sourcePage: string | null;
  sourcePdfPage: number | null;
  sourceDocumentCode: string | null;
}

function resolveLineItemRateSnapshot(
  template: ActivityLineItemTemplate,
  productionRatesById: Map<string, ProductionRate>,
  warnings: string[],
): LineItemRateSnapshot {
  const rateKey = template.productionRateId ?? null;

  if (rateKey) {
    const rate = productionRatesById.get(rateKey);
    if (rate) {
      return {
        manHoursPerUnit: rate.manHoursPerUnit ?? template.defaultManHoursPerUnit ?? 0,
        sourceProductionRateKey: rateKey,
        sourceProductionRateLabel: rate.description,
        sourceFigure: rate.sourceFigure || null,
        sourcePage: rate.sourcePage || null,
        sourcePdfPage: rate.sourcePdfPage ?? null,
        sourceDocumentCode: rate.sourceManual || null,
      };
    }
    warnings.push(
      `Production rate "${rateKey}" not found for "${template.name}"; using template default.`,
    );
    return {
      manHoursPerUnit: template.defaultManHoursPerUnit ?? 0,
      sourceProductionRateKey: rateKey,
      sourceProductionRateLabel: null,
      sourceFigure: null,
      sourcePage: null,
      sourcePdfPage: null,
      sourceDocumentCode: null,
    };
  }

  return {
    manHoursPerUnit: template.defaultManHoursPerUnit ?? 0,
    sourceProductionRateKey: null,
    sourceProductionRateLabel: null,
    sourceFigure: null,
    sourcePage: null,
    sourcePdfPage: null,
    sourceDocumentCode: null,
  };
}

/**
 * Instantiates a project-scoped construction activity and line items from templates.
 * Does not mutate seed/template objects.
 */
export function instantiateConstructionActivity(
  input: InstantiateConstructionActivityInput,
): InstantiateConstructionActivityResult {
  const warnings: string[] = [];
  const productionRatesById = toProductionRateMap(input.productionRates);
  const productionFactor = resolveProductionFactor(
    input.productionFactor ?? input.template.defaultProductionFactor,
  );
  const crewSize =
    input.crewSize ?? input.template.defaultCrewSize ?? DEFAULT_CREW_SIZE;
  const hoursPerDay =
    input.hoursPerDay ?? input.template.defaultHoursPerDay ?? DEFAULT_HOURS_PER_DAY;

  const projectActivityId = input.projectActivityId ?? createId('pca');

  const resolvedTitle = input.activityTitleOverride?.trim() || input.template.name;

  const projectActivity: ProjectConstructionActivity = {
    id: projectActivityId,
    projectId: input.projectId,
    estimateId: input.estimateId,
    // activity_template_id is a DB FK to construction_activity_templates.
    // It must remain null when the activity comes from the local TypeScript
    // registry — registry keys are NOT valid FK values.
    activityTemplateId: null,
    // source_template_key stores the local registry/template key.
    sourceTemplateKey: input.template.id,
    activityCode: input.template.code,
    title: resolvedTitle,
    // Legacy aliases (kept for backward compatibility):
    templateId: input.template.id,
    code: input.template.code,
    name: resolvedTitle,
    divisionCode: input.division.code,
    divisionName: input.division.name,
    scheduleEnabled: input.template.scheduleEnabled,
    crewSize,
    hoursPerDay,
    productionFactor,
    durationDaysOverride: input.durationDaysOverride ?? null,
  };

  const sortedTemplates = getLineItemTemplatesForActivity(
    input.lineItemTemplates,
    input.template.id,
  );

  const projectLineItems: ProjectActivityLineItem[] = sortedTemplates.map((template) => {
    const quantity = resolveQuantityForLineItemTemplate(template, input.quantityMap, warnings);
    const rateSnapshot = resolveLineItemRateSnapshot(template, productionRatesById, warnings);
    const manHoursPerUnit = rateSnapshot.manHoursPerUnit;

    const calculatedManHours = calculateLineItemManHours(quantity, manHoursPerUnit, productionFactor);

    return {
      id: createId('pali'),
      // Canonical DB field names:
      projectActivityId,
      projectId: input.projectId,
      // production_rate_id is a DB FK — null for local/generated rates.
      productionRateId: null,
      sourceProductionRateKey: rateSnapshot.sourceProductionRateKey,
      sourceProductionRateLabel: rateSnapshot.sourceProductionRateLabel,
      sourceFigure: rateSnapshot.sourceFigure,
      sourcePage: rateSnapshot.sourcePage,
      sourcePdfPage: rateSnapshot.sourcePdfPage,
      sourceDocumentCode: rateSnapshot.sourceDocumentCode,
      calculatedManHours,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      // Legacy aliases:
      constructionActivityId: projectActivityId,
      templateId: template.id,
      name: template.name,
      unit: template.unit,
      quantity,
      manHoursPerUnit,
      productionFactor,
      sortOrder: template.sortOrder,
    };
  });

  const rollupBase = rollupConstructionActivity(projectActivity, projectLineItems);
  const rollup: ActivityRollupResult = {
    ...rollupBase,
    warnings: [...warnings, ...rollupBase.warnings],
  };

  // Back-fill canonical DB fields on the activity so repository can save directly.
  const finalActivity: ProjectConstructionActivity = {
    ...projectActivity,
    calculatedManHours: rollup.totalManHours,
    calculatedManDays: rollup.totalManDays,
    calculatedDurationDays: rollup.calculatedDurationDays,
    effectiveDurationDays: rollup.effectiveDurationDays,
    totalLaborCost: rollup.totalLaborCost,
    totalMaterialCost: rollup.totalMaterialCost,
    totalEquipmentCost: rollup.totalEquipmentCost,
    totalSubcontractCost: 0,
    totalCost: rollup.totalDirectCost,
  };

  return {
    projectActivity: finalActivity,
    projectLineItems,
    rollup,
  };
}

/** Example helper: instantiate Division 03 Place Slab on Grade from slab takeoff inputs. */
export function createSampleSlabOnGradeActivity(
  projectId: string,
  inputs: SampleSlabOnGradeInputs,
): InstantiateConstructionActivityResult {
  const quantityMap: ActivityQuantityMap = {
    'ali-form-slab-edge': inputs.slabPerimeterLf,
    'ali-vapor-barrier': inputs.slabAreaSf,
    'ali-wwf': inputs.slabAreaSf,
    'ali-place-concrete': inputs.slabConcreteCy,
    'ali-finish-concrete': inputs.slabAreaSf,
    'ali-cure-concrete': inputs.slabAreaSf,
    'ali-sawcut-joints': inputs.controlJointLf,
  };

  return instantiateConstructionActivity({
    projectId,
    estimateId: inputs.estimateId,
    division: DIV03_CONCRETE,
    template: PLACE_SLAB_ON_GRADE_ACTIVITY,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: DIV03_CONCRETE_SEED.productionRates,
    quantityMap,
    crewSize: inputs.crewSize,
    hoursPerDay: inputs.hoursPerDay,
    productionFactor: inputs.productionFactor,
    durationDaysOverride: inputs.durationDaysOverride,
    activityTitleOverride: inputs.activityTitleOverride,
  });
}

export {
  isScheduleActivityLineItem,
  isSchedulableConstructionActivity,
};
