import { describe, expect, it } from 'vitest';
import {
  parseEmailListInput,
  resolveDefaultProposalRecipientEmail,
  validateEmailListInput,
} from '../proposalEmailRecipient';

describe('resolveDefaultProposalRecipientEmail', () => {
  it('defaults To from project client email', () => {
    expect(
      resolveDefaultProposalRecipientEmail({
        projectClientEmail: 'client1@example.com',
      }),
    ).toBe('client1@example.com');
  });

  it('prefers saved proposal recipient over project email', () => {
    expect(
      resolveDefaultProposalRecipientEmail({
        recipientEmail: 'prior@example.com',
        projectClientEmail: 'client1@example.com',
      }),
    ).toBe('prior@example.com');
  });

  it('uses proposal client email before project email', () => {
    expect(
      resolveDefaultProposalRecipientEmail({
        clientEmail: 'proposal-client@example.com',
        projectClientEmail: 'client1@example.com',
      }),
    ).toBe('proposal-client@example.com');
  });
});

describe('validateEmailListInput', () => {
  it('accepts comma-separated CC emails', () => {
    expect(validateEmailListInput('owner@example.com, billing@example.com')).toEqual({
      ok: true,
      emails: ['owner@example.com', 'billing@example.com'],
    });
  });

  it('blocks invalid CC email', () => {
    expect(validateEmailListInput('owner@example.com, not-an-email')).toEqual({
      ok: false,
      message: 'Enter valid CC email addresses. Invalid: not-an-email',
    });
  });

  it('deduplicates CC emails case-insensitively', () => {
    expect(validateEmailListInput('Owner@Example.com, owner@example.com')).toEqual({
      ok: true,
      emails: ['Owner@Example.com'],
    });
  });
});
