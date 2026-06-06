import type {
  QuickFeasibilityInputs,
  QuickFeasibilityResult,
} from './estimateQuickFeasibility';
import {
  getSquareFootPricingLocationByCode,
  getSquareFootPricingImportantLimitations,
} from './estimateQuickFeasibility';
import type {
  EstimateSummary,
  EstimateVersionRow,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';
import {
  createEstimateVersion,
  listEstimateVersions,
  updateEstimateCurrentVersion,
  type CreateEstimateVersionParams,
  type UpdateEstimateCurrentVersionParams,
} from '../infrastructure/estimateRepository';
import { computeNextVersionNumber } from './saveEstimateVersionWithLineItems';

export interface SaveQuickFeasibilityEstimateParams {
  estimateId: string;
  projectId: string;
  inputs: QuickFeasibilityInputs;
  result: QuickFeasibilityResult;
  createdBy?: string | null;
}

export interface SaveQuickFeasibilityEstimateResult {
  versionId: string;
  versionNumber: number;
}

export interface SaveQuickFeasibilityEstimateDeps {
  listEstimateVersions: (
    estimateId: string,
  ) => Promise<RepositoryResult<EstimateVersionRow[]>>;
  createEstimateVersion: (
    params: CreateEstimateVersionParams,
  ) => Promise<RepositoryResult<EstimateVersionRow>>;
  updateEstimateCurrentVersion: (
    params: UpdateEstimateCurrentVersionParams,
  ) => Promise<RepositoryResult<EstimateSummary>>;
}

const defaultDeps: SaveQuickFeasibilityEstimateDeps = {
  listEstimateVersions,
  createEstimateVersion,
  updateEstimateCurrentVersion,
};

function failure(error: string): RepositoryResult<SaveQuickFeasibilityEstimateResult> {
  return { data: null, error };
}

function buildQuickFeasibilitySnapshot(
  params: SaveQuickFeasibilityEstimateParams,
  versionNumber: number,
): Record<string, unknown> {
  const location = getSquareFootPricingLocationByCode(params.inputs.locationCode);
  const generatedAt = new Date().toISOString();
  const breakdown = params.result.breakdown;

  return {
    type: 'quick_feasibility',
    meta: {
      estimateId: params.estimateId,
      projectId: params.projectId,
      estimateType: 'quick_feasibility',
      status: 'draft',
      version: versionNumber,
      generatedAt,
      estimateMode: 'quick_feasibility',
    },
    inputs: params.inputs,
    totals: breakdown.totals,
    labor: breakdown.labor,
    schedule: breakdown.schedule,
    assumptions: breakdown.assumptions,
    quickFeasibility: {
      projectType: params.inputs.projectType,
      locationCode: params.inputs.locationCode,
      squareFeet: params.inputs.areaSF,
      basePricePerSf: params.inputs.basePricePerSf,
      basePricePerSfOverridden: params.inputs.basePricePerSfOverridden,
      finishLevel: params.inputs.finishLevel,
      complexity: params.inputs.complexityLevel,
      siteCondition: params.inputs.siteCondition,
      mepIntensity: params.inputs.mepIntensity,
      manualLocationAdjustmentFactor: params.inputs.manualLocationAdjustmentFactor,
      contingencyPercent: params.inputs.contingencyPercent,
      baseCost: params.result.baseCost,
      adjustedCost: params.result.adjustedCost,
      contingencyAmount: params.result.contingencyAmount,
      likelyTotal: params.result.likelyTotal,
      lowTotal: params.result.lowTotal,
      highTotal: params.result.highTotal,
      adjustedCostPerSf: params.result.adjustedCostPerSF,
      totals: breakdown.totals,
      labor: breakdown.labor,
      schedule: breakdown.schedule,
      breakdownAssumptions: breakdown.assumptions,
      assumptions: params.result.assumptions,
      warnings: params.result.warnings,
      locationPricing: location
        ? {
            code: location.code,
            name: location.name,
            suggestedMidWithContractorOHProfit:
              location.newConstruction.suggestedMidWithContractorOHProfit,
            hardCostAvg: location.newConstruction.hardCostAvg,
            planningLow: location.newConstruction.planningLow,
            planningHigh: location.newConstruction.planningHigh,
            locationFactorVsNational195: location.locationFactorVsNational195,
            confidence: location.confidence,
            notes: location.notes,
          }
        : null,
      importantLimitations: getSquareFootPricingImportantLimitations(),
    },
  };
}

function buildQuickFeasibilityTotals(
  result: QuickFeasibilityResult,
): Record<string, unknown> {
  const { totals, labor, schedule } = result.breakdown;
  return {
    finalSellPrice: totals.totalEstimate,
    totalEstimate: totals.totalEstimate,
    directCost: totals.materialCost + totals.laborCost + totals.equipmentCost,
    laborCost: totals.laborCost,
    materialCost: totals.materialCost,
    equipmentCost: totals.equipmentCost,
    overhead: totals.overhead,
    profit: totals.profit,
    contingency: 0,
    laborHours: labor.laborHours,
    manDays: labor.manDays,
    crewDays: labor.crewDays,
    estimatedCrewSize: labor.estimatedCrewSize,
    plannedDurationDays: schedule.plannedDurationDays,
    quickFeasibility: true,
  };
}

export async function saveQuickFeasibilityEstimate(
  params: SaveQuickFeasibilityEstimateParams,
  deps: SaveQuickFeasibilityEstimateDeps = defaultDeps,
): Promise<RepositoryResult<SaveQuickFeasibilityEstimateResult>> {
  if (!params.result.isValid) {
    return failure(params.result.validationMessages[0] ?? 'Quick feasibility estimate is incomplete.');
  }

  const versionsResult = await deps.listEstimateVersions(params.estimateId);
  if (versionsResult.error || !versionsResult.data) {
    return failure(versionsResult.error ?? 'Failed to list estimate versions.');
  }

  const versionNumber = computeNextVersionNumber(versionsResult.data);
  const versionName = `Quick Feasibility v${versionNumber}`;

  const versionResult = await deps.createEstimateVersion({
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber,
    versionName,
    estimateType: 'quick_feasibility',
    status: 'draft',
    snapshot: buildQuickFeasibilitySnapshot(params, versionNumber),
    totals: buildQuickFeasibilityTotals(params.result),
    createdBy: params.createdBy ?? null,
  });

  if (versionResult.error || !versionResult.data) {
    return failure(versionResult.error ?? 'Failed to create quick feasibility version.');
  }

  const linkResult = await deps.updateEstimateCurrentVersion({
    estimateId: params.estimateId,
    versionId: versionResult.data.id,
  });

  if (linkResult.error || !linkResult.data) {
    return failure(linkResult.error ?? 'Failed to update current estimate version.');
  }

  return {
    data: {
      versionId: versionResult.data.id,
      versionNumber,
    },
    error: null,
  };
}
