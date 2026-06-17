import { supabase } from '../lib/supabase';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

export interface SendTransactionalEmailResponse {
  ok: boolean;
  emailEventId?: string | null;
  resendEmailId?: string | null;
  to?: string;
  testMode?: boolean;
  skipped?: boolean;
  disabled?: boolean;
  message?: string;
  error?: string;
}

export interface EmailEventRow {
  id: string;
  user_id: string | null;
  project_id: string | null;
  proposal_id: string | null;
  template_key: string;
  to_email: string;
  from_email: string;
  subject: string;
  resend_email_id: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
}

async function invokeSendTransactionalEmail(body: {
  templateKey: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  data?: Record<string, unknown>;
}): Promise<SendTransactionalEmailResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await parseEdgeFunctionJson<SendTransactionalEmailResponse>(res);
  return payload;
}

export async function sendProposalEmail(input: {
  proposalId: string;
  recipientEmail: string;
  ccEmails?: string[];
  messageNote?: string;
  followUp?: boolean;
  senderName?: string;
}): Promise<SendTransactionalEmailResponse> {
  return sendProposalNextActionEmail({
    actionType: input.followUp ? 'follow_up_proposal' : 'send_proposal',
    proposalId: input.proposalId,
    recipientEmail: input.recipientEmail,
    ccEmails: input.ccEmails,
    messageNote: input.messageNote,
    senderName: input.senderName,
  });
}

export async function sendProposalNextActionEmail(input: {
  actionType:
    | 'send_proposal'
    | 'follow_up_proposal'
    | 'request_deposit'
    | 'check_in_client';
  proposalId: string;
  recipientEmail: string;
  ccEmails?: string[];
  messageNote?: string;
  senderName?: string;
}): Promise<SendTransactionalEmailResponse> {
  const templateKey =
    input.actionType === 'send_proposal'
      ? 'proposalSent'
      : input.actionType === 'follow_up_proposal'
        ? 'proposalFollowUp'
        : input.actionType === 'request_deposit'
          ? 'depositRequest'
          : 'clientCheckIn';

  return invokeSendTransactionalEmail({
    templateKey,
    to: input.recipientEmail.trim(),
    cc: input.ccEmails,
    data: {
      proposalId: input.proposalId,
      senderName: input.senderName,
      messageNote: input.messageNote,
      actionType: input.actionType,
    },
  });
}

export async function sendTeamInviteEmail(input: {
  inviteId: string;
  recipientEmail: string;
  companyName?: string;
  inviterName?: string;
}): Promise<SendTransactionalEmailResponse> {
  return invokeSendTransactionalEmail({
    templateKey: 'teamInvite',
    to: input.recipientEmail.trim(),
    data: {
      inviteId: input.inviteId,
      companyName: input.companyName,
      inviterName: input.inviterName,
    },
  });
}

export async function sendPaymentRequestEmail(input: {
  recipientEmail: string;
  projectName: string;
  actionUrl: string;
  projectId?: string;
}): Promise<SendTransactionalEmailResponse> {
  return invokeSendTransactionalEmail({
    templateKey: 'paymentRequest',
    to: input.recipientEmail.trim(),
    data: {
      projectName: input.projectName,
      actionUrl: input.actionUrl,
      projectId: input.projectId,
    },
  });
}

export async function sendClientPortalInviteEmail(input: {
  portalToken: string;
  projectId: string;
  recipientEmail: string;
  emailSubject?: string;
  messageBody?: string;
}): Promise<SendTransactionalEmailResponse> {
  return invokeSendTransactionalEmail({
    templateKey: 'clientPortalInvite',
    to: input.recipientEmail.trim(),
    data: {
      portalToken: input.portalToken,
      projectId: input.projectId,
      emailSubject: input.emailSubject?.trim(),
      messageBody: input.messageBody?.trim(),
    },
  });
}

export async function sendChangeOrderEmail(input: {
  changeOrderId: string;
  changeOrderToken: string;
  projectId: string;
  recipientEmail: string;
  emailSubject?: string;
  messageBody?: string;
  clientName?: string;
  projectName?: string;
  changeOrderTitle?: string;
  changeOrderNumber?: string;
  changeOrderTotal?: string;
}): Promise<SendTransactionalEmailResponse> {
  return invokeSendTransactionalEmail({
    templateKey: 'changeOrderSent',
    to: input.recipientEmail.trim(),
    data: {
      changeOrderId: input.changeOrderId,
      changeOrderToken: input.changeOrderToken,
      projectId: input.projectId,
      emailSubject: input.emailSubject?.trim(),
      messageBody: input.messageBody?.trim(),
      clientName: input.clientName?.trim(),
      projectName: input.projectName?.trim(),
      changeOrderTitle: input.changeOrderTitle?.trim(),
      changeOrderNumber: input.changeOrderNumber?.trim(),
      changeOrderTotal: input.changeOrderTotal?.trim(),
    },
  });
}

export async function getProjectEmailEvents(projectId: string): Promise<EmailEventRow[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmailEventRow[];
}

export async function getProposalEmailEvents(proposalId: string): Promise<EmailEventRow[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmailEventRow[];
}
