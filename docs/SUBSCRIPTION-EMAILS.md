# Subscription upgrade welcome emails

Transactional billing/system emails sent when a customer activates or upgrades to a paid Arden Project OS plan.

## Trigger events

Welcome emails are sent from the Stripe webhook (`supabase/functions/stripe-webhook`) after subscription rows sync through `upsertSubscriptionRow`:

- `customer.subscription.created` → active/trialing paid plan
- `customer.subscription.updated` → upward plan change while active/trialing
- `checkout.session.completed` → subscription checkout sync (same upsert path)

They are **not** sent for:

- Free, inactive, incomplete, canceled, or `past_due` subscriptions
- Usage credit pack checkouts (`metadata.type === 'usage_credit_pack'`)
- Downgrades or no-op re-syncs for the same paid tier
- Duplicate Stripe events or duplicate subscription/plan/type combinations

## Email types

| Plan | `email_type` | Template key |
|------|--------------|--------------|
| Starter | `subscription_welcome_starter` | `subscriptionWelcomeStarter` |
| Professional | `subscription_welcome_professional` | `subscriptionWelcomeProfessional` |
| Business | `subscription_welcome_business` | `subscriptionWelcomeBusiness` |

## Idempotency

Table: `public.subscription_email_events`

Unique indexes:

- `(stripe_event_id, email_type)` — prevents duplicate sends on webhook retries
- `(stripe_subscription_id, plan_id, email_type)` — prevents duplicate sends across multiple Stripe event types for the same resulting plan

## Usage metering

**Billing/system subscription welcome emails do not consume customer `email_send` credits.**

They bypass `send-transactional-email` and call the shared Resend helper directly from the webhook path. They are operational billing confirmations, not customer project communication.

## Preferences

These emails do **not** require `email_updates_enabled` and are not gated by notification preferences.

## Content

Each email includes:

- First-name greeting when available
- Plan name and unlocked features
- Monthly usage summary
- **Open Billing** link → `{APP_URL}/settings/billing`
- **Go to Dashboard** link → `{APP_URL}/`

## Failure handling

If Resend send fails, the webhook still completes subscription sync. Errors are logged and recorded in send metadata; the event is not inserted until send succeeds.

## Testing in Stripe test mode

1. Configure webhook endpoint for test mode events.
2. Complete checkout for Starter, Professional, or Business.
3. Confirm one welcome email per plan upgrade.
4. Replay the same Stripe event and confirm no duplicate email (`subscription_email_events` row blocks resend).
5. Confirm usage credit pack checkout does not send subscription welcome email.
6. Confirm canceled/past_due subscriptions do not send welcome email.

## Key files

- `supabase/migrations/20260718130000_subscription_email_events.sql`
- `supabase/functions/_shared/subscriptionEmails.ts`
- `supabase/functions/_shared/emailTemplates.ts`
- `supabase/functions/_shared/stripe.ts`
- `supabase/functions/stripe-webhook/index.ts`
