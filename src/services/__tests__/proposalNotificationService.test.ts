import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  createProposalNotification,
  getProposalClientName,
  getProposalDisplayTitle,
  hasExistingProposalNotification,
  proposalNotificationHref,
} from '../proposalNotificationService';

const createNotification = vi.fn();
const hasExistingNotification = vi.fn();

vi.mock('../notificationService', () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
  hasExistingNotification: (...args: unknown[]) => hasExistingNotification(...args),
}));

function makeProposal(overrides: Partial<TrackedProposalRow> = {}): TrackedProposalRow {
  return {
    id: 'proposal-1',
    user_id: 'owner-1',
    project_id: 'project-1',
    title: 'Backyard Patio',
    template_type: 'classic',
    data: {
      clientName: 'Jane Smith',
      businessName: 'Acme Concrete',
      pricing: [],
      timeline: [],
      terms: '',
      scope: '',
    },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: 'sent',
    sent_at: '2026-01-01T00:00:00.000Z',
    viewed_at: null,
    opened_at: null,
    accepted_at: null,
    declined_at: null,
    deposit_paid_at: null,
    scheduled_at: null,
    paid_at: null,
    total_amount: 1000,
    labor_cost: 400,
    material_cost: 300,
    deposit_amount: 500,
    gross_profit: 300,
    gross_margin_percent: 30,
    public_token: 'token-1',
    ...overrides,
  };
}

describe('proposalNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasExistingNotification.mockResolvedValue(false);
    createNotification.mockResolvedValue({ id: 'notif-1' });
  });

  it('builds proposal href and display helpers', () => {
    const proposal = makeProposal();
    expect(proposalNotificationHref('proposal-1')).toBe('/proposals?proposalId=proposal-1');
    expect(getProposalClientName(proposal)).toBe('Jane Smith');
    expect(getProposalDisplayTitle(proposal)).toBe('Backyard Patio');
  });

  it('creates proposal_accepted notification for the owner', async () => {
    const proposal = makeProposal({ status: 'accepted' });

    await createProposalNotification({ proposal, type: 'proposal_accepted' });

    expect(createNotification).toHaveBeenCalledWith({
      userId: 'owner-1',
      type: 'proposal_accepted',
      title: 'Proposal accepted',
      message: 'Jane Smith accepted Backyard Patio.',
      actionUrl: '/proposals?proposalId=proposal-1',
      projectId: 'project-1',
      metadata: expect.objectContaining({
        sourceType: 'proposal',
        sourceId: 'proposal-1',
      }),
    });
  });

  it('creates proposal_declined notification', async () => {
    const proposal = makeProposal({ status: 'declined' });

    await createProposalNotification({ proposal, type: 'proposal_declined' });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'proposal_declined',
        title: 'Proposal declined',
        message: 'Jane Smith declined Backyard Patio.',
      }),
    );
  });

  it('creates first proposal_viewed notification only once', async () => {
    const proposal = makeProposal();
    hasExistingNotification
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await createProposalNotification({ proposal, type: 'proposal_viewed' });
    await createProposalNotification({ proposal, type: 'proposal_viewed' });

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'proposal_viewed',
        message: 'Jane Smith viewed Backyard Patio.',
      }),
    );
  });

  it('skips duplicate notifications when one already exists', async () => {
    hasExistingNotification.mockResolvedValue(true);

    await createProposalNotification({
      proposal: makeProposal(),
      type: 'proposal_viewed',
    });

    expect(createNotification).not.toHaveBeenCalled();
    expect(
      await hasExistingProposalNotification('owner-1', 'proposal-1', 'proposal_viewed'),
    ).toBe(true);
  });

  it('does not throw when notification insert fails', async () => {
    createNotification.mockRejectedValue(new Error('insert failed'));

    await expect(
      createProposalNotification({ proposal: makeProposal(), type: 'proposal_accepted' }),
    ).resolves.toBeUndefined();
  });
});
