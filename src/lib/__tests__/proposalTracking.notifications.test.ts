import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  acceptProposal,
  declineProposal,
  markDepositPaid,
  markProposalOpened,
  markProposalSent,
  markProposalViewed,
} from '../proposalTracking';

const rpc = vi.fn();
const updateChain = {
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
};
const from = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

vi.mock('../../store/trackedProposalsStore', () => ({
  useTrackedProposalsStore: {
    getState: () => ({ upsertProposal: vi.fn() }),
  },
}));

const createProposalNotification = vi.fn();

vi.mock('../../services/proposalNotificationService', () => ({
  createProposalNotification: (...args: unknown[]) => createProposalNotification(...args),
}));

function makeRow(overrides: Partial<TrackedProposalRow> = {}): TrackedProposalRow {
  return {
    id: 'proposal-1',
    user_id: 'owner-1',
    project_id: 'project-1',
    title: 'Driveway',
    template_type: 'classic',
    data: { clientName: 'Alex', businessName: 'Co', pricing: [], timeline: [], terms: '', scope: '' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: 'sent',
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
    public_token: 'token-1',
    ...overrides,
  };
}

describe('proposalTracking notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_proposal_by_public_token') {
        return { data: makeRow(), error: null };
      }
      if (fn === 'record_proposal_client_action') {
        return { data: makeRow({ status: 'accepted', accepted_at: '2026-01-02T00:00:00.000Z' }), error: null };
      }
      return { data: null, error: null };
    });

    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue(updateChain);
    updateChain.single.mockResolvedValue({
      data: makeRow({ status: 'sent', sent_at: '2026-01-02T00:00:00.000Z' }),
      error: null,
    });

    from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: makeRow(), error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue(updateChain),
        };
      }
      return {};
    });
  });

  it('acceptProposal creates proposal_accepted notification once', async () => {
    await acceptProposal('token-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ status: 'accepted' }),
      type: 'proposal_accepted',
    });
  });

  it('acceptProposal returns the updated proposal without awaiting notifications', async () => {
    createProposalNotification.mockImplementation(() => Promise.resolve());

    await expect(acceptProposal('token-1')).resolves.toEqual(
      expect.objectContaining({ status: 'accepted' }),
    );
    expect(createProposalNotification).toHaveBeenCalled();
  });

  it('declineProposal creates proposal_declined notification', async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_proposal_by_public_token') {
        return { data: makeRow(), error: null };
      }
      if (fn === 'record_proposal_client_action') {
        return { data: makeRow({ status: 'declined', declined_at: '2026-01-02T00:00:00.000Z' }), error: null };
      }
      return { data: null, error: null };
    });

    await declineProposal('token-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ status: 'declined' }),
      type: 'proposal_declined',
    });
  });

  it('first proposal view creates proposal_viewed notification', async () => {
    rpc.mockImplementation(async (fn: string, args: { p_action?: string }) => {
      if (fn === 'get_proposal_by_public_token') {
        return { data: makeRow(), error: null };
      }
      if (fn === 'record_proposal_client_action' && args.p_action === 'viewed') {
        return { data: makeRow({ viewed_at: '2026-01-02T00:00:00.000Z', status: 'viewed' }), error: null };
      }
      return { data: null, error: null };
    });

    await markProposalViewed('token-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ viewed_at: '2026-01-02T00:00:00.000Z' }),
      type: 'proposal_viewed',
    });
  });

  it('repeat proposal views do not notify again', async () => {
    rpc.mockImplementation(async (fn: string, args: { p_action?: string }) => {
      if (fn === 'get_proposal_by_public_token') {
        return { data: makeRow({ viewed_at: '2026-01-01T00:00:00.000Z' }), error: null };
      }
      if (fn === 'record_proposal_client_action' && args.p_action === 'viewed') {
        return { data: makeRow({ viewed_at: '2026-01-01T00:00:00.000Z' }), error: null };
      }
      return { data: null, error: null };
    });

    await markProposalViewed('token-1');

    expect(createProposalNotification).not.toHaveBeenCalled();
  });

  it('first proposal open creates proposal_viewed notification', async () => {
    rpc.mockImplementation(async (fn: string, args: { p_action?: string }) => {
      if (fn === 'get_proposal_by_public_token') {
        return { data: makeRow(), error: null };
      }
      if (fn === 'record_proposal_client_action' && args.p_action === 'opened') {
        return { data: makeRow({ opened_at: '2026-01-02T00:00:00.000Z', status: 'opened' }), error: null };
      }
      return { data: null, error: null };
    });

    await markProposalOpened('token-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ opened_at: '2026-01-02T00:00:00.000Z' }),
      type: 'proposal_viewed',
    });
  });

  it('markDepositPaid creates proposal_deposit_paid notification', async () => {
    updateChain.single.mockResolvedValue({
      data: makeRow({ status: 'deposit_paid', deposit_paid_at: '2026-01-02T00:00:00.000Z' }),
      error: null,
    });

    await markDepositPaid('proposal-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ status: 'deposit_paid' }),
      type: 'proposal_deposit_paid',
    });
  });

  it('markProposalSent creates proposal_sent notification', async () => {
    await markProposalSent('proposal-1');

    expect(createProposalNotification).toHaveBeenCalledWith({
      proposal: expect.objectContaining({ status: 'sent' }),
      type: 'proposal_sent',
    });
  });
});
