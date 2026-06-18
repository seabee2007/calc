# Stripe Production Readiness — Arden Project OS

Audit date: 2026-06-17  
Scope: billing stack audit + hardening pass (no live key switch, no pricing changes)

---

## Executive summary

Arden Project OS billing is **architecturally ready** for Stripe production with a server-authoritative model: checkout/portal run through authenticated Supabase Edge Functions, webhooks verify signatures and upsert `public.subscriptions`, and entitlements resolve from DB status (`active` / `trialing` only unlock paid access; no row = Free).

This pass added **env mode sanity checks**, **checkout field rejection**, **customer-only webhook row hardening**, **subscription RLS lockdown**, and **production URL guards**. Live keys were **not** switched in code.

---

## Passed checks

### 1. Secret safety
| Check | Status |
|-------|--------|
| No `sk_test`, `sk_live`, `pk_*`, or `whsec_*` committed in repo | Passed (grep clean) |
| `.env.example` uses placeholders only | Passed |
| `.env.local` gitignored via `*.local` | Passed |
| No `VITE_STRIPE_SECRET_KEY` | Passed |
| Stripe secret key only in edge `STRIPE_SECRET_KEY` | Passed |
| No service role in `VITE_*` vars in app code | Passed (QA scripts block `VITE_SUPABASE_SERVICE_ROLE_KEY`) |

### 2. Environment separation
| Check | Status |
|-------|--------|
| Local/dev can use test keys | Supported |
| Production intended to use live keys | Documented |
| Runtime mode validation added | Hardened this pass |
| `pk_test` pairs with `sk_test`, `pk_live` pairs with `sk_live` | Edge `getStripe()` validates; optional `STRIPE_PUBLISHABLE_KEY` cross-check |
| Frontend warns on `pk_test_` in production builds | `validateClientStripePublishableKey()` on billing page |
| `STRIPE_MODE` must match secret key prefix | Edge validation |
| Live mode blocks `APP_URL=localhost` | `validateAppUrlForStripeMode()` |

### 3. Checkout security
| Check | Status |
|-------|--------|
| Client sends only `planId`, `billingInterval`, optional `fieldSeatQuantity`, optional return URLs | Passed |
| Client cannot send price amount | Rejects `price`, `amount`, `line_items`, etc. |
| Client cannot send Stripe price ID | Rejects `priceId`, `stripePriceId` |
| Server maps plan + interval to lookup keys to Stripe prices | Passed |
| Requires authenticated Supabase JWT | `requireAuth()` |
| User ID from JWT, not client body | `authResult.user.id` |
| Success/cancel URLs validated against `APP_URL` origin | `resolveAppReturnUrl()` |
| Default return: `{APP_URL}/settings/billing?checkout=success\|canceled` | Passed |

### 4. Billing portal security
| Check | Status |
|-------|--------|
| Requires authenticated user | Passed |
| Uses server-side `stripe_customer_id` from DB | Passed |
| Clean 404 when no customer | Passed |
| Default return URL: `{APP_URL}/settings/billing` | Passed |

### 5. Webhook security
| Check | Status |
|-------|--------|
| Reads raw request body | `req.text()` |
| Verifies Stripe signature | Passed |
| Uses `constructEventAsync` (Deno) | Passed |
| Rejects missing/invalid signatures | 400 |
| Handles required events | All six listed below |
| Plan from Stripe lookup keys first, metadata fallback | Passed |
| Upserts `public.subscriptions` from Stripe data | Passed |

**Handled events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 6. Subscription source of truth
| Check | Status |
|-------|--------|
| Auth bootstrap does not create paid/trial rows | `authBootstrapService.ts` |
| No row = Free | `resolveEffectivePlan()` |
| `inactive` / `incomplete` / `canceled` / `past_due` do not unlock paid access | Only `active` + `trialing` |
| `plan_id` from Stripe lookup key mapping | Passed |
| `stripe_customer_id` / `stripe_subscription_id` saved server-side | Passed |
| Customer pre-checkout row uses `status: inactive` | Passed |
| Client cannot INSERT/UPDATE subscriptions | Hardened this pass (RLS migration) |

### 7. User-facing plan labels
| State | Billing page / profile badge |
|-------|------------------------------|
| No subscription row | Free |
| Customer-only row (no `stripe_subscription_id`) | Free |
| Starter active | Starter plan |
| Professional active | Professional plan |
| Business active | Business plan |
| `past_due` | Past due (warning) |
| `canceled` | Canceled |

Implemented in `profilePlanLabel.ts`; tests in `profilePlanLabel.test.ts`.

### 8. Production URLs
| URL | Expected production value |
|-----|---------------------------|
| Marketing | `https://ardenprojectos.com` |
| App | `https://app.ardenprojectos.com` |
| Billing | `https://app.ardenprojectos.com/settings/billing` |

Checkout/portal URLs are built from `APP_URL` env (not hardcoded localhost). Localhost is correct for dev `.env.example`. Live mode rejects localhost `APP_URL`.

### 9. Branding
| Check | Status |
|-------|--------|
| Billing UI uses Arden Project OS | `BillingPage.tsx`, `BRAND_NAME` |
| No PricePilot in billing components | Passed |
| Legacy "Concrete Calc" in billing/Stripe paths | None found |
| Stripe Checkout branding | Configure in Stripe Dashboard (Business name, logo) |

### 10. Tests / build
| Check | Status |
|-------|--------|
| Plan resolution tests | `stripeBilling.test.ts` |
| Env mode tests | Added `stripeEnv.test.ts` |
| Profile/billing label tests | `profilePlanLabel.test.ts` |
| `npm test` | Run after this pass |
| `npm run build` | Run after this pass |

---

## Hardening applied in this pass

1. **`src/lib/stripeEnv.ts`** — publishable key mode detection; production build warning for test keys.
2. **`supabase/functions/_shared/stripe.ts`** — secret/publishable/`STRIPE_MODE` consistency; live `APP_URL` guard.
3. **`create-checkout-session`** — rejects client-sent price IDs, amounts, and line items.
4. **`stripe-webhook`** — customer-only upsert sets `status: inactive` (avoids DB default `trialing`).
5. **`20260717120000_subscriptions_server_write_only.sql`** — drops client INSERT/UPDATE RLS; default status to `inactive`.
6. **Removed client `upsertSubscription()`** — subscriptions are server-written only.
7. **`.env.example`** — documents `STRIPE_MODE`, optional server publishable cross-check, production `APP_URL`.

---

## Required manual Stripe Dashboard steps (before go-live)

1. **Activate live mode** in Stripe Dashboard (business verification complete).
2. **Create live Products & Prices** mirroring test lookup keys:
   - `arden_starter_monthly` / `arden_starter_annual`
   - `arden_professional_monthly` / `arden_professional_annual`
   - `arden_business_monthly` / `arden_business_annual`
   - Add-ons: `arden_extra_field_seat_monthly`, `arden_extra_project_pack_monthly`, `arden_ai_requests_overage`
3. **Configure Customer Portal** — allow plan changes, payment method updates, cancellation; brand as **Arden Project OS**.
4. **Configure Checkout branding** — logo, accent color, business name **Arden Project OS**.
5. **Create live webhook endpoint** pointing to:
   ```
   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
   Enable events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`.
6. **Copy live webhook signing secret** (`whsec_...`) — must be from the **live** endpoint, not test.
7. **Verify tax settings** if collecting tax (currently not in code path — confirm business requirement).
8. **Test a live $0 or small real charge** in staging with live keys before announcing.

---

## Required live environment variables / secrets

### Netlify (frontend build)
| Variable | Production value |
|----------|------------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `VITE_APP_URL` | `https://app.ardenprojectos.com` |
| `VITE_ENFORCE_PLAN` | `true` |

### Supabase Edge Function secrets
| Secret | Production value |
|--------|------------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (optional cross-check) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from **live** webhook |
| `STRIPE_MODE` | `live` |
| `APP_URL` | `https://app.ardenprojectos.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | (already set) |
| `SUPABASE_URL` | (already set) |
| `SUPABASE_ANON_KEY` | (already set) |

**Pairing rules:**
- `STRIPE_MODE=live` + `sk_live_` + `pk_live_` + live `whsec_`
- Never mix test publishable with live secret (or vice versa)

---

## Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DB default was `trialing` until migration runs | Medium | Apply migration `20260717120000_subscriptions_server_write_only.sql` |
| `resolvePlanFromStripeSubscription` falls back to metadata, then `"starter"` | Low | Ensure live prices have correct lookup keys |
| `uploadSounds.ts` references `VITE_SUPABASE_SERVICE_KEY` (legacy) | Low | Unrelated to billing; migrate to `SUPABASE_SERVICE_ROLE_KEY` in scripts |
| Stripe Dashboard branding not in code | Info | Manual Dashboard setup |
| Webhook delivery failures | Medium | Monitor Supabase function logs; Stripe retry dashboard |
| `past_due` users lose paid access immediately | By design | Confirm product policy; portal prompts payment update |
| No idempotency keys on checkout session create | Low | Acceptable at current volume; add if duplicate sessions become an issue |

---

## Live smoke test checklist

After deploying live secrets (do **not** skip test mode verification first):

- [ ] New user signup: no `subscriptions` row, **Free** plan, limits enforced
- [ ] Billing page shows **Free**, status **No active subscription**
- [ ] Upgrade Starter monthly: Stripe Checkout opens (live mode badge in Stripe UI)
- [ ] Complete checkout: webhook fires, row shows `active`, plan **Starter**
- [ ] App unlocks Starter features within one refresh
- [ ] **Manage Billing** opens Customer Portal, returns to `/settings/billing`
- [ ] Upgrade to Professional via portal, webhook updates plan
- [ ] Cancel subscription: `cancel_at_period_end` or `canceled` reflected on billing page
- [ ] Simulate failed payment (Stripe test card in test mode first): `past_due` label, paid access revoked
- [ ] Employee under owner inherits owner subscription (employee portal gating)
- [ ] No localhost URLs in Stripe Checkout success/cancel or portal return URLs
- [ ] Stripe receipts/emails show **Arden Project OS**

---

## Files audited

- `supabase/functions/_shared/stripe.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-customer-portal-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/lib/stripeConfig.ts`
- `src/lib/stripeBilling.ts`
- `src/lib/stripeEnv.ts` (new)
- `src/services/billingService.ts`
- `src/services/subscriptionService.ts`
- `src/lib/entitlements.ts`
- `src/contexts/SubscriptionContext.tsx`
- `src/pages/BillingPage.tsx`
- `src/components/subscription/*`
- `docs/SUBSCRIPTION-EMAILS.md` (upgrade welcome emails — unmetered billing/system mail)
- `.env.example`
- `netlify.toml`

---

## Do not do yet

- Do **not** commit live keys to git or Netlify preview branches
- Do **not** point live webhook to a dev Supabase project
- Do **not** switch `STRIPE_MODE=live` until live prices and webhook exist
- Do **not** remove test-mode support — keep separate test/live env configs
