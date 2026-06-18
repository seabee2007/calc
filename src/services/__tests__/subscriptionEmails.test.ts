import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { renderEmailTemplate } from '../../../supabase/functions/_shared/emailTemplates.ts';
import {
  buildSubscriptionUsageSummary,
  shouldSendSubscriptionWelcomeEmail,
  SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN,
  SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN,
} from '../../../supabase/functions/_shared/subscriptionEmailRules.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('subscription welcome email eligibility', () => {
  it('sends for first active paid subscription activation', () => {
    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'starter',
        status: 'active',
        previousRow: { plan_id: 'starter', status: 'inactive' },
      }),
    ).toBe(true);
  });

  it('sends for upward plan changes while active', () => {
    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'professional',
        status: 'active',
        previousRow: { plan_id: 'starter', status: 'active' },
      }),
    ).toBe(true);
  });

  it('does not send for inactive, canceled, or past_due subscriptions', () => {
    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'professional',
        status: 'canceled',
        previousRow: { plan_id: 'starter', status: 'active' },
      }),
    ).toBe(false);

    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'professional',
        status: 'past_due',
        previousRow: { plan_id: 'starter', status: 'active' },
      }),
    ).toBe(false);
  });

  it('does not send for same-plan resync or downgrades', () => {
    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'professional',
        status: 'active',
        previousRow: { plan_id: 'professional', status: 'active' },
      }),
    ).toBe(false);

    expect(
      shouldSendSubscriptionWelcomeEmail({
        planId: 'starter',
        status: 'active',
        previousRow: { plan_id: 'professional', status: 'active' },
      }),
    ).toBe(false);
  });
});

describe('subscription welcome email templates', () => {
  it('maps paid plans to welcome email types and template keys', () => {
    expect(SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN.starter).toBe('subscription_welcome_starter');
    expect(SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN.professional).toBe('subscriptionWelcomeProfessional');
    expect(SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN.business).toBe('subscriptionWelcomeBusiness');
  });

  it('renders Starter welcome email with billing and dashboard links', () => {
    const rendered = renderEmailTemplate('subscriptionWelcomeStarter', {
      firstName: 'Alex',
      billingUrl: 'https://app.example.com/settings/billing',
      dashboardUrl: 'https://app.example.com/',
      usageSummary: buildSubscriptionUsageSummary('starter'),
    });

    expect(rendered.subject).toBe('Welcome to Arden Project OS Starter');
    expect(rendered.html).toContain('Hi Alex,');
    expect(rendered.html).toContain('Up to 3 active projects');
    expect(rendered.html).toContain('https://app.example.com/settings/billing');
    expect(rendered.html).toContain('Go to Dashboard');
    expect(rendered.text).toContain('100 project emails');
  });

  it('renders Professional welcome email features', () => {
    const rendered = renderEmailTemplate('subscriptionWelcomeProfessional', {
      firstName: 'Jordan',
      billingUrl: 'https://app.example.com/settings/billing',
      dashboardUrl: 'https://app.example.com/',
      usageSummary: buildSubscriptionUsageSummary('professional'),
    });

    expect(rendered.subject).toBe('Welcome to Arden Project OS Professional');
    expect(rendered.html).toContain('Up to 10 active projects');
    expect(rendered.html).toContain('Client portal access');
    expect(rendered.text).toContain('500 project emails');
  });

  it('renders Business welcome email features', () => {
    const rendered = renderEmailTemplate('subscriptionWelcomeBusiness', {
      billingUrl: 'https://app.example.com/settings/billing',
      dashboardUrl: 'https://app.example.com/',
      usageSummary: buildSubscriptionUsageSummary('business'),
    });

    expect(rendered.subject).toBe('Welcome to Arden Project OS Business');
    expect(rendered.html).toContain('Unlimited active projects');
    expect(rendered.html).toContain('Financial dashboards');
    expect(rendered.text).toContain('2,000 project emails');
  });
});

describe('subscription welcome webhook wiring', () => {
  it('passes stripe event id into subscription upsert from webhook handlers', () => {
    const source = readSource('supabase/functions/stripe-webhook/index.ts');
    expect(source).toContain('upsertSubscriptionRow(admin, payload, { stripeEventId: event.id })');
    expect(source).toContain('syncSubscriptionById(admin, stripe, subscriptionId, userId, event.id)');
  });

  it('skips usage credit pack checkout before subscription welcome sync', () => {
    const source = readSource('supabase/functions/stripe-webhook/index.ts');
    const creditPackIndex = source.indexOf('usage_credit_pack');
    const welcomeUpsertIndex = source.indexOf('upsertSubscriptionRow(admin, payload, { stripeEventId: event.id })');
    expect(creditPackIndex).toBeGreaterThan(-1);
    expect(welcomeUpsertIndex).toBeGreaterThan(creditPackIndex);
  });

  it('does not meter subscription welcome emails through send-transactional-email', () => {
    const helperSource = readSource('supabase/functions/_shared/subscriptionEmails.ts');
    const sendTransactionalSource = readSource('supabase/functions/send-transactional-email/index.ts');

    expect(helperSource).toContain('sendTransactionalEmail');
    expect(helperSource).not.toContain('send-transactional-email');
    expect(helperSource).toContain('unmetered: true');
    expect(sendTransactionalSource).toContain('email_send');
    expect(helperSource).not.toContain('recordUsage');
  });

  it('keeps subscription sync when welcome email send fails', () => {
    const stripeSource = readSource('supabase/functions/_shared/stripe.ts');
    expect(stripeSource).toContain('subscription welcome email failed; subscription sync kept');
  });

  it('creates subscription_email_events migration with dedupe indexes', () => {
    const migration = readSource('supabase/migrations/20260718130000_subscription_email_events.sql');
    expect(migration).toContain('subscription_email_events_stripe_event_email_type_idx');
    expect(migration).toContain('subscription_email_events_subscription_plan_email_type_idx');
    expect(migration).toContain('subscription_welcome_starter');
  });
});

describe('maybeSendSubscriptionWelcomeEmail', () => {
  it('handles missing profile email safely without throwing', async () => {
    const dedupeQuery = {
      eq: vi.fn(function eq(this: unknown) {
        return this;
      }),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    dedupeQuery.eq.mockReturnValue(dedupeQuery);

    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => dedupeQuery),
      })),
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({ data: { user: { email: null } }, error: null })),
        },
      },
    };

    const { maybeSendSubscriptionWelcomeEmail } = await import(
      '../../../supabase/functions/_shared/subscriptionEmails.ts'
    );

    const result = await maybeSendSubscriptionWelcomeEmail(admin as never, {
      userId: 'user-1',
      stripeSubscriptionId: 'sub_123',
      stripeEventId: 'evt_123',
      planId: 'starter',
      status: 'active',
      previousRow: { plan_id: 'starter', status: 'inactive' },
    });

    expect(result.sent).toBe(false);
    expect(result.skippedReason).toBe('missing_email');
  });
});
