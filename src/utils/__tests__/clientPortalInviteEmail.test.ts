import { describe, expect, it } from 'vitest';
import {
  CLIENT_PORTAL_INVITE_SUBJECT,
  applyClientPortalInvitePlaceholders,
  buildClientPortalInviteMessageTemplate,
  isTransactionalEmailEnabled,
} from '../clientPortalInviteEmail';

describe('clientPortalInviteEmail utils', () => {
  it('uses the default invite subject', () => {
    expect(CLIENT_PORTAL_INVITE_SUBJECT).toBe('Your project portal is ready');
  });

  it('builds a template with client and company placeholders', () => {
    const template = buildClientPortalInviteMessageTemplate();
    expect(template).toContain('{clientName}');
    expect(template).toContain('{companyName}');
    expect(template).not.toContain('{portalLink}');
    expect(template).not.toContain('Open your portal:');
  });

  it('replaces invite placeholders in the message body', () => {
    const resolved = applyClientPortalInvitePlaceholders(buildClientPortalInviteMessageTemplate(), {
      clientName: 'Jane Client',
      portalLink: 'https://app.example.com/client/project/abc',
      companyName: 'Concrete Co',
    });

    expect(resolved).toContain('Hi Jane Client,');
    expect(resolved).not.toContain('https://app.example.com/client/project/abc');
    expect(resolved).toContain('Concrete Co');
    expect(resolved).toContain('Please keep this link private.');
  });

  it('treats email sending as enabled unless VITE_EMAIL_SENDING_ENABLED disables it', () => {
    expect(isTransactionalEmailEnabled()).toBe(true);
  });
});
