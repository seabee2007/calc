import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('starts with internal cost breakdown collapsed and summary total visible', () => {
    render(<StandardPricingBreakdown breakdown={breakdown} />);

    const toggle = screen.getByTestId('internal-cost-breakdown-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Internal Cost Breakdown')).toBeInTheDocument();
    expect(screen.getAllByText('$1,790.25').length).toBeGreaterThan(0);
    expect(screen.queryByText('Materials (base)')).not.toBeInTheDocument();
    expect(screen.getByText('Pricing breakdown')).toBeInTheDocument();
  });

  it('expands and collapses internal cost breakdown from the header', async () => {
    const user = userEvent.setup();
    render(<StandardPricingBreakdown breakdown={breakdown} />);

    const toggle = screen.getByTestId('internal-cost-breakdown-toggle');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Materials (base)')).toBeInTheDocument();
    expect(screen.getByText('Direct cost')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => {
      expect(screen.queryByText('Materials (base)')).not.toBeInTheDocument();
    });
  });
});
