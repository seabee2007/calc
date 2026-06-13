import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        function MotionStub({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isOwner: true, user: { id: 'owner-1' } }),
}));

vi.mock('../store', () => ({
  useProjectStore: () => ({
    projects: [{ id: 'p1', name: 'Test Project' }],
    loadProjects: vi.fn(),
  }),
}));

vi.mock('../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => ({
    proposals: [],
    refresh: vi.fn(),
  }),
}));

vi.mock('../utils/projectWorkflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/projectWorkflow')>();
  return {
    ...actual,
    isProjectClosedOut: () => false,
  };
});

vi.mock('../services/changeOrderService', () => ({
  fetchChangeOrdersForProjectIds: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/scheduleEventService', () => ({
  fetchScheduleEventsInDateRange: vi.fn().mockResolvedValue([]),
  enrichEventsWithProjectNames: vi.fn((rows: unknown[]) => rows),
}));

vi.mock('../utils/scheduleDashboard', () => ({
  buildScheduleDashboardSnapshot: () => ({
    todayEvents: [],
    upcomingDeadlines: [],
  }),
}));

const mockFinancial = {
  pendingRevenue: 50000,
  acceptedRevenue: 120000,
  weightedForecast: 80000,
  grossProfit: 25000,
  winRate: 0.42,
  monthlyRevenue: 30000,
  averageJobSize: 15000,
  laborCost: 40000,
  materialCost: 35000,
};

vi.mock('../utils/operationsDashboard', () => ({
  buildOperationsSnapshot: () => ({
    activeProjectCount: 2,
    todayPourCount: 1,
    proposalsSentCount: 4,
    projects: [],
    proposalMetrics: {
      pipeline: {
        draft: 1,
        sent: 2,
        viewed: 0,
        opened: 0,
        accepted: 1,
        deposit_paid: 0,
        scheduled: 0,
        declined: 0,
        paid: 0,
      },
      financial: mockFinancial,
    },
    changeOrderMetrics: {
      financial: { weightedForecast: 0 },
    },
    todayPours: [],
    upcomingPlacements: [],
    hasPlacementsToday: false,
    deliverySchedule: null,
    timeline: [],
    mitigations: [],
    recommendedStartWindow: '6:00 AM',
    heatRisk: 'low',
    rainRisk: 'low',
    windRisk: 'low',
    evaporationRisk: 'low',
    weatherRisk: 'low',
  }),
  buildQcDashboardStats: () => ({
    qcTestsDue: 1,
    qcTestsOverdue: 0,
    totalRecords: 5,
  }),
  resolveNextUpcomingPlacement: () => null,
}));

vi.mock('../utils/projectRiskReview', () => ({
  resolveFeaturedRiskProject: () => null,
  buildProjectRiskReview: () => ({
    riskLevel: 'low',
    riskLabel: 'Low risk',
    attention: [],
    good: [],
  }),
}));

vi.mock('../utils/proposalCrm', () => ({
  buildCrmRevenueMetrics: () => ({
    pipelineValue: 95000,
    weightedForecast: 80000,
    needFollowUpCount: 0,
  }),
  buildCrmNextActions: () => [],
}));

vi.mock('../components/dashboard/DashboardHero', () => ({
  default: () => <div>Today&apos;s Operations</div>,
}));

vi.mock('../components/dashboard/schedule/ScheduleOperationsSection', () => ({
  default: () => <div>Operations schedule</div>,
}));

vi.mock('../components/owner/OwnerActivityFeed', () => ({
  default: () => <div>Field activity</div>,
}));

vi.mock('../components/dashboard/ActiveProjectsPanel', () => ({
  default: () => <div>Active projects</div>,
}));

vi.mock('../components/dashboard/ProposalPipelineCard', () => ({
  default: () => <div>Proposal pipeline</div>,
}));

vi.mock('../components/dashboard/DashboardNextActionsCard', () => ({
  default: () => <div>Next actions</div>,
}));

vi.mock('../components/dashboard/FeaturedPlacementConditions', () => ({
  default: () => <div>Today&apos;s placement conditions</div>,
}));

vi.mock('../components/dashboard/ProjectControlsCard', () => ({
  default: () => <div>Project Controls</div>,
}));

vi.mock('../components/dashboard/SmartPourAssistant', () => ({
  default: () => <div>Pre-placement review</div>,
}));

vi.mock('../components/dashboard/ProjectHealthCard', () => ({
  default: () => <div>Project risk review</div>,
}));

vi.mock('../components/dashboard/ConcreteDeliveryScheduleCard', () => ({
  default: () => <div>Concrete delivery schedule</div>,
}));

import OperationsDashboard from './OperationsDashboard';

function assertFollowsDocumentOrder(container: HTMLElement, earlierId: string, laterId: string) {
  const earlier = container.querySelector(`[data-testid="${earlierId}"]`);
  const later = container.querySelector(`[data-testid="${laterId}"]`);
  expect(earlier).toBeTruthy();
  expect(later).toBeTruthy();
  expect(
    earlier!.compareDocumentPosition(later!) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

describe('OperationsDashboard layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders Today's Operations first", () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText("Today's Operations")).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="dashboard-todays-operations"]'),
    ).toBeTruthy();
  });

  it('renders sections in the restored dashboard order', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );

    assertFollowsDocumentOrder(container, 'dashboard-todays-operations', 'dashboard-operations-schedule');
    assertFollowsDocumentOrder(container, 'dashboard-operations-schedule', 'dashboard-field-activity');
    assertFollowsDocumentOrder(container, 'dashboard-field-activity', 'dashboard-business-snapshot');
    assertFollowsDocumentOrder(container, 'dashboard-business-snapshot', 'dashboard-active-proposals-grid');
    assertFollowsDocumentOrder(container, 'dashboard-active-proposals-grid', 'dashboard-placement-qc-grid');
    assertFollowsDocumentOrder(container, 'dashboard-placement-qc-grid', 'dashboard-lower-three-grid');
  });

  it('renders Active Projects and Proposal Pipeline side-by-side on desktop', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    const grid = container.querySelector('[data-testid="dashboard-active-proposals-grid"]');
    expect(grid).toHaveClass('lg:items-stretch');
    expect(within(grid as HTMLElement).getByText('Proposal pipeline')).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText('Active projects')).toBeInTheDocument();
  });

  it('renders Placement Conditions and Project Controls below Active Projects / Proposal Pipeline', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    assertFollowsDocumentOrder(container, 'dashboard-active-proposals-grid', 'dashboard-placement-qc-grid');
    expect(screen.getByText(/Today's placement conditions/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Controls/i)).toBeInTheDocument();
  });

  it('renders lower three-card row with pre-placement, risk, and delivery cards', () => {
    render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Pre-placement review/i)).toBeInTheDocument();
    expect(screen.getByText(/Project risk review/i)).toBeInTheDocument();
    expect(screen.getByText(/Concrete delivery schedule/i)).toBeInTheDocument();
  });

  it('renders simplified Business Snapshot metrics only', () => {
    render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('Business snapshot')).toBeInTheDocument();
    expect(screen.getByText('Pending revenue')).toBeInTheDocument();
    expect(screen.getByText('Accepted revenue')).toBeInTheDocument();
    expect(screen.getByText('Weighted forecast')).toBeInTheDocument();
    expect(screen.getByText('Gross profit')).toBeInTheDocument();
    expect(screen.queryByText('Labor cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Material cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Average job size')).not.toBeInTheDocument();
  });

  it('navigates to financial details from Business Snapshot link', () => {
    render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /View financial details/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/financials');
  });
});
