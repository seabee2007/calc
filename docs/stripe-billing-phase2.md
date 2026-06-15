# Stripe Billing — Phase 2

Environment variables and manual verification checklist for Arden Project OS Stripe billing.

## Frontend (`.env.local`)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Existing Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Existing Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes for live checkout UI | Stripe publishable key (`pk_test_...` or `pk_live_...`) |
| `VITE_APP_URL` | Recommended | Public app URL used for client-side links (defaults to `window.location.origin`) |
| `VITE_ENFORCE_PLAN` | Optional | Set to `true` in local dev to test entitlement gates |

Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in frontend env files.

## Supabase Edge Functions

Set these in the Supabase project dashboard or CLI secrets:

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Used by `requireAuth` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role for webhook + checkout customer upsert |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret from Stripe webhook endpoint (`whsec_...`) |
| `APP_URL` | Yes | Public app URL for Checkout success/cancel and portal return URLs |

## Stripe products and lookup keys

Create test-mode Products/Prices in Stripe with lookup keys matching `src/lib/stripeConfig.ts`:

- `arden_starter_monthly`, `arden_starter_annual`
- `arden_professional_monthly`, `arden_professional_annual`
- `arden_business_monthly`, `arden_business_annual`
- `arden_extra_field_seat_monthly` (optional add-on line item)

## Edge functions

| Function | Purpose |
| --- | --- |
| `create-checkout-session` | Authenticated Checkout Session creation |
| `create-customer-portal-session` | Authenticated Billing Portal session |
| `stripe-webhook` | Verified webhook → `public.subscriptions` upsert |

Deploy webhook endpoint in Stripe Dashboard:

```
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Enable events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

## Manual test checklist

- [ ] Stripe test mode products/prices created
- [ ] Lookup keys match `src/lib/stripeConfig.ts`
- [ ] Frontend env vars set (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_APP_URL`)
- [ ] Supabase secrets set (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`)
- [ ] Open **Settings → Billing & Subscription**
- [ ] Start Checkout for Professional or Business
- [ ] Complete Stripe test checkout
- [ ] Webhook receives event (Stripe Dashboard → Developers → Webhooks)
- [ ] `public.subscriptions` row updates with plan/status/customer/subscription IDs
- [ ] Refresh billing page — `useSubscription()` shows updated plan
- [ ] **Manage Billing** opens Customer Portal for subscribed user
- [ ] Cancel subscription in portal — app status becomes `canceled` / plan falls back after refresh
- [ ] Simulate failed payment — status becomes `past_due`
- [ ] Set `VITE_ENFORCE_PLAN=true` and confirm entitlement gates block Starter-only areas

## Architecture notes

- Stripe webhook is the source of truth for subscription status.
- Checkout and portal edge functions never set plan entitlements directly except storing `stripe_customer_id`.
- Plan resolution prefers Stripe Price lookup keys over metadata.
- Client cannot self-upgrade without Stripe redirect.
