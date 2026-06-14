import { supabase } from '../lib/supabase';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { createNotification } from './notificationService';

export type ProposalNotificationType =
  | 'proposal_accepted'
  | 'proposal_viewed'
  | 'proposal_declined'
  | 'proposal_deposit_paid'
  | 'proposal_sent';

const NOTIFICATION_COPY: Record<
  ProposalNotificationType,
  { title: string; body: (clientName: string, proposalTitle: string) => string }
> = {
  proposal_accepted: {
    title: 'Proposal accepted',
    body: (clientName, proposalTitle) => `${clientName} accepted ${proposalTitle}.`,
  },
  proposal_viewed: {
    title: 'Proposal viewed',
    body: (clientName, proposalTitle) => `${clientName} viewed ${proposalTitle}.`,
  },
  proposal_declined: {
    title: 'Proposal declined',
    body: (clientName, proposalTitle) => `${clientName} declined ${proposalTitle}.`,
  },
  proposal_deposit_paid: {
    title: 'Deposit paid',
    body: (_clientName, proposalTitle) => `Deposit received for ${proposalTitle}.`,
  },
  proposal_sent: {
    title: 'Proposal sent',
    body: (_clientName, proposalTitle) => `${proposalTitle} was sent to the client.`,
  },
};

export function proposalNotificationHref(proposalId: string): string {
  return `/proposals?proposalId=${proposalId}`;
}

export function getProposalClientName(proposal: TrackedProposalRow): string {
  const name = proposal.data?.clientName?.trim();
  return name || 'Client';
}

export function getProposalDisplayTitle(proposal: TrackedProposalRow): string {
  const title = proposal.title?.trim();
  return title || 'Proposal';
}

export async function hasExistingProposalNotification(
  userId: string,
  proposalId: string,
  type: ProposalNotificationType,
): Promise<boolean> {
  const href = proposalNotificationHref(proposalId);
  const { data, error } = await supabase
    .from('field_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('href', href)
    .limit(1);

  if (error) {
    if (error.code === 'PGRST205') return false;
    throw error;
  }

  return (data?.length ?? 0) > 0;
}

export async function createProposalNotification(input: {
  proposal: TrackedProposalRow;
  type: ProposalNotificationType;
}): Promise<void> {
  const { proposal, type } = input;
  const userId = proposal.user_id;
  if (!userId) return;

  try {
    const alreadyExists = await hasExistingProposalNotification(userId, proposal.id, type);
    if (alreadyExists) return;

    const clientName = getProposalClientName(proposal);
    const proposalTitle = getProposalDisplayTitle(proposal);
    const copy = NOTIFICATION_COPY[type];

    await createNotification({
      userId,
      type,
      title: copy.title,
      body: copy.body(clientName, proposalTitle),
      href: proposalNotificationHref(proposal.id),
      projectId: proposal.project_id ?? undefined,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed to create proposal notification', error);
    }
  }
}
