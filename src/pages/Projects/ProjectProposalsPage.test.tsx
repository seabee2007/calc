import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectProposalsPage from './ProjectProposalsPage';
import type { TrackedProposalRow } from '../../types/proposalTracking';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const storeState = vi.hoisted(() => ({
  projects: [
    {
      id: 'proj-1',
      name: 'Riverfront Slab',
      description: 'Test project',
    },
  ] as never[],
  loadProjects: vi.fn(),
}));

const trackedProposalsState = vi.hoisted(() => ({
  proposals: [] as TrackedProposalRow[],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));

vi.mock('../../store', () => ({
  useProjectStore: () => storeState,
}));

vi.mock('../../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => trackedProposalsState,
}));

vi.mock('../../lib/proposalService', () => ({
  ProposalService: {
    duplicate: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../lib/proposalTracking', () => ({
  markProposalSent: vi.fn(),
  getPublicProposalUrl: (token: string) => `https://example.com/proposal/${token}`,
}));

function renderPage(projectId = 'proj-1') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${projectId}/proposals`]}>
      <Routes>
        <Route path="/projects/:projectId/proposals" element={<ProjectProposalsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectProposalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackedProposalsState.proposals = [];
    trackedProposalsState.loading = false;
    trackedProposalsState.error = null;
  });

  it('renders empty state when no proposals are linked', () => {
    renderPage();
    expect(screen.getByText('No proposals linked yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Create a proposal for this project or link an existing proposal from the proposal pipeline/i,
      ),
    ).toBeInTheDocument();
  });

  it('opens the proposal generator only when Create Proposal is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /Create Proposal/i })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/proposal-generator?flow=1&project=proj-1');
  });

  it('renders linked proposals in the list', () => {
    trackedProposalsState.proposals = [
      {
        id: 'prop-1',
        user_id: 'user-1',
        project_id: 'proj-1',
        title: 'Riverfront Slab Proposal',
        template_type: 'classic',
        data: { projectTitle: 'Riverfront Slab', clientName: 'Acme' } as never,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        status: 'sent',
        sent_at: '2026-01-02T00:00:00.000Z',
        viewed_at: null,
        opened_at: null,
        accepted_at: null,
        declined_at: null,
        deposit_paid_at: null,
        scheduled_at: null,
        paid_at: null,
        total_amount: 42000,
        labor_cost: 12000,
        material_cost: 8000,
        deposit_amount: 0,
        gross_profit: 22000,
        gross_margin_percent: 52,
        public_token: 'token-1',
      },
    ];

    renderPage();

    expect(screen.getByText('1 proposal linked')).toBeInTheDocument();
    expect(screen.getAllByText('Riverfront Slab').length).toBeGreaterThan(0);
    expect(screen.queryByText('No proposals linked yet')).not.toBeInTheDocument();
  });
});
