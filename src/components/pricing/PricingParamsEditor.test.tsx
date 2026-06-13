import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingParamsEditor from './PricingParamsEditor';
import { defaultPricingParams } from '../../utils/pricingParams';
import { computeProposalBreakdown } from '../../utils/proposalPricing';
import type { ProposalData } from '../../types/proposal';

const baseParams = defaultPricingParams();

describe('PricingParamsEditor cost adjustments', () => {
  it('renders waste factor and contingency selects', () => {
    render(<PricingParamsEditor params={baseParams} onChange={vi.fn()} />);

    expect(screen.getByTestId('waste-factor-select')).toBeInTheDocument();
    expect(screen.getByTestId('contingency-percent-select')).toBeInTheDocument();
    expect(screen.getByText('Cost adjustments')).toBeInTheDocument();
  });

  it('does not render contingency preset buttons or custom contingency input', () => {
    render(<PricingParamsEditor params={baseParams} onChange={vi.fn()} />);

    expect(screen.queryByText('Custom contingency %')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '0%' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '15%' })).not.toBeInTheDocument();
  });

  it('updates waste factor when 10% is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PricingParamsEditor
        params={{ ...baseParams, wasteFactorPercent: 5 }}
        onChange={onChange}
      />,
    );

    const wasteSelect = screen.getByTestId('waste-factor-select');
    await user.click(within(wasteSelect).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '10%' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ wasteFactorPercent: 10 }),
    );
  });

  it('updates contingency when 15% is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PricingParamsEditor
        params={{ ...baseParams, contingencyPercent: 5 }}
        onChange={onChange}
      />,
    );

    const contingencySelect = screen.getByTestId('contingency-percent-select');
    await user.click(within(contingencySelect).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '15%' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contingencyPercent: 15 }),
    );
  });

  it('allows editing permits from an empty zero default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PricingParamsEditor params={baseParams} onChange={onChange} />);

    const permitsInput = screen.getByTestId('proposal-permits-input');
    await user.click(permitsInput);
    await user.type(permitsInput, '125');

    expect(onChange.mock.calls.some(([next]) => next.permitsAmount === 125)).toBe(true);
  });

  it('uses selected waste and contingency values in pricing breakdown', () => {
    const data: ProposalData = {
      businessName: '',
      clientName: '',
      projectTitle: '',
      date: '',
      introduction: '',
      scope: '',
      timeline: [],
      laborItems: [{ description: 'Labor', qty: 1, unit: 'hr', unitPrice: 1000, amount: 1000 }],
      materialItems: [{ description: 'Material', qty: 1, unit: 'ea', unitPrice: 1000, amount: 1000 }],
      equipmentItems: [],
      subcontractorItems: [],
      pricingIndirect: {
        ...baseParams,
        wasteFactorPercent: 10,
        contingencyPercent: 15,
      },
      terms: '',
      preparedBy: '',
    };

    const breakdown = computeProposalBreakdown(data);

    expect(breakdown.wasteFactorPercent).toBe(10);
    expect(breakdown.contingencyPercent).toBe(15);
    expect(breakdown.wasteCost).toBe(100);
    expect(breakdown.contingencyCost).toBe(315);
  });
});
