import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Proposals from '../Proposals';
import type { SavedProposal } from '../../lib/proposalService';

const proposalsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/Proposals.tsx'),
  'utf8',
);

const appPageSource = readFileSync(
  resolve(process.cwd(), 'src/components/ui/AppPage.tsx'),
  'utf8',
);

const trackedProposalsState = vi.hoisted(() => ({
  proposals: [] as SavedProposal[],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));

vi.mock('../../hooks/useTrackedProposals', () => ({
  useTrackedProposals: () => trackedProposalsState,
}));

vi.mock('../../hooks/useProposalNextActionEmail', () => ({
  useProposalNextActionEmail: () => ({
    emailModal: null,
    sendingEmail: false,
    emailError: null,
    handleNextAction: vi.fn(),
    handleSendEmail: vi.fn(),
    openSendModal: vi.fn(),
    closeEmailModal: vi.fn(),
  }),
}));

describe('Proposal Pipeline layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackedProposalsState.proposals = [];
    trackedProposalsState.loading = false;
    trackedProposalsState.error = null;
  });

  it('does not render the redundant pill filter row', () => {
    expect(proposalsSource).not.toContain('FilterBar');
    expect(proposalsSource).not.toContain('pipelineFilterOptions');
  });

  it('uses AppPage without header padding overrides', () => {
    expect(proposalsSource).toContain('<AppPage');
    expect(proposalsSource).toContain('data-testid="proposal-pipeline-page"');
    expect(proposalsSource).not.toContain('className="!px-0"');
  });

  it('uses a single shared AppPage gutter wrapper', () => {
    expect(appPageSource).toMatch(
      /<div className=\{`\$\{PAGE_GUTTER\} \$\{SECTION_SPACING\}`\}>[\s\S]*\{header\}[\s\S]*\{children\}/,
    );
  });

  it('renders header actions, KPI strip, and pipeline card in page order', () => {
    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('proposal-pipeline-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proposal Pipeline' })).toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-import-button')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-new-button')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Key metrics' })).toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-board-card')).toBeInTheDocument();

    const page = screen.getByTestId('proposal-pipeline-page');
    const gutter = page.firstElementChild;
    expect(gutter).toContainElement(screen.getByRole('heading', { name: 'Proposal Pipeline' }));
    expect(gutter).toContainElement(screen.getByTestId('proposal-pipeline-board-card'));
  });

  it('filters proposals via status summary cards instead of pill filters', async () => {
    const user = userEvent.setup();
    trackedProposalsState.proposals = [
      {
        id: 'draft-1',
        user_id: 'user-1',
        project_id: null,
        title: 'Draft proposal',
        template_type: 'minimal',
        data: {} as SavedProposal['data'],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'draft',
        sent_at: null,
        viewed_at: null,
        opened_at: null,
        accepted_at: null,
        declined_at: null,
        deposit_paid_at: null,
        scheduled_at: null,
        paid_at: null,
        total_amount: 1000,
        labor_cost: 0,
        material_cost: 0,
        deposit_amount: 0,
        gross_profit: 0,
        gross_margin_percent: 0,
        public_token: 'token-draft',
      },
      {
        id: 'sent-1',
        user_id: 'user-1',
        project_id: null,
        title: 'Sent proposal',
        template_type: 'minimal',
        data: {} as SavedProposal['data'],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'sent',
        sent_at: '2026-01-02T00:00:00.000Z',
        viewed_at: null,
        opened_at: null,
        accepted_at: null,
        declined_at: null,
        deposit_paid_at: null,
        scheduled_at: null,
        paid_at: null,
        total_amount: 2000,
        labor_cost: 0,
        material_cost: 0,
        deposit_amount: 0,
        gross_profit: 0,
        gross_margin_percent: 0,
        public_token: 'token-sent',
      },
    ];

    render(
      <MemoryRouter>
        <Proposals />
      </MemoryRouter>,
    );

    expect(screen.getByText('Draft proposal')).toBeInTheDocument();
    expect(screen.getByText('Sent proposal')).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Proposal pipeline stage' })).toHaveLength(1);

    await user.click(screen.getByTestId('proposal-pipeline-stage-draft'));
    expect(screen.getByText('Draft proposal')).toBeInTheDocument();
    expect(screen.queryByText('Sent proposal')).not.toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-stage-draft')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByTestId('proposal-pipeline-stage-all'));
    expect(screen.getByText('Draft proposal')).toBeInTheDocument();
    expect(screen.getByText('Sent proposal')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-stage-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
