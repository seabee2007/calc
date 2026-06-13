import type { ChangeOrderLineItem } from '../types/changeOrder';
import type { ProposalPricingIndirect, ImportedEstimateSummary } from '../types/proposal';
import type { Project } from '../types';
import type { CompanyTaxDefaults } from '../types/pricingParams';
import {
  calculateEstimateTotalsFromConstructionActivities,
  type ConstructionActivityEstimateTotals,
} from '../features/estimating/application/constructionActivityEstimateTotals';
import { loadProjectActivitiesWithLineItems } from '../features/estimating/application/constructionActivityService';
import {
  getCurrentEstimate,
  type CurrentEstimate,
} from '../features/estimating/application/currentEstimateService';
import {
  parseEstimateSettingsFromAssumptions,
  type EstimateSettings,
} from '../features/estimating/application/estimateSettings';
import type {
  ActivityEquipmentResource,
  ActivityMaterialResource,
  ProjectActivityLineItem,
  ProjectConstructionActivity,
} from '../features/estimating/domain/constructionActivityTypes';
import {
  fetchProjectEquipmentResources,
  fetchProjectMaterialResources,
} from '../features/estimating/infrastructure/activityRepository';
import { roundToTwo } from '../features/estimating/domain/estimateMath';
import { computeLaborMaterialLineTotal } from './changeOrderFinancials';
import {
  buildProposalLineItemsFromProject,
  projectHasImportablePricing,
  type ProposalLineItemsFromProject,
} from './proposalPricingImport';

export interface CurrentEstimateImportContext {
  estimate: CurrentEstimate;
  activities: ProjectConstructionActivity[];
  lineItemsByActivityId: Map<string, ProjectActivityLineItem[]>;
  materialResources: ActivityMaterialResource[];
  equipmentResources: ActivityEquipmentResource[];
}

export interface ProposalImportFromCurrentEstimate extends ProposalLineItemsFromProject {
  subcontractorItems: ChangeOrderLineItem[];
  pricingIndirect: Partial<ProposalPricingIndirect>;
  importedEstimateSummary: ImportedEstimateSummary;
}

export type ProposalPricingImportSource = 'current-estimate' | 'legacy';

export interface ResolvedProposalPricingImport {
  source: ProposalPricingImportSource;
  currentEstimateImport?: ProposalImportFromCurrentEstimate;
  legacyLineItems?: ProposalLineItemsFromProject;
}

function roundMoney(value: number): number {
  return roundToTwo(value);
}

function activityLabel(activity: ProjectConstructionActivity): string {
  const code = activity.activityCode || activity.code || '';
  const title = activity.title || activity.name || 'Activity';
  return code ? `${code} — ${title}` : title;
}

function activityNameById(
  activities: readonly ProjectConstructionActivity[],
): Map<string, string> {
  return new Map(activities.map((activity) => [activity.id, activityLabel(activity)]));
}

function resolveActivityLaborCost(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): number {
  if (activity.totalLaborCost != null && Number.isFinite(activity.totalLaborCost)) {
    return roundMoney(activity.totalLaborCost);
  }
  return roundMoney(
    (lineItems ?? []).reduce((sum, item) => sum + (item.laborCost ?? 0), 0),
  );
}

function resolveActivitySubcontractCost(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): number {
  if (activity.totalSubcontractCost != null && Number.isFinite(activity.totalSubcontractCost)) {
    return roundMoney(activity.totalSubcontractCost);
  }
  return roundMoney(
    (lineItems ?? []).reduce((sum, item) => sum + (item.subcontractCost ?? 0), 0),
  );
}

function resolveActivityManHours(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): number {
  if (activity.calculatedManHours != null && Number.isFinite(activity.calculatedManHours)) {
    return roundMoney(activity.calculatedManHours);
  }
  return roundMoney(
    (lineItems ?? []).reduce((sum, item) => sum + (item.calculatedManHours ?? 0), 0),
  );
}

function buildLaborLine(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): ChangeOrderLineItem | null {
  const amount = resolveActivityLaborCost(activity, lineItems);
  if (amount <= 0) return null;

  const hours = resolveActivityManHours(activity, lineItems);
  if (hours > 0) {
    const row: ChangeOrderLineItem = {
      description: activityLabel(activity),
      qty: hours,
      unitPrice: roundMoney(amount / hours),
      amount: 0,
    };
    return { ...row, amount: computeLaborMaterialLineTotal(row) };
  }

  return { description: activityLabel(activity), amount };
}

function buildSubcontractorLine(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[] | undefined,
): ChangeOrderLineItem | null {
  const amount = resolveActivitySubcontractCost(activity, lineItems);
  if (amount <= 0) return null;
  return { description: `${activityLabel(activity)} — Subcontract`, amount };
}

function buildMaterialLines(
  resources: readonly ActivityMaterialResource[],
  activityNames: Map<string, string>,
): ChangeOrderLineItem[] {
  return resources
    .filter((resource) => roundMoney(resource.totalCost) > 0)
    .map((resource) => {
      const activityName = activityNames.get(resource.activityId);
      const description = activityName
        ? `${resource.name} (${activityName})`
        : resource.name;
      const qty = Number(resource.quantity) || 0;
      const unitPrice = roundMoney(resource.unitCost);
      if (qty > 0 && unitPrice > 0) {
        const row: ChangeOrderLineItem = {
          description,
          qty,
          unitPrice,
          amount: 0,
        };
        return { ...row, amount: computeLaborMaterialLineTotal(row) };
      }
      return { description, amount: roundMoney(resource.totalCost) };
    });
}

function buildEquipmentLines(
  resources: readonly ActivityEquipmentResource[],
  activityNames: Map<string, string>,
): ChangeOrderLineItem[] {
  return resources
    .filter((resource) => roundMoney(resource.totalCost) > 0)
    .map((resource) => {
      const activityName = activityNames.get(resource.activityId);
      const description = activityName
        ? `${resource.name} (${activityName})`
        : resource.name;
      const qty = Number(resource.quantity) || 0;
      const unitPrice = roundMoney(resource.unitCost);
      if (qty > 0 && unitPrice > 0) {
        const row: ChangeOrderLineItem = {
          description,
          qty,
          unitPrice,
          amount: 0,
        };
        return { ...row, amount: computeLaborMaterialLineTotal(row) };
      }
      return { description, amount: roundMoney(resource.totalCost) };
    });
}

export function mapEstimateSettingsToProposalIndirect(
  settings: EstimateSettings,
  companyTax?: CompanyTaxDefaults,
): Partial<ProposalPricingIndirect> {
  return {
    pricingModel: 'standard',
    wasteFactorPercent: 0,
    contingencyPercent: settings.contingencyPercent,
    overheadPercent: settings.overheadPercent,
    targetMarginPercent: settings.profitPercent,
    profitPercent: settings.profitPercent,
    feesAmount: 0,
    permitsAmount: 0,
    taxSystem: companyTax?.taxSystem ?? 'none',
    taxRatePercent: settings.taxPercent || companyTax?.taxRatePercent || 0,
    taxApplication: companyTax?.taxApplication ?? 'materials_only',
  };
}

export function buildImportedEstimateSummary(
  totals: ConstructionActivityEstimateTotals,
  settings: EstimateSettings,
): ImportedEstimateSummary {
  return {
    laborTotal: totals.laborCost,
    materialTotal: totals.materialCost,
    equipmentTotal: totals.equipmentCost,
    subcontractorTotal: totals.subcontractorCost,
    indirectCostTotal: totals.indirectCost,
    directCost: totals.directCostSubtotal,
    overheadTotal: totals.overheadAmount,
    profitTotal: totals.profitAmount,
    contingencyTotal: totals.contingencyAmount,
    taxTotal: totals.taxAmount,
    finalSellPrice: totals.grandTotal,
    contingencyPercent: totals.contingencyPercent,
    overheadPercent: totals.overheadPercent,
    profitPercent: totals.profitPercent,
    taxPercent: totals.taxPercent,
    targetMarginPercent: settings.profitPercent,
  };
}

export function currentEstimateContextHasImportablePricing(
  context: CurrentEstimateImportContext,
): boolean {
  const settings = parseEstimateSettingsFromAssumptions(context.estimate.assumptions);
  const totals = calculateEstimateTotalsFromConstructionActivities({
    activities: context.activities,
    markupSettings: settings,
    lineItemsByActivityId: context.lineItemsByActivityId,
    projectMaterialResources: context.materialResources,
    projectEquipmentResources: context.equipmentResources,
  });

  return (
    context.activities.length > 0 ||
    totals.grandTotal > 0 ||
    totals.directCostSubtotal > 0 ||
    totals.laborCost > 0 ||
    totals.materialCost > 0 ||
    totals.equipmentCost > 0
  );
}

export function buildProposalImportFromCurrentEstimate(
  context: CurrentEstimateImportContext,
  companyTax?: CompanyTaxDefaults,
): ProposalImportFromCurrentEstimate | null {
  if (!currentEstimateContextHasImportablePricing(context)) {
    return null;
  }

  const settings = parseEstimateSettingsFromAssumptions(context.estimate.assumptions);
  const totals = calculateEstimateTotalsFromConstructionActivities({
    activities: context.activities,
    markupSettings: settings,
    lineItemsByActivityId: context.lineItemsByActivityId,
    projectMaterialResources: context.materialResources,
    projectEquipmentResources: context.equipmentResources,
  });

  const activityNames = activityNameById(context.activities);
  const laborItems: ChangeOrderLineItem[] = [];
  const subcontractorItems: ChangeOrderLineItem[] = [];

  for (const activity of context.activities) {
    const lineItems = context.lineItemsByActivityId.get(activity.id);
    const laborLine = buildLaborLine(activity, lineItems);
    if (laborLine) laborItems.push(laborLine);

    const subcontractLine = buildSubcontractorLine(activity, lineItems);
    if (subcontractLine) subcontractorItems.push(subcontractLine);
  }

  const materialItems = buildMaterialLines(context.materialResources, activityNames);
  const equipmentItems = buildEquipmentLines(context.equipmentResources, activityNames);

  return {
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    pricingIndirect: mapEstimateSettingsToProposalIndirect(settings, companyTax),
    importedEstimateSummary: buildImportedEstimateSummary(totals, settings),
  };
}

export async function loadCurrentEstimateImportContext(
  projectId: string,
): Promise<CurrentEstimateImportContext | null> {
  const estimate = await getCurrentEstimate(projectId);
  if (!estimate) return null;

  const [activitiesResult, materialResult, equipmentResult] = await Promise.all([
    loadProjectActivitiesWithLineItems(projectId, estimate.id),
    fetchProjectMaterialResources(projectId),
    fetchProjectEquipmentResources(projectId),
  ]);

  if (activitiesResult.error) {
    throw new Error(activitiesResult.error);
  }
  if (materialResult.error) {
    throw new Error(materialResult.error);
  }
  if (equipmentResult.error) {
    throw new Error(equipmentResult.error);
  }

  const lineItemsByActivityId = new Map<string, ProjectActivityLineItem[]>(
    (activitiesResult.data ?? []).map((loaded) => [loaded.activity.id, loaded.lineItems]),
  );

  return {
    estimate,
    activities: (activitiesResult.data ?? []).map((loaded) => loaded.activity),
    lineItemsByActivityId,
    materialResources: materialResult.data ?? [],
    equipmentResources: equipmentResult.data ?? [],
  };
}

export function countProposalImportLineItems(
  pricingImport: ProposalImportFromCurrentEstimate,
): number {
  return (
    pricingImport.laborItems.length +
    pricingImport.materialItems.length +
    pricingImport.equipmentItems.length +
    pricingImport.subcontractorItems.length
  );
}

/** True when the project has legacy calculator pricing or a current estimate with importable totals. */
export async function projectHasImportablePricingAsync(
  projectId: string,
  project: Project,
): Promise<boolean> {
  try {
    const context = await loadCurrentEstimateImportContext(projectId);
    if (context && currentEstimateContextHasImportablePricing(context)) {
      return true;
    }
  } catch {
    // Fall back to legacy detection below.
  }
  return projectHasImportablePricing(project);
}

/**
 * Prefer current estimate import; fall back to legacy calculator/project import when none exists.
 */
export async function resolveProposalPricingImport(
  projectId: string,
  project: Project,
  companyTax?: CompanyTaxDefaults,
): Promise<ResolvedProposalPricingImport | null> {
  try {
    const context = await loadCurrentEstimateImportContext(projectId);
    if (context) {
      const currentEstimateImport = buildProposalImportFromCurrentEstimate(context, companyTax);
      if (currentEstimateImport) {
        return { source: 'current-estimate', currentEstimateImport };
      }
    }
  } catch (error) {
    console.error('Failed to load current estimate for proposal import:', error);
  }

  if (!projectHasImportablePricing(project)) {
    return null;
  }

  return {
    source: 'legacy',
    legacyLineItems: buildProposalLineItemsFromProject(project),
  };
}
