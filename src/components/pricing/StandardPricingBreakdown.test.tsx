import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StandardPricingBreakdown from './StandardPricingBreakdown';
import type { ChangeOrderPricingBreakdown } from '../../utils/changeOrderFinancials';

const breakdown: ChangeOrderPricingBreakdown = {
  pricingModel: 'standard',
  laborTotal: 1000,
  materialTotal: 500,
  equipmentTotal: 0,
  subcontractorTotal: 0,
  materialCostBase: 500,
  wasteFactorPercent: 10,
  wasteCost: 50,
  materialCostAdjusted: 550,
  directCost: 1550,
  feesAmount: 0,
  permitsAmount: 0,
  contingencyPercent: 5,
  contingencyCost: 77.5,
  preTaxCost: 1627.5,
  taxSystem: 'none',
  taxRatePercent: 0,
  taxApplication: 'materials_only',
  taxCost: 0,
  costBeforeOverhead: 1627.5,
  overheadPercent: 10,
  overheadAmount: 162.75,
  costWithOverhead: 1790.25,
  totalEstimatedCost: 1790.25,
  targetMarginPercent: 20,
  grossProfit: 447.56,
  grossMarginPercent: 20,
  markupPercentReporting: 25,
  profitPercent: 0,
  profitAmount: 447.56,
  markupPercent: 0,
  markupAmount: 0,
  indirectCost: 447.56,
  importedIndirectCost: 0,
  totalPrice: 2237.81,
};

describe('StandardPricingBreakdown', () => {
  it('uses theme-safe text classes for pricing sections', () => {
    const { container } = render(<StandardPricingBreakdown breakdown={breakdown} />);

    expect(screen.getByText('Pricing breakdown')).toBeInTheDocument();
    expect(screen.getByText('Final proposal total')).toBeInTheDocument();
    expect(container.innerHTML).toContain('text-slate-900 dark:text-slate-100');
    expect(container.innerHTML).toContain('text-cyan-700 dark:text-cyan-400');
    expect(container.innerHTML).not.toContain('text-slate-200');
  });
});
