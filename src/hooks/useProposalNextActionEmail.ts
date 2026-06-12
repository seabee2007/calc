import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SavedProposal } from '../lib/proposalService';
import { ProposalService } from '../lib/proposalService';
import { getPublicProposalUrl } from '../lib/proposalTracking';
import {
  sendProposalNextActionEmail,
  type SendTransactionalEmailResponse,
} from '../services/emailService';
import type { ProposalNextAction } from '../types/proposalNextAction';
import { isProposalEmailAction, isProposalNavigateAction } from '../types/proposalNextAction';
import type { ClientEmailActionMode } from '../components/proposals/ProposalSendEmailModal';
import type { ProposalEmailSendPayload } from '../utils/proposalEmailRecipient';
import { proposalNextActionToEmailMode } from '../utils/proposalNextActionEmail';
import { resolveProposalSendDefaults } from '../utils/resolveProposalSendDefaults';
import {
  projectProposalPreviewHref,
  projectProposalsHref,
} from '../utils/projectProposals';
import { workflowQuery } from '../utils/workflow';
import { fetchProjectClientEmail } from '../services/projectClientEmailService';

export interface ProposalEmailModalState {
  proposalId: string;
  proposalTitle: string;
  defaultRecipientEmail: string;
  mode: ClientEmailActionMode;
  actionType: ProposalNextAction['type'];
}

interface UseProposalNextActionEmailOptions {
  proposals: SavedProposal[];
  onRefresh?: () => Promise<void>;
  onSent?: (result: { url?: string; title: string }) => void;
}

export function useProposalNextActionEmail({
  proposals,
  onRefresh,
  onSent,
}: UseProposalNextActionEmailOptions) {
  const navigate = useNavigate();
  const [emailModal, setEmailModal] = useState<ProposalEmailModalState | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const openEmailModalForProposal = useCallback(
    async (proposal: SavedProposal, actionType: ProposalNextAction['type']) => {
      let projectClientEmail = '';
      if (proposal.project_id) {
        projectClientEmail = await fetchProjectClientEmail(proposal.project_id);
      }
      const defaultRecipientEmail = await resolveProposalSendDefaults(proposal, projectClientEmail);
      setEmailError(null);
      setEmailModal({
        proposalId: proposal.id,
        proposalTitle:
          proposal.data?.projectTitle?.trim() || proposal.title?.trim() || 'Proposal',
        defaultRecipientEmail,
        mode: proposalNextActionToEmailMode(actionType),
        actionType,
      });
    },
    [],
  );

  const handleNextAction = useCallback(
    async (action: ProposalNextAction) => {
      if (isProposalNavigateAction(action.type)) {
        if (action.type === 'schedule_placement' && action.projectId) {
          navigate({
            pathname: '/pour-planner',
            search: workflowQuery(action.projectId).replace(/^\?/, ''),
          });
          return;
        }
        if (action.type === 'view_proposal' && action.proposalId) {
          navigate(projectProposalPreviewHref(action.proposalId));
          return;
        }
        if ((action.type === 'create_proposal' || action.type === 'link_proposal') && action.projectId) {
          navigate(projectProposalsHref(action.projectId));
          return;
        }
        if (action.type === 'create_proposal') {
          navigate('/proposal-generator');
        }
        return;
      }

      if (!isProposalEmailAction(action.type) || !action.proposalId) return;

      const proposal = proposals.find((entry) => entry.id === action.proposalId);
      if (!proposal) {
        setEmailError('Proposal not found.');
        return;
      }

      await openEmailModalForProposal(proposal, action.type);
    },
    [navigate, openEmailModalForProposal, proposals],
  );

  const handleSendEmail = useCallback(
    async ({ to, cc, messageNote }: ProposalEmailSendPayload) => {
      if (!emailModal) return;
      setSendingEmail(true);
      setEmailError(null);
      try {
        const result: SendTransactionalEmailResponse = await sendProposalNextActionEmail({
          actionType: emailModal.actionType,
          proposalId: emailModal.proposalId,
          recipientEmail: to,
          ccEmails: cc,
          messageNote,
        });
        await onRefresh?.();
        const refreshed = await ProposalService.getById(emailModal.proposalId);
        const sentTitle =
          emailModal.mode === 'send'
            ? 'Proposal sent by email'
            : emailModal.mode === 'followUp'
              ? 'Proposal follow-up sent'
              : emailModal.mode === 'deposit'
                ? 'Deposit request sent'
                : 'Check-in email sent';
        setEmailModal(null);
        onSent?.({
          url: refreshed.public_token ? getPublicProposalUrl(refreshed.public_token) : undefined,
          title: result.skipped ? 'Email sending disabled' : sentTitle,
        });
      } catch (err) {
        setEmailError(err instanceof Error ? err.message : 'Failed to send email');
      } finally {
        setSendingEmail(false);
      }
    },
    [emailModal, onRefresh, onSent],
  );

  const openSendModal = useCallback(
    async (proposal: SavedProposal, mode: ClientEmailActionMode = 'send') => {
      const actionType =
        mode === 'followUp'
          ? 'follow_up_proposal'
          : mode === 'deposit'
            ? 'request_deposit'
            : mode === 'checkIn'
              ? 'check_in_client'
              : 'send_proposal';
      await openEmailModalForProposal(proposal, actionType);
    },
    [openEmailModalForProposal],
  );

  return {
    emailModal,
    sendingEmail,
    emailError,
    setEmailError,
    handleNextAction,
    handleSendEmail,
    openSendModal,
    closeEmailModal: () => {
      if (!sendingEmail) setEmailModal(null);
    },
  };
}
