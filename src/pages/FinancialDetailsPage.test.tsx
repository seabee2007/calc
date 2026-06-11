import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProposalFinancialKpis } from '../utils/proposalKpis';
import FinancialDetailsPage from './FinancialDetailsPage';

const sampleFinancial = vi.hoisted(
  (): ProposalFinancialKpis => ({
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
  }),
);

const storeState = vi.hoisted(() => ({
  projects: [] as never[],
  loadProjects: vi.fn(),
}));

const trackedProposalsState = vi.hoisted(() => ({
  proposals: [] as never[],
  refresh: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isOwner: true, user: { id: 'owner-1' } }),
}));

vi.mock('../store', () => ({
  useProjectStore: () => storeState,
}));

vi.mock('../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => trackedProposalsState,
}));

vi.mock('../services/changeOrderService', () => ({
  fetchChangeOrdersForProjectIds: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/operationsDashboard', () => ({
  buildOperationsSnapshot: vi.fn(() => ({
    proposalMetrics: {
      financial: sampleFinancial,
    },
  })),
}));

describe('FinancialDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders financial details with cost breakdown', () => {
    render(
      <MemoryRouter>
        <FinancialDetailsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Financial details')).toBeInTheDocument();
    expect(screen.getByText('Labor cost')).toBeInTheDocument();
    expect(screen.getByText('Material cost')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to dashboard/i })).toBeInTheDocument();
  });
});
