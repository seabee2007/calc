import {
  calculateContingency,
  calculateFinalSellPrice,
  calculateOverhead,
  calculateProfit,
  calculateTax,
  roundToTwo,
  sanitizeCost,
} from '../domain/estimateMath';
import type {
  ConceptualEstimateLineItem,
  ConceptualEstimatePayload,
  ConceptualEstimateRollup,
  ConceptualEstimateScenario,
  ConceptualRisk,
  ConfidenceLevel,
  ConceptualLineItemType,
} from '../domain/conceptualEstimateTypes';
import {
  normalizeEstimateSettings,
  resolveOverheadBaseAmount,
  resolveProfitBaseAmount,
  resolveTaxBaseAmount,
  type EstimateSettings,
} from './estimateSettings';
import type { EstimateCostTotals } from '../domain/estimateTypes';

function normalizeNonNegative(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) < 0) return 0;
  return value ?? 0;
}

export function createConceptualEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Compute line item amount from type-specific inputs. */
export function calculateConceptualLineItemAmount(
  type: ConceptualLineItemType,
  quantity: number | null | undefined,
  unitCost: number | null | undefined,
  amount: number | null | undefined,
): number {
  if (type === 'square_foot' || type === 'unit_cost') {
    const qty = normalizeNonNegative(quantity);
    const rate = normalizeNonNegative(unitCost);
    return roundToTwo(qty * rate);
  }
  return roundToTwo(normalizeNonNegative(amount));
}

export function applyLineItemAmount(item: ConceptualEstimateLineItem): ConceptualEstimateLineItem {
  const amount = calculateConceptualLineItemAmount(
    item.type,
    item.quantity,
    item.unitCost,
    item.amount,
  );
  return { ...item, amount };
}

export function calculateConceptualSubtotal(lineItems: readonly ConceptualEstimateLineItem[]): number {
  return roundToTwo(
    lineItems.reduce((sum, item) => sum + normalizeNonNegative(item.amount), 0),
  );
}

export function calculateEscalationTotal(lineItems: readonly ConceptualEstimateLineItem[]): number {
  return roundToTwo(
    lineItems.reduce((sum, item) => {
      const base = normalizeNonNegative(item.amount);
      const pct = normalizeNonNegative(item.escalationPercent);
      return sum + base * (pct / 100);
    }, 0),
  );
}

export function calculateTotalRiskExposure(risks: readonly ConceptualRisk[]): number {
  return roundToTwo(
    risks.reduce((sum, risk) => {
      if (risk.includedInContingency) return sum;
      return sum + normalizeNonNegative(risk.costExposure);
    }, 0),
  );
}

export function calculateRecommendedContingencyPercent(
  risks: readonly ConceptualRisk[],
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  const exposure = risks
    .filter((risk) => risk.includedInContingency)
    .reduce((sum, risk) => sum + normalizeNonNegative(risk.costExposure), 0);
  if (exposure <= 0) return 0;
  return roundToTwo(Math.min(50, (exposure / subtotal) * 100));
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function aggregateConfidenceLevel(
  lineItems: readonly ConceptualEstimateLineItem[],
): ConfidenceLevel {
  if (lineItems.length === 0) return 'medium';
  const avg =
    lineItems.reduce((sum, item) => sum + CONFIDENCE_RANK[item.confidenceLevel], 0) /
    lineItems.length;
  if (avg >= 2.5) return 'high';
  if (avg >= 1.5) return 'medium';
  return 'low';
}

export function buildConceptualEstimateRollup(
  payload: ConceptualEstimatePayload,
  settingsInput?: Partial<EstimateSettings> | null,
): ConceptualEstimateRollup {
  const settings = normalizeEstimateSettings(settingsInput);
  const subtotal = calculateConceptualSubtotal(payload.lineItems);
  const escalationTotal = calculateEscalationTotal(payload.lineItems);
  const directCost = roundToTwo(subtotal + escalationTotal);
  const contingencyPercent = normalizeNonNegative(payload.contingencyPercent);
  const indirectCost = calculateOverhead(directCost, settings.indirectCostPercent);
  const overheadBaseAmount = resolveOverheadBaseAmount(settings, directCost, 0);
  const overhead = calculateOverhead(overheadBaseAmount, settings.overheadPercent);
  const profitBaseAmount = resolveProfitBaseAmount(settings, directCost, indirectCost, overhead);
  const profit = calculateProfit(profitBaseAmount, settings.profitPercent);
  const subtotalBeforeContingency = roundToTwo(directCost + indirectCost + overhead + profit);
  const contingencyAmount = calculateContingency(subtotalBeforeContingency, contingencyPercent);
  const subtotalBeforeTax = roundToTwo(subtotalBeforeContingency + contingencyAmount);
  const taxBaseAmount = resolveTaxBaseAmount(settings, 0, subtotalBeforeTax);
  const tax =
    settings.taxBase === 'none' ? 0 : calculateTax(taxBaseAmount, settings.taxPercent);
  const finalSellPrice = calculateFinalSellPrice({
    directCost,
    indirectCost,
    overhead,
    profit,
    contingency: contingencyAmount,
    tax,
  });

  return {
    subtotal,
    escalationTotal,
    contingencyAmount,
    contingencyPercent,
    overhead,
    profit,
    tax,
    indirectCost,
    finalSellPrice,
    totalRiskExposure: calculateTotalRiskExposure(payload.risks),
    recommendedContingencyPercent: calculateRecommendedContingencyPercent(
      payload.risks,
      subtotalBeforeContingency,
    ),
    aggregateConfidence: aggregateConfidenceLevel(payload.lineItems),
  };
}

export function buildConceptualEstimateCostTotals(
  rollup: ConceptualEstimateRollup,
): EstimateCostTotals {
  return {
    directCost: rollup.subtotal + rollup.escalationTotal,
    indirectCost: rollup.indirectCost,
    overhead: rollup.overhead,
    profit: rollup.profit,
    contingency: rollup.contingencyAmount,
    tax: rollup.tax,
    finalSellPrice: rollup.finalSellPrice,
  };
}

export function calculateScenarioTotals(
  payload: ConceptualEstimatePayload,
  scenario: ConceptualEstimateScenario,
  settingsInput?: Partial<EstimateSettings> | null,
): ConceptualEstimateScenario {
  const lineItems = payload.lineItems.filter((item) => scenario.lineItemIds.includes(item.id));
  const scenarioPayload: ConceptualEstimatePayload = {
    ...payload,
    lineItems,
  };
  const rollup = buildConceptualEstimateRollup(scenarioPayload, settingsInput);
  return {
    ...scenario,
    subtotal: rollup.subtotal,
    contingency: rollup.contingencyAmount,
    total: rollup.finalSellPrice,
  };
}

export function recalculateScenarioTotals(
  payload: ConceptualEstimatePayload,
  settingsInput?: Partial<EstimateSettings> | null,
): ConceptualEstimateScenario[] {
  return payload.scenarios.map((scenario) =>
    calculateScenarioTotals(payload, scenario, settingsInput),
  );
}

export function duplicateScenarioFromBudget(
  payload: ConceptualEstimatePayload,
  name: string,
  description?: string,
): ConceptualEstimateScenario {
  const now = new Date().toISOString();
  const scenario: ConceptualEstimateScenario = {
    id: createConceptualEntityId('scenario'),
    name,
    description: description ?? null,
    lineItemIds: payload.lineItems.map((item) => item.id),
    subtotal: 0,
    contingency: 0,
    total: 0,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
  return calculateScenarioTotals(payload, scenario);
}

export function createConceptualLineItem(
  type: ConceptualLineItemType,
  partial: Partial<ConceptualEstimateLineItem> & Pick<ConceptualEstimateLineItem, 'title'>,
): ConceptualEstimateLineItem {
  const now = new Date().toISOString();
  const draft: ConceptualEstimateLineItem = {
    id: createConceptualEntityId('cli'),
    type,
    title: partial.title.trim(),
    description: partial.description ?? null,
    divisionCode: partial.divisionCode ?? null,
    divisionName: partial.divisionName ?? null,
    systemCategory: partial.systemCategory ?? null,
    quantity: partial.quantity ?? null,
    unit: partial.unit ?? null,
    unitCost: partial.unitCost ?? null,
    amount: partial.amount ?? 0,
    confidenceLevel: partial.confidenceLevel ?? 'medium',
    sourceBasis: partial.sourceBasis ?? 'estimator_judgment',
    escalationPercent: partial.escalationPercent ?? null,
    notes: partial.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return applyLineItemAmount(draft);
}
