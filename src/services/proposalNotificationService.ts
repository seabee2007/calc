import type { TrackedProposalRow } from '../types/proposalTracking';
import { buildNotificationSourceMetadata } from '../lib/notificationTypes';
import { createNotification, hasExistingNotification } from './notificationService';

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
  return hasExistingNotification({
    userId,
    type,
    sourceType: 'proposal',
    sourceId: proposalId,
  });
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
      message: copy.body(clientName, proposalTitle),
      actionUrl: proposalNotificationHref(proposal.id),
      projectId: proposal.project_id ?? undefined,
      metadata: buildNotificationSourceMetadata({
        sourceType: 'proposal',
        sourceId: proposal.id,
        recipientUserId: userId,
      }),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Notifications] Failed to create proposal notification', error);
    }
  }
}
