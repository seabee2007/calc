import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import { SOURCE_DOCUMENT_CODE } from '../data/productionRates/productionRateTypes';
import {
  calculateLineItemManHours,
  rollupConstructionActivity,
} from '../domain/constructionActivityCalculations';
import type {
  ActivityRollupResult,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../domain/constructionActivityTypes';
import { EMPTY_LABOR_PRICING_SNAPSHOT } from '../domain/constructionActivityTypes';
import type { ProjectLaborRate } from '../domain/laborRateTypes';
import { applyLaborRateToLineItem } from './laborPricingCalculator';
import {
  applyResolvedLaborRateToLineItem,
  resolveLaborRateForWorkElement,
} from './laborRateResolver';
import type {
  ActivityInstanceIdentityInput,
  AssignedProjectActivityCode,
} from './constructionActivityCoding';

export const PRODUCTION_RATE_CATEGORY_SOURCE_PREFIX = 'production_rate_category';
export const MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY = 'manual_activity';

const DEFAULT_CREW_SIZE = 4;
const DEFAULT_HOURS_PER_DAY = 8;

export interface ProductionRateAssemblyGroup {
  divisionCode: string;
  divisionName: string;
  category: string;
  rates: ProductionRateLibraryEntry[];
  defaultTitle: string;
  suggestedCrewSize: number;
  suggestedHoursPerDay: number;
}

export interface DraftProductionRateLineItem {
  draftId: string;
  rate: ProductionRateLibraryEntry;
  selected: boolean;
  quantity: number;
  lineItem: Omit<ProjectActivityLineItem, 'id' | 'projectActivityId'>;
}

export interface DraftProductionRateActivity {
  divisionCode: string;
  divisionName: string;
  category: string;
  sourceTemplateKey: string;
  defaultTitle: string;
  title: string;
  crewSize: number;
  hoursPerDay: number;
  scheduleEnabled: boolean;
  lineItems: DraftProductionRateLineItem[];
}

export interface ManualDraftLineItemInput {
  description: string;
  unit: string;
  quantity: number;
  manHoursPerUnit: number;
  laborRoleId?: string | null;
}

export interface InstantiateProductionRateAssemblyInput {
  projectId: string;
  estimateId?: string;
  group: ProductionRateAssemblyGroup;
  selectedLineItems: Array<{
    rate: ProductionRateLibraryEntry;
    quantity: number;
    laborRoleId?: string | null;
  }>;
  identity: ActivityInstanceIdentityInput;
  assigned: AssignedProjectActivityCode;
  crewSize: number;
  hoursPerDay: number;
  durationDaysOverride?: number | null;
  scheduleEnabled: boolean;
  projectLaborRates: readonly ProjectLaborRate[];
  productionFactor?: number;
  projectActivityId?: string;
}

export interface InstantiateManualActivityInput {
  projectId: string;
  estimateId?: string;
  divisionCode: string;
  divisionName: string;
  lineItems: ManualDraftLineItemInput[];
  identity: ActivityInstanceIdentityInput;
  assigned: AssignedProjectActivityCode;
  crewSize: number;
  hoursPerDay: number;
  durationDaysOverride?: number | null;
  scheduleEnabled: boolean;
  projectLaborRates: readonly ProjectLaborRate[];
  productionFactor?: number;
  projectActivityId?: string;
  sourceTemplateKey?: string;
}

export interface ProductionRateAssemblyInstantiationResult {
  projectActivity: ProjectConstructionActivity;
  projectLineItems: ProjectActivityLineItem[];
  rollup: ActivityRollupResult;
  laborRoleWarnings: string[];
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugifyCategory(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildProductionRateCategorySourceTemplateKey(
  divisionCode: string,
  category: string,
): string {
  return `${PRODUCTION_RATE_CATEGORY_SOURCE_PREFIX}:${divisionCode}:${slugifyCategory(category)}`;
}

function suggestCrewSize(rates: readonly ProductionRateLibraryEntry[]): number {
  const crewSizes = rates
    .map((rate) => rate.crewSize)
    .filter((value): value is number => value != null && value > 0);
  if (crewSizes.length === 0) return DEFAULT_CREW_SIZE;
  const max = Math.max(...crewSizes);
  return Math.max(1, Math.min(max, 12));
}

function groupKey(divisionCode: string, category: string): string {
  return `${divisionCode}::${category}`;
}

/** Group approved library rates into division + category assembly groups. */
export function buildAssemblyGroupsFromRates(
  rates: readonly ProductionRateLibraryEntry[],
): ProductionRateAssemblyGroup[] {
  const map = new Map<string, ProductionRateAssemblyGroup>();

  for (const rate of rates) {
    if (rate.manHoursPerUnit == null || rate.manHoursPerUnit <= 0) continue;
    const category = rate.category?.trim() || 'Uncategorized';
    const key = groupKey(rate.divisionCode, category);
    const existing = map.get(key);
    if (existing) {
      existing.rates.push(rate);
    } else {
      map.set(key, {
        divisionCode: rate.divisionCode,
        divisionName: rate.divisionName,
        category,
        rates: [rate],
        defaultTitle: category,
        suggestedCrewSize: DEFAULT_CREW_SIZE,
        suggestedHoursPerDay: DEFAULT_HOURS_PER_DAY,
      });
    }
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      suggestedCrewSize: suggestCrewSize(group.rates),
      rates: [...group.rates].sort((a, b) =>
        (a.workElementLineNumber ?? a.id).localeCompare(b.workElementLineNumber ?? b.id),
      ),
    }))
    .sort((a, b) =>
      a.divisionCode === b.divisionCode
        ? a.category.localeCompare(b.category)
        : a.divisionCode.localeCompare(b.divisionCode),
    );
}

export function getAssemblyCategoriesByDivision(
  rates: readonly ProductionRateLibraryEntry[],
  divisionCode: string,
): string[] {
  return buildAssemblyGroupsFromRates(rates)
    .filter((group) => group.divisionCode === divisionCode)
    .map((group) => group.category);
}

export function getRatesForAssemblyCategory(
  rates: readonly ProductionRateLibraryEntry[],
  divisionCode: string,
  category: string,
): ProductionRateLibraryEntry[] {
  return (
    buildAssemblyGroupsFromRates(rates).find(
      (group) => group.divisionCode === divisionCode && group.category === category,
    )?.rates ?? []
  );
}

export function buildAssemblyGroupForRate(rate: ProductionRateLibraryEntry): ProductionRateAssemblyGroup {
  const category = rate.category?.trim() || rate.activityName;
  return {
    divisionCode: rate.divisionCode,
    divisionName: rate.divisionName,
    category,
    rates: [rate],
    defaultTitle: category,
    suggestedCrewSize: suggestCrewSize([rate]),
    suggestedHoursPerDay: DEFAULT_HOURS_PER_DAY,
  };
}

export function getAssemblyGroupForCategory(
  rates: readonly ProductionRateLibraryEntry[],
  divisionCode: string,
  category: string,
): ProductionRateAssemblyGroup | null {
  return (
    buildAssemblyGroupsFromRates(rates).find(
      (group) => group.divisionCode === divisionCode && group.category === category,
    ) ?? null
  );
}

export function createDraftLineItemFromProductionRate(
  rate: ProductionRateLibraryEntry,
  projectId: string,
  options: { selected?: boolean; quantity?: number; sortOrder?: number } = {},
): DraftProductionRateLineItem {
  const manHoursPerUnit = rate.manHoursPerUnit ?? 0;
  const quantity = options.quantity ?? 0;
  const calculatedManHours = calculateLineItemManHours(quantity, manHoursPerUnit, 1);

  return {
    draftId: rate.canonicalId ?? rate.id,
    rate,
    selected: options.selected ?? false,
    quantity,
    lineItem: {
      projectId,
      productionRateId: null,
      sourceProductionRateKey: rate.id,
      sourceProductionRateLabel: rate.activityName,
      sourceFigure: rate.figure,
      sourcePage: rate.sourcePage,
      sourcePdfPage: rate.sourcePdfPage ?? null,
      sourceDocumentCode: SOURCE_DOCUMENT_CODE,
      name: rate.activityName,
      description: rate.description ?? rate.activityName,
      unit: rate.unitOfMeasure,
      quantity,
      manHoursPerUnit,
      productionFactor: 1,
      calculatedManHours,
      ...EMPTY_LABOR_PRICING_SNAPSHOT,
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      subcontractCost: 0,
      totalCost: 0,
      sortOrder: options.sortOrder ?? 0,
    },
  };
}

/** Swap the underlying rate when the user picks a different canonical variant. */
export function updateDraftLineItemVariant(
  item: DraftProductionRateLineItem,
  nextRate: ProductionRateLibraryEntry,
): DraftProductionRateLineItem {
  const next = createDraftLineItemFromProductionRate(nextRate, item.lineItem.projectId, {
    selected: item.selected,
    quantity: item.quantity,
    sortOrder: item.lineItem.sortOrder,
  });
  return {
    ...next,
    draftId: item.draftId,
  };
}

export interface CreateDraftActivityFromAssemblyCategoryParams {
  group: ProductionRateAssemblyGroup;
  projectId: string;
  title?: string;
  crewSize?: number;
  hoursPerDay?: number;
  scheduleEnabled?: boolean;
}

/** Build an editable draft activity shell with unselected work elements. */
export function createDraftActivityFromAssemblyCategory(
  params: CreateDraftActivityFromAssemblyCategoryParams,
): DraftProductionRateActivity {
  const { group, projectId } = params;
  const title = params.title?.trim() || group.defaultTitle;

  return {
    divisionCode: group.divisionCode,
    divisionName: group.divisionName,
    category: group.category,
    sourceTemplateKey: buildProductionRateCategorySourceTemplateKey(
      group.divisionCode,
      group.category,
    ),
    defaultTitle: group.defaultTitle,
    title,
    crewSize: params.crewSize ?? group.suggestedCrewSize,
    hoursPerDay: params.hoursPerDay ?? group.suggestedHoursPerDay,
    scheduleEnabled: params.scheduleEnabled ?? true,
    lineItems: group.rates.map((rate, index) =>
      createDraftLineItemFromProductionRate(rate, projectId, { sortOrder: index + 1 }),
    ),
  };
}

function priceLineItemFromRate(
  item: ProjectActivityLineItem,
  rateEntry: ProductionRateLibraryEntry,
  projectLaborRates: readonly ProjectLaborRate[],
  laborRoleId?: string | null,
): { item: ProjectActivityLineItem; warning: string | null } {
  const resolved = resolveLaborRateForWorkElement({
    workElement: rateEntry,
    projectLaborRates,
    preferredRoleId: laborRoleId,
  });

  if (!resolved.projectRate) {
    return { item, warning: resolved.warning ?? 'Missing labor rate' };
  }

  return {
    item: applyResolvedLaborRateToLineItem(item, resolved),
    warning: null,
  };
}

function finalizeActivityRollup(
  activity: ProjectConstructionActivity,
  lineItems: ProjectActivityLineItem[],
  extraWarnings: string[] = [],
): ProductionRateAssemblyInstantiationResult {
  const rollupBase = rollupConstructionActivity(activity, lineItems);
  const rollup: ActivityRollupResult = {
    ...rollupBase,
    warnings: [...extraWarnings, ...rollupBase.warnings],
  };

  const finalActivity: ProjectConstructionActivity = {
    ...activity,
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
    projectLineItems: lineItems,
    rollup,
    laborRoleWarnings: extraWarnings,
  };
}

export function instantiateProductionRateAssembly(
  input: InstantiateProductionRateAssemblyInput,
): ProductionRateAssemblyInstantiationResult {
  const projectActivityId = input.projectActivityId ?? createId('pca');
  const productionFactor = input.productionFactor ?? 1;
  const laborWarnings: string[] = [];

  const projectActivity: ProjectConstructionActivity = {
    id: projectActivityId,
    projectId: input.projectId,
    estimateId: input.estimateId,
    activityTemplateId: null,
    sourceTemplateKey: buildProductionRateCategorySourceTemplateKey(
      input.group.divisionCode,
      input.group.category,
    ),
    activityCode: input.assigned.activityCode,
    title: input.assigned.title,
    baseTitle: input.assigned.baseTitle,
    instanceLabel: input.identity.instanceLabel ?? null,
    location: input.identity.location ?? null,
    drawingReference: input.identity.drawingReference ?? null,
    phase: input.identity.phase ?? null,
    notes: input.identity.notes ?? null,
    activitySequence: input.assigned.activitySequence,
    instanceSequence: input.assigned.instanceSequence,
    divisionCode: input.group.divisionCode,
    divisionName: input.group.divisionName,
    description: input.group.category,
    scheduleEnabled: input.scheduleEnabled,
    crewSize: input.crewSize,
    hoursPerDay: input.hoursPerDay,
    productionFactor,
    durationDaysOverride: input.durationDaysOverride ?? null,
  };

  const projectLineItems: ProjectActivityLineItem[] = input.selectedLineItems.map(
    (entry, index) => {
      const calculatedManHours = calculateLineItemManHours(
        entry.quantity,
        entry.rate.manHoursPerUnit ?? 0,
        productionFactor,
      );

      const baseItem: ProjectActivityLineItem = {
        id: createId('pali'),
        projectActivityId,
        projectId: input.projectId,
        productionRateId: null,
        sourceProductionRateKey: entry.rate.id,
        sourceProductionRateLabel: entry.rate.activityName,
        sourceFigure: entry.rate.figure,
        sourcePage: entry.rate.sourcePage,
        sourcePdfPage: entry.rate.sourcePdfPage ?? null,
        sourceDocumentCode: SOURCE_DOCUMENT_CODE,
        name: entry.rate.activityName,
        description: entry.rate.description ?? entry.rate.activityName,
        unit: entry.rate.unitOfMeasure,
        quantity: entry.quantity,
        manHoursPerUnit: entry.rate.manHoursPerUnit ?? 0,
        productionFactor,
        calculatedManHours,
        ...EMPTY_LABOR_PRICING_SNAPSHOT,
        laborCost: 0,
        materialCost: 0,
        equipmentCost: 0,
        subcontractCost: 0,
        totalCost: 0,
        sortOrder: index + 1,
      };

      const priced = priceLineItemFromRate(
        baseItem,
        entry.rate,
        input.projectLaborRates,
        entry.laborRoleId,
      );
      if (priced.warning) laborWarnings.push(`${entry.rate.activityName}: ${priced.warning}`);
      return priced.item;
    },
  );

  return finalizeActivityRollup(projectActivity, projectLineItems, laborWarnings);
}

export function instantiateManualConstructionActivity(
  input: InstantiateManualActivityInput,
): ProductionRateAssemblyInstantiationResult {
  const projectActivityId = input.projectActivityId ?? createId('pca');
  const productionFactor = input.productionFactor ?? 1;
  const laborWarnings: string[] = [];

  const projectActivity: ProjectConstructionActivity = {
    id: projectActivityId,
    projectId: input.projectId,
    estimateId: input.estimateId,
    activityTemplateId: null,
    sourceTemplateKey: input.sourceTemplateKey ?? MANUAL_ACTIVITY_SOURCE_TEMPLATE_KEY,
    activityCode: input.assigned.activityCode,
    title: input.assigned.title,
    baseTitle: input.assigned.baseTitle,
    instanceLabel: input.identity.instanceLabel ?? null,
    location: input.identity.location ?? null,
    drawingReference: input.identity.drawingReference ?? null,
    phase: input.identity.phase ?? null,
    notes: input.identity.notes ?? null,
    activitySequence: input.assigned.activitySequence,
    instanceSequence: input.assigned.instanceSequence,
    divisionCode: input.divisionCode,
    divisionName: input.divisionName,
    scheduleEnabled: input.scheduleEnabled,
    crewSize: input.crewSize,
    hoursPerDay: input.hoursPerDay,
    productionFactor,
    durationDaysOverride: input.durationDaysOverride ?? null,
  };

  const projectLineItems: ProjectActivityLineItem[] = input.lineItems.map((entry, index) => {
    const calculatedManHours = calculateLineItemManHours(
      entry.quantity,
      entry.manHoursPerUnit,
      productionFactor,
    );

    let item: ProjectActivityLineItem = {
      id: createId('pali'),
      projectActivityId,
      projectId: input.projectId,
      productionRateId: null,
      sourceProductionRateKey: null,
      sourceProductionRateLabel: null,
      sourceFigure: null,
      sourcePage: null,
      sourcePdfPage: null,
      sourceDocumentCode: null,
      name: entry.description.trim(),
      description: entry.description.trim(),
      unit: entry.unit.trim(),
      quantity: entry.quantity,
      manHoursPerUnit: entry.manHoursPerUnit,
      productionFactor,
      calculatedManHours,
      ...EMPTY_LABOR_PRICING_SNAPSHOT,
      pricingSource: 'manual',
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      subcontractCost: 0,
      totalCost: 0,
      sortOrder: index + 1,
    };

    const resolved = resolveLaborRateForWorkElement({
      workElement: {
        activityName: entry.description.trim(),
        description: entry.description.trim(),
      },
      projectLaborRates: input.projectLaborRates,
      preferredRoleId: entry.laborRoleId,
    });

    if (resolved.projectRate) {
      item = {
        ...applyResolvedLaborRateToLineItem(item, resolved),
        pricingSource: 'manual',
      };
    } else if (item.calculatedManHours > 0) {
      laborWarnings.push(`${entry.description}: Missing labor rate`);
    }

    return item;
  });

  return finalizeActivityRollup(projectActivity, projectLineItems, laborWarnings);
}

export function updateDraftLineItemQuantity(
  draft: DraftProductionRateLineItem,
  quantity: number,
): DraftProductionRateLineItem {
  const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
  const calculatedManHours = calculateLineItemManHours(
    safeQuantity,
    draft.lineItem.manHoursPerUnit,
    draft.lineItem.productionFactor,
  );
  return {
    ...draft,
    quantity: safeQuantity,
    lineItem: {
      ...draft.lineItem,
      quantity: safeQuantity,
      calculatedManHours,
    },
  };
}

export function previewDraftProductionRateActivity(
  draft: DraftProductionRateActivity,
  projectLaborRates: readonly ProjectLaborRate[],
  durationDaysOverride?: number | null,
): ProductionRateAssemblyInstantiationResult {
  const selected = draft.lineItems.filter((item) => item.selected && item.quantity > 0);
  return instantiateProductionRateAssembly({
    projectId: draft.lineItems[0]?.lineItem.projectId ?? 'preview',
    group: {
      divisionCode: draft.divisionCode,
      divisionName: draft.divisionName,
      category: draft.category,
      rates: selected.map((item) => item.rate),
      defaultTitle: draft.defaultTitle,
      suggestedCrewSize: draft.crewSize,
      suggestedHoursPerDay: draft.hoursPerDay,
    },
    selectedLineItems: selected.map((item) => ({
      rate: item.rate,
      quantity: item.quantity,
    })),
    identity: {
      activityName: draft.title,
    },
    assigned: {
      activityCode: '00-00-01',
      activitySequence: 1,
      instanceSequence: 1,
      baseTitle: draft.title,
      title: draft.title,
    },
    crewSize: draft.crewSize,
    hoursPerDay: draft.hoursPerDay,
    durationDaysOverride,
    scheduleEnabled: draft.scheduleEnabled,
    projectLaborRates,
    projectActivityId: 'preview-activity',
  });
}
