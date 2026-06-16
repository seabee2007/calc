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

// Stable references: these hooks return referentially-stable values in the real
// app (auth context / zustand store), so the mocks must too. Returning fresh
// objects/arrays each render would make OperationsDashboard's data effects
// (deps include user/projects/proposals) re-run every render and loop.
const authState = vi.hoisted(() => ({
  isOwner: true,
  user: { id: 'owner-1' } as { id: string },
}));
const storeState = vi.hoisted(() => ({
  projects: [{ id: 'p1', name: 'Test Project' }],
  loadProjects: () => {},
}));
const proposalsState = vi.hoisted(() => ({
  proposals: [] as unknown[],
  refresh: () => {},
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isOwner: authState.isOwner, user: authState.user }),
}));

vi.mock('../store', () => ({
  useProjectStore: () => storeState,
}));

vi.mock('../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => proposalsState,
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

const baseOperationsSnapshot = {
  activeProjectCount: 2,
  todayPourCount: 0,
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
};

let mockOperationsSnapshot = { ...baseOperationsSnapshot };

vi.mock('../utils/operationsDashboard', () => ({
  buildOperationsSnapshot: () => mockOperationsSnapshot,
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
    mockOperationsSnapshot = { ...baseOperationsSnapshot };
    authState.isOwner = true;
  });

  it("renders Today's Operations as the first card", () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText("Today's Operations")).toBeInTheDocument();
    const firstCard = container.querySelector('[data-testid^="dashboard-card-"]');
    expect(firstCard).toHaveAttribute('data-testid', 'dashboard-card-todaysOperations');
  });

  it('renders registry cards in the default layout order', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );

    assertFollowsDocumentOrder(container, 'dashboard-card-todaysOperations', 'dashboard-card-operationsSchedule');
    assertFollowsDocumentOrder(container, 'dashboard-card-operationsSchedule', 'dashboard-card-fieldActivity');
    assertFollowsDocumentOrder(container, 'dashboard-card-fieldActivity', 'dashboard-card-businessSnapshot');
    assertFollowsDocumentOrder(container, 'dashboard-card-businessSnapshot', 'dashboard-card-activeProjects');
    assertFollowsDocumentOrder(container, 'dashboard-card-activeProjects', 'dashboard-card-proposalPipeline');
    assertFollowsDocumentOrder(container, 'dashboard-card-proposalPipeline', 'dashboard-card-nextActions');
    assertFollowsDocumentOrder(container, 'dashboard-card-nextActions', 'dashboard-card-projectControls');
    assertFollowsDocumentOrder(container, 'dashboard-card-projectControls', 'dashboard-card-projectRiskReview');
  });

  it('renders owner-only cards (including Next Actions) for owners', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="dashboard-card-operationsSchedule"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="dashboard-card-fieldActivity"]')).toBeTruthy();
    // Next Actions must always render for owners (Phase 2B regression guard).
    expect(container.querySelector('[data-testid="dashboard-card-nextActions"]')).toBeTruthy();
    expect(within(
      container.querySelector('[data-testid="dashboard-card-projectControls"]') as HTMLElement,
    ).getByText(/Project Controls/i)).toBeInTheDocument();
    expect(within(
      container.querySelector('[data-testid="dashboard-card-projectRiskReview"]') as HTMLElement,
    ).getByText(/Project risk review/i)).toBeInTheDocument();
  });

  it('hides owner-only cards for non-owners', () => {
    authState.isOwner = false;
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="dashboard-card-operationsSchedule"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-card-fieldActivity"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-card-nextActions"]')).toBeNull();
    // Always-visible cards still render.
    expect(container.querySelector('[data-testid="dashboard-card-activeProjects"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="dashboard-card-businessSnapshot"]')).toBeTruthy();
  });

  it('hides concrete-only cards when there is no placement work', () => {
    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="dashboard-card-placementConditions"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-card-smartPourAssistant"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-card-concreteDeliverySchedule"]')).toBeNull();
    expect(screen.getByText(/Project risk review/i)).toBeInTheDocument();
  });

  it('shows concrete cards after the risk review when upcoming placements exist', () => {
    mockOperationsSnapshot = {
      ...baseOperationsSnapshot,
      upcomingPlacements: [
        {
          projectId: 'p1',
          projectName: 'Pour Project',
          pourDateLabel: 'Jun 15',
          sortTime: Date.now(),
        },
      ],
    };

    const { container } = render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Today's placement conditions/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-placement review/i)).toBeInTheDocument();
    expect(screen.getByText(/Concrete delivery schedule/i)).toBeInTheDocument();
    assertFollowsDocumentOrder(container, 'dashboard-card-projectRiskReview', 'dashboard-card-placementConditions');
    assertFollowsDocumentOrder(container, 'dashboard-card-placementConditions', 'dashboard-card-smartPourAssistant');
    assertFollowsDocumentOrder(container, 'dashboard-card-smartPourAssistant', 'dashboard-card-concreteDeliverySchedule');
  });

  it('renders the Customize dashboard control with no drag handles by default', () => {
    render(
      <MemoryRouter>
        <OperationsDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-customize-toggle')).toHaveTextContent(
      /Customize dashboard/i,
    );
    expect(screen.queryAllByLabelText('Move dashboard card')).toHaveLength(0);
    expect(screen.queryByTestId('dashboard-reset-layout')).toBeNull();
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
