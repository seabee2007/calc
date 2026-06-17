# Usage Credit Packs — Re-Up Guide

One-time usage credit purchases that extend monthly metered API limits beyond the base plan allowance.

---

## Product rules

1. **Base monthly allowance is consumed first.** Credits are only drawn after the base plan limit is exhausted.
2. **Credits expire at the end of the current billing period.** The `expires_at` timestamp is set to the UTC month boundary at checkout time.
3. **Only paid plan owners can buy credit packs.** Free users and employees are blocked at the edge function level.
4. **Credit packs do not change the subscription plan.** They add capacity on top of the existing plan.
5. **Credit packs do not unlock paid features.** Feature gates remain plan-based.
6. **Credit packs are one-time payments** via Stripe Checkout — not subscriptions.

---

## Pack catalog

| Pack ID | Label | Stripe Lookup Key | Units |
|---------|-------|-------------------|-------|
| `ai_100` | AI Credit Pack (100) | `arden_ai_request_pack_100` | `ai_request`: 100 |
| `weather_map_500` | Weather / Map Credit Pack (500) | `arden_weather_map_pack_500` | `weather_request`: 125, `geocode_request`: 125, `travel_request`: 125, `place_search`: 125 |
| `email_500` | Email Credit Pack (500) | `arden_email_send_pack_500` | `email_send`: 500 |

The weather/map pack splits 500 credits evenly across the four map/weather metered units.

---

## Database

Table: `public.usage_credit_packs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Purchasing user |
| `employer_id` | `uuid` | Billing company (quota scope) |
| `stripe_checkout_session_id` | `text` | Unique per row per unit |
| `stripe_payment_intent_id` | `text` | Nullable |
| `stripe_customer_id` | `text` | Nullable |
| `usage_unit` | `text` | Metered unit this row covers |
| `quantity_purchased` | `numeric` | Original pack quantity |
| `quantity_remaining` | `numeric` | Decremented on each usage |
| `status` | `text` | `active` → `depleted` when zero |
| `expires_at` | `timestamptz` | UTC month boundary of purchase period |
| `metadata` | `jsonb` | `{ pack_id, source }` |
| `created_at` | `timestamptz` | — |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

### Idempotency

The unique index on `(stripe_checkout_session_id, usage_unit)` ensures the webhook is retry-safe. A duplicate `23505` error is caught and silently ignored.

### Credit consumption RPC

```sql
public.consume_usage_credit_pack(
  p_employer_id uuid,
  p_user_id uuid,
  p_usage_unit text,
  p_quantity numeric default 1
) returns uuid
```

- Finds the **oldest active, non-expired** pack for the employer and unit.
- Uses `SELECT ... FOR UPDATE` — concurrency-safe.
- Decrements `quantity_remaining`; sets `status = 'depleted'` when zero.
- Returns the first pack ID consumed.
- Throws `insufficient_credits` if no credits are available.
- Only callable by `service_role` (blocked from client roles).

---

## Edge functions

### `create-usage-credit-checkout`

**Request**
```json
{ "packId": "ai_100", "returnTo": "/settings/billing" }
```

**Auth checks** (all enforced server-side):
1. User must be authenticated.
2. User profile role must be `owner` or `admin`.
3. Subscription plan must be non-free and active/trialing.

**Forbidden fields:** `priceId`, `price`, `amount`, `line_items`, `lineItems`, `stripePriceId` — rejected 400 if present (prevents client price injection).

**Behavior:**
1. Validates `packId` against catalog.
2. Resolves `employer_id` from profile.
3. Checks plan eligibility.
4. Creates or reuses Stripe customer.
5. Looks up Stripe price by lookup key (mode-safe).
6. Creates Stripe Checkout session (`mode: payment`).
7. Sets `metadata.type = "usage_credit_pack"` so the webhook knows how to handle it.
8. Returns `{ url }` — client redirects via `window.location.assign(url)`.

**Error responses:**
- `403 owner_only` — employee tried to buy
- `403 paid_plan_required` — free plan tried to buy
- `400 Invalid packId` — unknown pack
- `500 Server configuration error` — missing env vars

### `stripe-webhook` — credit pack path

When `checkout.session.completed.metadata.type === "usage_credit_pack"`:
- Calls `insertUsageCreditPacksFromCheckout(admin, session)`.
- Inserts one `usage_credit_packs` row per unit in the pack.
- Sets `expires_at` from checkout metadata.
- **Does not touch `subscriptions` table** — credit packs never change subscription status.
- Idempotent on duplicate `stripe_checkout_session_id`.

---

## Usage consumption flow

Defined in `_shared/usage.ts` → `recordUsageWithCreditAccounting`:

```
1. Fetch current month usage for the unit.
2. Check if base plan limit covers the request.
3. If base allows → record usage_event with { usageSource: "monthly_allowance" }.
4. If base is exhausted → call consume_usage_credit_pack RPC.
5. If credits allow → record usage_event with { usageSource: "credit_pack", creditPackId: "..." }.
6. If neither allows → block (caller gets 429).
```

Credits are only decremented **after** the external API call succeeds (within `recordUsageWithCreditAccounting`). If the API call fails, no credits are consumed.

---

## Usage summary

`get-usage-summary` returns per-unit items with:

```json
{
  "usageUnit": "ai_request",
  "label": "AI requests",
  "used": 50,
  "limit": 50,
  "remaining": 0,
  "creditRemaining": 80,
  "creditsExpireAt": "2026-07-01T00:00:00.000Z",
  "percentUsed": 100,
  "resetsAt": "2026-07-01T00:00:00.000Z"
}
```

`creditRemaining` is the sum of `quantity_remaining` across all active, non-expired packs for the unit.

---

## Frontend

### Catalog mirror

`src/lib/usageCreditPacks.ts` — mirrors `_shared/usageCreditPacks.ts`. Must be kept in sync.

### Checkout service

`src/services/billingService.ts` → `createUsageCreditCheckout(packId, returnTo)` calls `create-usage-credit-checkout` and returns the Stripe URL. Caller calls `redirectToStripeUrl(url)`.

### Checkout result handling

`BillingSubscriptionPanel` reads `?creditCheckout=` query param:
- `?creditCheckout=success` → toast "Usage credits added." + refetch usage summary
- `?creditCheckout=canceled` → notice "Usage credit purchase canceled."

### Billing panel

`UsageLimitsPanel` shows:
- **Paid owner**: "Buy more (Pack label)" button per usage group. Clicking starts Stripe checkout.
- **Free plan**: No buy-more button. Upgrade CTA only.
- Credit balance: `"X monthly remaining · Y credits"` inline in each row.
- Expiry: `"Credits expire <date>"` when credits exist.

### UsageLimitNotice

When a metered edge function returns `usage_limit_reached`:
- **Free plan** → primary CTA: "Upgrade plan"
- **Paid plan, buyMoreAvailable** → primary CTA: "Buy (Pack label)", secondary: "Upgrade plan"
- **Employee** (no buyMoreAvailable from server) → upgrade link only; employee should ask owner

---

## Stripe setup (manual — production)

1. Create three one-time products in Stripe dashboard (live mode):
   - **AI Credit Pack** — Price: one-time, set lookup key `arden_ai_request_pack_100`
   - **Weather / Map Credit Pack** — Price: one-time, set lookup key `arden_weather_map_pack_500`
   - **Email Credit Pack** — Price: one-time, set lookup key `arden_email_send_pack_500`
2. Prices should be in USD; set appropriate amounts for your business.
3. Verify lookup keys match exactly — the edge function uses `stripe.prices.list({ lookup_keys: [key] })`.
4. The `stripe-webhook` function already handles `checkout.session.completed` for these packs.

---

## Test coverage

| Test | File |
|------|------|
| Pack catalog lookup keys and quantities | `src/lib/__tests__/usageCreditPacks.test.ts` |
| Credit-aware check: base before credits | `src/lib/__tests__/usageCredits.test.ts` |
| Credits consumed after base exhausted | `src/lib/__tests__/usageCredits.test.ts` |
| Webhook row builder correctness | `src/lib/__tests__/usageCreditPackCheckout.test.ts` |
| Webhook idempotency (duplicate session) | `src/lib/__tests__/usageCreditPackCheckout.test.ts` |
| Billing panel: buy-more for paid owner | `src/components/subscription/__tests__/UsageLimitsPanel.test.tsx` |
| Billing panel: no buy-more for free plan | `src/components/subscription/__tests__/UsageLimitsPanel.test.tsx` |
| UsageLimitNotice: correct CTA by plan | `src/components/subscription/__tests__/UsageLimitNotice.test.tsx` |
