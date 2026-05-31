import type { ChangeOrder } from '../types/changeOrder';
import type { ProposalData } from '../types/proposal';
import type {
  CompanyTaxDefaults,
  PricingModel,
  PricingParams,
  TaxApplication,
  TaxSystem,
} from '../types/pricingParams';
import {
  DEFAULT_OVERHEAD_PERCENT,
  DEFAULT_PROFIT_PERCENT,
  DEFAULT_TARGET_MARGIN_PERCENT,
  DEFAULT_WASTE_FACTOR_PERCENT,
} from './changeOrderFinancials';

/** Coerce pricing params so runtime never sees NaN/undefined in calculations. */
export function normalizePricingParams(params: PricingParams): PricingParams {
  return {
    pricingModel: params.pricingModel ?? 'standard',
    wasteFactorPercent: Math.max(0, Number(params.wasteFactorPercent) || 0),
    contingencyPercent: Math.max(0, Number(params.contingencyPercent) || 0),
    overheadPercent: Math.max(0, Number(params.overheadPercent) || 0),
    targetMarginPercent: Math.max(0, Number(params.targetMarginPercent) || 0),
    feesAmount: Math.max(0, Number(params.feesAmount) || 0),
    permitsAmount: Math.max(0, Number(params.permitsAmount) || 0),
    taxSystem: params.taxSystem ?? 'none',
    taxRatePercent: Math.max(0, Number(params.taxRatePercent) || 0),
    taxApplication: params.taxApplication ?? 'materials_only',
    profitPercent: Math.max(0, Number(params.profitPercent ?? DEFAULT_PROFIT_PERCENT)),
    markupPercent: Math.max(0, Number(params.markupPercent) || 0),
  };
}

export function defaultPricingParams(
  companyTax?: CompanyTaxDefaults,
): PricingParams {
  return {
    pricingModel: 'standard',
    wasteFactorPercent: DEFAULT_WASTE_FACTOR_PERCENT,
    contingencyPercent: 0,
    overheadPercent: DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent: DEFAULT_TARGET_MARGIN_PERCENT,
    feesAmount: 0,
    permitsAmount: 0,
    taxSystem: companyTax?.taxSystem ?? 'none',
    taxRatePercent: companyTax?.taxRatePercent ?? 0,
    taxApplication: companyTax?.taxApplication ?? 'materials_only',
    profitPercent: DEFAULT_PROFIT_PERCENT,
    markupPercent: 0,
  };
}

function isLegacyIndirect(data: ProposalData): boolean {
  const p = data.pricingIndirect;
  if (!p) return false;
  if (p.pricingModel === 'legacy') return true;
  if (p.pricingModel === 'standard') return false;
  const hasStandardFields =
    p.wasteFactorPercent != null ||
    p.targetMarginPercent != null ||
    p.taxSystem != null;
  if (hasStandardFields) return false;
  return p.profitPercent != null && p.targetMarginPercent == null;
}

export function hydratePricingParams(
  data: ProposalData,
  companyTax?: CompanyTaxDefaults,
): PricingParams {
  const base = defaultPricingParams(companyTax);
  const raw = data.pricingIndirect;
  if (!raw) {
    return base;
  }

  const merged: PricingParams = {
    ...base,
    feesAmount: raw.feesAmount ?? base.feesAmount,
    permitsAmount: raw.permitsAmount ?? base.permitsAmount,
    overheadPercent: raw.overheadPercent ?? base.overheadPercent,
    wasteFactorPercent: raw.wasteFactorPercent ?? base.wasteFactorPercent,
    contingencyPercent: raw.contingencyPercent ?? base.contingencyPercent,
    targetMarginPercent: raw.targetMarginPercent ?? base.targetMarginPercent,
    taxSystem: (raw.taxSystem as TaxSystem) ?? base.taxSystem,
    taxRatePercent: raw.taxRatePercent ?? base.taxRatePercent,
    taxApplication: (raw.taxApplication as TaxApplication) ?? base.taxApplication,
    profitPercent: raw.profitPercent ?? base.profitPercent,
    markupPercent: raw.markupPercent ?? base.markupPercent,
    pricingModel: raw.pricingModel as PricingModel | undefined,
  };

  if (!merged.pricingModel) {
    merged.pricingModel = isLegacyIndirect(data) ? 'legacy' : 'standard';
  }
  return normalizePricingParams(merged);
}

export function pricingParamsToIndirect(params: PricingParams): ProposalData['pricingIndirect'] {
  return { ...params };
}

/** Build pricing params from a saved change order row. */
export function pricingParamsFromChangeOrder(
  co: Pick<
    ChangeOrder,
    | 'pricingModel'
    | 'wasteFactorPercent'
    | 'contingencyPercent'
    | 'overheadPercent'
    | 'targetMarginPercent'
    | 'feesAmount'
    | 'permitsAmount'
    | 'taxSystem'
    | 'taxRatePercent'
    | 'taxApplication'
    | 'profitPercent'
    | 'markupPercent'
  >,
): PricingParams {
  return normalizePricingParams({
    pricingModel: co.pricingModel ?? 'standard',
    wasteFactorPercent: co.wasteFactorPercent ?? DEFAULT_WASTE_FACTOR_PERCENT,
    contingencyPercent: co.contingencyPercent ?? 0,
    overheadPercent: co.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent: co.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT,
    feesAmount: co.feesAmount ?? 0,
    permitsAmount: co.permitsAmount ?? 0,
    taxSystem: (co.taxSystem as TaxSystem) ?? 'none',
    taxRatePercent: co.taxRatePercent ?? 0,
    taxApplication: (co.taxApplication as TaxApplication) ?? 'materials_only',
    profitPercent: co.profitPercent ?? DEFAULT_PROFIT_PERCENT,
    markupPercent: co.markupPercent ?? 0,
  });
}
