import { isValidEmailAddress } from '../../supabase/functions/_shared/emailValidation.ts';

export interface ProposalRecipientSources {
  /** Saved recipient from a prior successful send. */
  recipientEmail?: string | null;
  /** Optional client email stored on proposal payload. */
  clientEmail?: string | null;
  /** Project-level client email from New Project form. */
  projectClientEmail?: string | null;
}

export function resolveDefaultProposalRecipientEmail(
  sources: ProposalRecipientSources,
): string {
  const candidates = [
    sources.recipientEmail,
    sources.clientEmail,
    sources.projectClientEmail,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return '';
}

export function parseEmailListInput(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateEmailListInput(
  value: string,
): { ok: true; emails: string[] } | { ok: false; message: string } {
  const emails = parseEmailListInput(value);
  const unique: string[] = [];

  for (const email of emails) {
    if (!isValidEmailAddress(email)) {
      return { ok: false, message: `Enter valid CC email addresses. Invalid: ${email}` };
    }
    const lower = email.toLowerCase();
    if (!unique.some((entry) => entry.toLowerCase() === lower)) {
      unique.push(email);
    }
  }

  return { ok: true, emails: unique };
}

export interface ProposalEmailSendPayload {
  to: string;
  cc: string[];
  messageNote?: string;
}
