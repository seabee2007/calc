import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BusinessSnapshotCard from './BusinessSnapshotCard';
import FinancialDetailsPanel from './FinancialDetailsPanel';
import type { ProposalFinancialKpis } from '../../utils/proposalKpis';

const sampleFinancial: ProposalFinancialKpis = {
  pendingRevenue: 83651,
  openPipelineRevenue: 410993,
  weightedForecast: 410993,
  acceptedRevenue: 285974,
  monthlyRevenue: 120000,
  averageJobSize: 45000,
  winRate: 0.62,
  laborCostTotal: 180000,
  materialCostTotal: 95000,
  grossProfit: 70716,
  acceptedCount: 6,
  declinedCount: 2,
  currentContractValue: 0,
  approvedChangeOrderTotal: 0,
  changeOrderPendingRevenue: 0,
  changeOrderAcceptedRevenue: 0,
  changeOrderWeightedForecast: 0,
};

describe('BusinessSnapshotCard', () => {
  it('renders compact business snapshot metrics', () => {
    render(
      <MemoryRouter>
        <BusinessSnapshotCard financial={sampleFinancial} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Business snapshot')).toBeInTheDocument();
    expect(screen.getByText('Pending revenue')).toBeInTheDocument();
    expect(screen.getByText('Accepted revenue')).toBeInTheDocument();
    expect(screen.getByText('Weighted forecast')).toBeInTheDocument();
    expect(screen.getByText('Gross profit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View financial details/i })).toBeInTheDocument();
    expect(screen.queryByText('Labor cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Material cost')).not.toBeInTheDocument();
  });
});

describe('FinancialDetailsPanel', () => {
  it('renders full labor and material breakdown', () => {
    render(<FinancialDetailsPanel financial={sampleFinancial} />);

    expect(screen.getByText('Labor cost')).toBeInTheDocument();
    expect(screen.getByText('Material cost')).toBeInTheDocument();
    expect(screen.getByText('Monthly revenue')).toBeInTheDocument();
    expect(screen.getByText('Avg job size')).toBeInTheDocument();
  });
});
