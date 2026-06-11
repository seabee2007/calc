import { describe, expect, it } from 'vitest';
import {
  applyLineItemAmount,
  buildConceptualEstimateCostTotals,
  buildConceptualEstimateRollup,
  calculateConceptualLineItemAmount,
  calculateConceptualSubtotal,
  calculateRecommendedContingencyPercent,
  calculateTotalRiskExposure,
  createConceptualLineItem,
  duplicateScenarioFromBudget,
  recalculateScenarioTotals,
} from '../application/conceptualEstimateCalculations';
import { createEmptyConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';

describe('conceptualEstimateCalculations', () => {
  it('calculates square-foot amount from area and cost per SF', () => {
    expect(calculateConceptualLineItemAmount('square_foot', 10000, 250, 0)).toBe(2500000);
  });

  it('calculates unit cost amount from quantity and unit cost', () => {
    expect(calculateConceptualLineItemAmount('unit_cost', 120, 45, 0)).toBe(5400);
  });

  it('uses direct amount for division, lump sum, and allowance items', () => {
    expect(calculateConceptualLineItemAmount('division_budget', null, null, 750000)).toBe(750000);
    expect(calculateConceptualLineItemAmount('lump_sum', null, null, 125000)).toBe(125000);
    expect(calculateConceptualLineItemAmount('allowance', null, null, 50000)).toBe(50000);
  });

  it('sums line items into subtotal', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.lineItems = [
      createConceptualLineItem('square_foot', { title: 'Building shell', quantity: 1000, unitCost: 200 }),
      createConceptualLineItem('allowance', { title: 'Owner allowance', amount: 50000 }),
    ];
    expect(calculateConceptualSubtotal(payload.lineItems)).toBe(250000);
  });

  it('applies contingency, overhead, and profit from estimate settings', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.lineItems = [
      createConceptualLineItem('lump_sum', { title: 'Core budget', amount: 1000000 }),
    ];
    payload.contingencyPercent = 10;
    const rollup = buildConceptualEstimateRollup(payload, {
      ...DEFAULT_ESTIMATE_SETTINGS,
      overheadPercent: 10,
      profitPercent: 5,
    });
    expect(rollup.subtotal).toBe(1000000);
    expect(rollup.contingencyAmount).toBeGreaterThan(0);
    expect(rollup.overhead).toBeGreaterThan(0);
    expect(rollup.profit).toBeGreaterThan(0);
    expect(rollup.finalSellPrice).toBeGreaterThan(rollup.subtotal);
  });

  it('builds estimate cost totals compatible with overview panel', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.lineItems = [createConceptualLineItem('lump_sum', { title: 'Budget', amount: 500000 })];
    const rollup = buildConceptualEstimateRollup(payload, DEFAULT_ESTIMATE_SETTINGS);
    const totals = buildConceptualEstimateCostTotals(rollup);
    expect(totals.directCost).toBe(500000);
    expect(totals.finalSellPrice).toBe(rollup.finalSellPrice);
  });

  it('rolls up risk exposure and recommended contingency', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.risks = [
      {
        id: 'risk-1',
        title: 'Steel escalation',
        description: '',
        probability: 'medium',
        impact: 'high',
        costExposure: 50000,
        includedInContingency: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'risk-2',
        title: 'Permit delay',
        description: '',
        probability: 'low',
        impact: 'medium',
        costExposure: 10000,
        includedInContingency: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(calculateTotalRiskExposure(payload.risks)).toBe(10000);
    expect(calculateRecommendedContingencyPercent(payload.risks, 1000000)).toBe(5);
  });

  it('duplicates budget into a scenario and compares totals', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.lineItems = [
      applyLineItemAmount(
        createConceptualLineItem('lump_sum', { title: 'Base', amount: 200000 }),
      ),
      applyLineItemAmount(
        createConceptualLineItem('allowance', { title: 'Allowance', amount: 25000 }),
      ),
    ];
    payload.contingencyPercent = 8;
    const scenario = duplicateScenarioFromBudget(payload, 'Base case');
    expect(scenario.lineItemIds).toHaveLength(2);
    expect(scenario.subtotal).toBe(225000);
    expect(scenario.total).toBeGreaterThan(scenario.subtotal);

    const recalculated = recalculateScenarioTotals(
      {
        ...payload,
        scenarios: [scenario],
      },
      DEFAULT_ESTIMATE_SETTINGS,
    );
    expect(recalculated[0]?.total).toBe(scenario.total);
  });
});
