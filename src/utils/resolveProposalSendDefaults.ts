import type { SavedProposal } from '../lib/proposalService';
import { resolveDefaultProposalRecipientEmail } from '../utils/proposalEmailRecipient';
import { fetchProjectClientEmail } from '../services/projectClientEmailService';

export async function resolveProposalSendDefaults(
  proposal: Pick<SavedProposal, 'project_id' | 'last_sent_to' | 'data'>,
  projectClientEmail?: string | null,
): Promise<string> {
  let resolvedProjectEmail = projectClientEmail?.trim() ?? '';
  if (!resolvedProjectEmail && proposal.project_id) {
    resolvedProjectEmail = await fetchProjectClientEmail(proposal.project_id);
  }

  const proposalClientEmail =
    typeof (proposal.data as { clientEmail?: unknown }).clientEmail === 'string'
      ? (proposal.data as { clientEmail?: string }).clientEmail
      : null;

  return resolveDefaultProposalRecipientEmail({
    recipientEmail: proposal.last_sent_to,
    clientEmail: proposalClientEmail,
    projectClientEmail: resolvedProjectEmail,
  });
}
