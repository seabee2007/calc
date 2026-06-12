import type { ProposalStatus } from './proposalTracking';

export type ProposalNextActionType =
  | 'send_proposal'
  | 'follow_up_proposal'
  | 'request_deposit'
  | 'check_in_client'
  | 'view_proposal'
  | 'create_proposal'
  | 'link_proposal'
  | 'schedule_placement';

export type ProposalNextActionPriority = 'low' | 'normal' | 'high';

export interface ProposalNextAction {
  id: string;
  type: ProposalNextActionType;
  proposalId?: string;
  projectId?: string | null;
  clientName?: string;
  clientEmail?: string;
  proposalTitle?: string;
  projectName?: string;
  status?: ProposalStatus;
  label: string;
  description: string;
  createdAt?: string;
  priority?: ProposalNextActionPriority;
  /** @deprecated Use label */
  actionTitle?: string;
  /** @deprecated Use description */
  actionDetail?: string;
}

export function isProposalEmailAction(
  type: ProposalNextActionType,
): boolean {
  return (
    type === 'send_proposal' ||
    type === 'follow_up_proposal' ||
    type === 'request_deposit' ||
    type === 'check_in_client'
  );
}

export function isProposalNavigateAction(
  type: ProposalNextActionType,
): boolean {
  return (
    type === 'view_proposal' ||
    type === 'create_proposal' ||
    type === 'link_proposal' ||
    type === 'schedule_placement'
  );
}
