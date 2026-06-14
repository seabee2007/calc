import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  readEmailEnvConfig,
  resolveOutboundRecipient,
  validateEmailConfigForSend,
} from '../../../supabase/functions/_shared/emailConfig.ts';
import {
  isAllowedTemplateKey,
  isValidEmailAddress,
  mapResendWebhookStatus,
  rejectRawEmailBody,
  validateOptionalEmailList,
} from '../../../supabase/functions/_shared/emailValidation.ts';
import { renderEmailTemplate } from '../../../supabase/functions/_shared/emailTemplates.ts';
import {
  validateChangeOrderSentPayload,
} from '../../../supabase/functions/_shared/changeOrderEmail.ts';
import {
  getPublicProposalUrl,
  getPublicClientPortalUrl,
  getPublicChangeOrderUrl,
  isAbsolutePublicUrl,
  prepareTransactionalEmail,
} from '../../../supabase/functions/_shared/resend.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('email infrastructure safeguards', () => {
  it('skips provider send when EMAIL_SENDING_ENABLED is false', () => {
    const prepared = prepareTransactionalEmail({
      templateKey: 'welcome',
      to: 'client@example.com',
      env: {
        EMAIL_SENDING_ENABLED: 'false',
        RESEND_API_KEY: 're_test',
        RESEND_FROM_EMAIL: 'Arden Project OS <noreply@ardenprojectos.com>',
      },
    });

    expect(prepared.ok).toBe(false);
    expect(prepared.disabled).toBe(true);
    expect(prepared.skipped).toBe(true);
  });

  it('redirects recipient in EMAIL_TEST_MODE and stores original recipient metadata', () => {
    const resolved = resolveOutboundRecipient('client@example.com', {
      testMode: true,
      testRecipient: 'qa@example.com',
    });

    expect(resolved.to).toBe('qa@example.com');
    expect(resolved.metadata.originalTo).toBe('client@example.com');
    expect(resolved.metadata.testMode).toBe(true);
  });

  it('requires test recipient when test mode is enabled', () => {
    const config = readEmailEnvConfig({
      EMAIL_SENDING_ENABLED: 'true',
      EMAIL_TEST_MODE: 'true',
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'Arden Project OS <noreply@ardenprojectos.com>',
    });

    expect(validateEmailConfigForSend(config)).toEqual({
      ok: false,
      message: 'Test mode is enabled but no test recipient is configured.',
    });
  });
});

describe('email templates', () => {
  it('uses Arden Project OS branding in the shared layout', () => {
    const rendered = renderEmailTemplate('welcome', {});

    expect(rendered.html).toContain('Arden Project OS');
    expect(rendered.text).toContain('Arden Project OS');
    expect(rendered.html).not.toContain('ConcreteCalc');
  });

  it('renders subject, html, and text for proposalSent', () => {
    const rendered = renderEmailTemplate('proposalSent', {
      projectName: 'Riverfront Slab',
      senderName: 'Concrete Co',
      proposalUrl: 'https://app.example.com/proposal/abc-123',
    });

    expect(rendered.subject).toContain('Riverfront Slab');
    expect(rendered.html).toContain('View proposal');
    expect(rendered.html).toContain('https://app.example.com/proposal/abc-123');
    expect(rendered.text).toContain('https://app.example.com/proposal/abc-123');
  });

  it('uses a public proposal URL path', () => {
    expect(getPublicProposalUrl('https://app.example.com', 'abc-123')).toBe(
      'https://app.example.com/proposal/abc-123',
    );
  });

  it('uses a public client portal URL path without localhost', () => {
    expect(getPublicClientPortalUrl('https://app.example.com', 'portal-token')).toBe(
      'https://app.example.com/client/project/portal-token',
    );
    expect(getPublicClientPortalUrl('https://app.example.com', 'portal-token')).not.toContain(
      'localhost',
    );
  });

  it('uses a public change order URL path', () => {
    expect(getPublicChangeOrderUrl('https://app.example.com', 'co-token')).toBe(
      'https://app.example.com/change-order/co-token',
    );
  });

  it('uses production app URL when site URL is missing for change order links', () => {
    expect(getPublicChangeOrderUrl('', 'co-token')).toBe(
      'https://app.ardenprojectos.com/change-order/co-token',
    );
    expect(getPublicChangeOrderUrl('', 'co-token')).not.toContain('localhost');
  });

  it('detects absolute public URLs for transactional email', () => {
    expect(isAbsolutePublicUrl('https://app.example.com/change-order/co-token')).toBe(true);
    expect(isAbsolutePublicUrl('/change-order/co-token')).toBe(false);
  });

  it('renders subject, html, and text for clientPortalInvite', () => {
    const portalUrl = 'https://app.example.com/client/project/abc';
    const rendered = renderEmailTemplate('clientPortalInvite', {
      emailSubject: 'Your project portal is ready',
      messageBody: `Hi Jane,\n\nOpen your portal:\n${portalUrl}\n\nPlease keep this link private.`,
      portalUrl,
      companyName: 'Concrete Co',
      companyEmail: 'office@concrete.com',
      companyPhone: '(555) 111-2222',
    });

    expect(rendered.subject).toBe('Your project portal is ready');
    expect(rendered.html).toContain('View project portal');
    expect(rendered.html).toContain('color:#ffffff !important');
    expect(rendered.html).toContain('overflow-wrap:anywhere');
    expect(rendered.html).not.toContain('Open your portal:');
    const messageParagraphs = [...rendered.html.matchAll(/<p style="margin:0 0 12px;">([\s\S]*?)<\/p>/g)]
      .map((match) => match[1])
      .join('');
    expect(messageParagraphs).not.toContain(portalUrl);
    expect(rendered.text).toContain('office@concrete.com');
    expect(rendered.text.split(portalUrl).length - 1).toBe(1);
  });

  it('renders subject, html, and text for changeOrderSent', () => {
    const changeOrderUrl = 'https://app.example.com/change-order/co-token';
    const rendered = renderEmailTemplate('changeOrderSent', {
      emailSubject: 'Change Order for Riverfront Slab',
      clientName: 'Jane',
      projectName: 'Riverfront Slab',
      changeOrderTitle: 'Add patio',
      changeOrderNumber: 'CO-12',
      changeOrderTotal: '$1,250.00',
      changeOrderUrl,
      companyName: 'Concrete Co',
      messageBody: [
        'Hi Jane,',
        '',
        'Custom intro from the send modal.',
        '',
        'Project:',
        'Riverfront Slab',
        '',
        'Change Order:',
        'Add patio',
        '',
        'Review and respond here:',
        changeOrderUrl,
        '',
        'Thank you,',
        'Concrete Co',
      ].join('\n'),
    });

    expect(rendered.subject).toBe('Change Order for Riverfront Slab');
    expect(rendered.html).toContain('Change Order Ready for Review');
    expect(rendered.html).toContain('Review Change Order');
    expect(rendered.html).toContain(`href="${changeOrderUrl}"`);
    expect(rendered.html).toContain('Riverfront Slab');
    expect(rendered.html).toContain('Add patio');
    expect(rendered.html).toContain('Custom intro from the send modal.');
    expect(rendered.html).not.toContain('Project update');
    expect(rendered.html).not.toContain('Review the change order for your project.');
    expect(rendered.html).toContain(
      'If the button does not work, copy and paste this link into your browser:',
    );
    expect(rendered.text).toContain('Hi Jane,');
    expect(rendered.text).toContain(changeOrderUrl);
    expect(rendered.text).toContain('Custom intro from the send modal.');
    expect(rendered.text).not.toContain('Project update');
  });

  it('renders changeOrderSent defaults when messageBody is omitted', () => {
    const changeOrderUrl = 'https://app.example.com/change-order/co-token';
    const rendered = renderEmailTemplate('changeOrderSent', {
      emailSubject: 'Change Order for Riverfront Slab',
      clientName: 'Jane',
      projectName: 'Riverfront Slab',
      changeOrderTitle: 'Add patio',
      changeOrderNumber: 'CO-12',
      changeOrderTotal: '$1,250.00',
      changeOrderUrl,
      companyName: 'Concrete Co',
    });

    expect(rendered.text).toContain('Riverfront Slab');
    expect(rendered.text).toContain('Add patio (CO-12)');
    expect(rendered.text).toContain('$1,250.00');
    expect(rendered.text).toContain(changeOrderUrl);
    expect(rendered.html).toContain('Review Change Order');
  });

  it('validates changeOrderSent payload before send', () => {
    expect(
      validateChangeOrderSentPayload({
        emailSubject: 'Change Order for Test',
        projectName: 'Test Project',
        changeOrderTitle: 'Add scope',
        changeOrderTotal: '$100.00',
        changeOrderUrl: 'https://app.example.com/change-order/token',
      }),
    ).toBeNull();

    expect(
      validateChangeOrderSentPayload({
        emailSubject: 'Change Order for Test',
        projectName: 'Test Project',
        changeOrderTitle: 'Add scope',
        changeOrderTotal: '$100.00',
      }),
    ).toBe('Missing change order review link.');
  });

  it('passes rendered change order HTML through prepareTransactionalEmail', () => {
    const changeOrderUrl = 'https://app.example.com/change-order/co-token';
    const templateData = {
      emailSubject: 'Change Order for Riverfront Slab',
      clientName: 'Jane',
      projectName: 'Riverfront Slab',
      changeOrderTitle: 'Add patio',
      changeOrderTotal: '$1,250.00',
      changeOrderUrl,
      companyName: 'Concrete Co',
    };
    const rendered = renderEmailTemplate('changeOrderSent', templateData);
    const prepared = prepareTransactionalEmail({
      templateKey: 'changeOrderSent',
      to: 'client@example.com',
      data: templateData,
      env: {
        RESEND_API_KEY: 're_test_key',
        EMAIL_SENDING_ENABLED: 'true',
        RESEND_FROM_EMAIL: 'Arden Project OS <noreply@example.com>',
      },
    });

    expect(prepared.ok).toBe(true);
    expect(rendered.html).toContain('Review Change Order');
    expect(rendered.html).toContain('Riverfront Slab');
    expect(rendered.subject).toBe('Change Order for Riverfront Slab');
  });

  it('renders subject, html, and text for proposalFollowUp', () => {
    const rendered = renderEmailTemplate('proposalFollowUp', {
      proposalTitle: 'Riverfront Slab',
      proposalUrl: 'https://app.example.com/proposal/abc-123',
      messageNote: 'Checking in on the proposal.',
    });

    expect(rendered.subject).toBe('Follow up: Riverfront Slab');
    expect(rendered.html).toContain('View proposal');
    expect(rendered.text).toContain('Checking in on the proposal.');
  });

  it('renders depositRequest without pretending payment collection is enabled', () => {
    const rendered = renderEmailTemplate('depositRequest', {
      projectName: 'Riverfront Slab',
      depositAmount: '$2,500',
    });

    expect(rendered.subject).toBe('Deposit request: Riverfront Slab');
    expect(rendered.text).toContain('$2,500');
    expect(rendered.html).not.toContain('View payment details');
  });

  it('renders clientCheckIn subject and body', () => {
    const rendered = renderEmailTemplate('clientCheckIn', {
      projectName: 'Riverfront Slab',
      messageNote: 'Just checking in.',
    });

    expect(rendered.subject).toBe('Checking in: Riverfront Slab');
    expect(rendered.text).toContain('Just checking in.');
  });
});

describe('email validation', () => {
  it('rejects unknown template keys', () => {
    expect(isAllowedTemplateKey('notReal')).toBe(false);
    expect(isAllowedTemplateKey('proposalSent')).toBe(true);
  });

  it('rejects invalid recipient emails', () => {
    expect(isValidEmailAddress('not-an-email')).toBe(false);
    expect(isValidEmailAddress('client@example.com')).toBe(true);
  });

  it('rejects arbitrary html/subject fields from frontend requests', () => {
    expect(
      rejectRawEmailBody({
        templateKey: 'proposalSent',
        to: 'client@example.com',
        html: '<script>alert(1)</script>',
      }),
    ).toContain('html');
  });

  it('validates CC arrays for send-transactional-email', () => {
    expect(validateOptionalEmailList(['owner@example.com'], 'CC')).toEqual({
      ok: true,
      emails: ['owner@example.com'],
    });
    expect(validateOptionalEmailList(['not-an-email'], 'CC')).toEqual({
      ok: false,
      message: 'Enter valid CC email addresses.',
    });
  });

  it('allows proposalFollowUp template key', () => {
    expect(isAllowedTemplateKey('proposalFollowUp')).toBe(true);
    expect(isAllowedTemplateKey('depositRequest')).toBe(true);
    expect(isAllowedTemplateKey('clientCheckIn')).toBe(true);
    expect(isAllowedTemplateKey('clientPortalInvite')).toBe(true);
    expect(isAllowedTemplateKey('changeOrderSent')).toBe(true);
  });

  it('maps Resend webhook events to email event statuses', () => {
    expect(mapResendWebhookStatus('email.delivered')).toBe('delivered');
    expect(mapResendWebhookStatus('email.bounced')).toBe('bounced');
    expect(mapResendWebhookStatus('email.complained')).toBe('complained');
  });
});

describe('frontend security', () => {
  it('does not import Resend or expose RESEND_API_KEY in frontend services', () => {
    const source = readSource('src/services/emailService.ts');
    expect(source).not.toMatch(/from ['"]resend['"]/i);
    expect(source).not.toContain('RESEND_API_KEY');
    expect(source).toContain('/functions/v1/send-transactional-email');
    expect(source).toContain('sendClientPortalInviteEmail');
    expect(source).toContain('sendChangeOrderEmail');
  });

  it('does not mark proposals sent inside emailService', () => {
    const source = readSource('src/services/emailService.ts');
    expect(source).not.toContain('markProposalSent');
  });
});

describe('proposal pages defer sent status to successful email send', () => {
  it('uses workflow email hook without immediately calling markProposalSent in Proposals page', () => {
    const proposalsSource = readSource('src/pages/Proposals.tsx');
    const hookSource = readSource('src/hooks/useProposalNextActionEmail.ts');
    expect(proposalsSource).toContain('useProposalNextActionEmail');
    expect(hookSource).toContain('sendProposalNextActionEmail');
    expect(hookSource).not.toContain('markProposalSent');
  });

  it('marks proposal sent only after Resend succeeds in send-transactional-email', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    const sendIndex = source.indexOf('sendTransactionalEmail');
    const markSentIndex = source.indexOf('proposalUpdate.status = "sent"');
    expect(sendIndex).toBeGreaterThan(-1);
    expect(markSentIndex).toBeGreaterThan(sendIndex);
  });

  it('does not mark proposal sent when email sending is disabled', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    const disabledReturn = source.indexOf('Email sending is disabled.');
    const markSentIndex = source.indexOf('proposalUpdate.status = "sent"');
    expect(disabledReturn).toBeGreaterThan(-1);
    expect(markSentIndex).toBeGreaterThan(disabledReturn);
  });

  it('updates email event to failed without marking proposal sent when Resend fails', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    const failureBlock =
      source.match(/if \(!sendResult\.ok\) \{[\s\S]*?^\    \}/m)?.[0] ?? '';
    expect(failureBlock).toContain('status: "failed"');
    expect(failureBlock).not.toContain('.from("proposals")');
  });

  it('logs intended recipient and CC in email event metadata', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    expect(source).toContain('intendedTo: recipient');
    expect(source).toContain('cc: ccEmails');
    expect(source).toContain('actionType: data.actionType');
  });

  it('does not mark deposit paid on depositRequest success', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    expect(source).toContain('last_deposit_request_sent_at');
    expect(source).not.toMatch(/depositRequest[\s\S]*deposit_paid_at/);
    expect(source).not.toMatch(/depositRequest[\s\S]*status: "deposit_paid"/);
  });

  it('does not mark proposal sent on proposalFollowUp success', () => {
    const source = readSource('supabase/functions/send-transactional-email/index.ts');
    expect(source).toContain('templateKey === "proposalFollowUp"');
    expect(source).toMatch(/if \(templateKey === "proposalSent"\)/);
  });
});
