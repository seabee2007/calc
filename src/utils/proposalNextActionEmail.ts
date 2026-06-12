import type { ProposalNextActionType } from '../types/proposalNextAction';
import type { ClientEmailActionMode } from '../components/proposals/ProposalSendEmailModal';
import { normalizeDisplayText } from './normalizeDisplayText';

export function proposalNextActionToEmailMode(
  type: ProposalNextActionType,
): ClientEmailActionMode {
  switch (type) {
    case 'send_proposal':
      return 'send';
    case 'follow_up_proposal':
      return 'followUp';
    case 'request_deposit':
      return 'deposit';
    case 'check_in_client':
      return 'checkIn';
    default:
      return 'send';
  }
}

export function proposalNextActionToTemplateKey(
  type: ProposalNextActionType,
): string {
  switch (type) {
    case 'send_proposal':
      return 'proposalSent';
    case 'follow_up_proposal':
      return 'proposalFollowUp';
    case 'request_deposit':
      return 'depositRequest';
    case 'check_in_client':
      return 'clientCheckIn';
    default:
      return 'proposalSent';
  }
}

export function getClientEmailSubjectPreview(
  mode: ClientEmailActionMode,
  proposalTitle: string,
): string {
  const title = normalizeDisplayText(proposalTitle.trim() || 'your project');
  switch (mode) {
    case 'send':
      return `Proposal for ${title}`;
    case 'followUp':
      return `Follow up: ${title}`;
    case 'deposit':
      return `Deposit request: ${title}`;
    case 'checkIn':
      return `Checking in: ${title}`;
    default:
      return title;
  }
}

export function getClientEmailSubmitLabel(mode: ClientEmailActionMode): string {
  switch (mode) {
    case 'send':
      return 'Send email';
    case 'followUp':
      return 'Send follow-up';
    case 'deposit':
      return 'Send deposit request';
    case 'checkIn':
      return 'Send check-in';
    default:
      return 'Send email';
  }
}

export function getClientEmailModalTitle(mode: ClientEmailActionMode): string {
  switch (mode) {
    case 'send':
      return 'Send Proposal';
    case 'followUp':
      return 'Follow up on proposal';
    case 'deposit':
      return 'Request deposit';
    case 'checkIn':
      return 'Check in with client';
    default:
      return 'Send email';
  }
}
