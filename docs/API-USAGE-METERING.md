# API Usage Metering (Phase 1)

Centralized server-side usage ledger and monthly limit enforcement for high-cost external APIs. Stripe billing, overage packs, and usage-based invoicing are **not** implemented in this phase.

## `usage_events` schema

Table: `public.usage_events` (migration `20260717130000_usage_events.sql`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Acting user (nullable on delete) |
| `employer_id` | `uuid` | Billing company owner — quotas aggregate here |
| `plan_id` | `text` | Effective plan at consumption time |
| `feature_key` | `text` | Stable feature identifier (see mapping below) |
| `usage_unit` | `text` | Meter bucket (see units below) |
| `quantity` | `numeric` | Usually `1` |
| `source` | `text` | Default `edge` |
| `request_id` | `text` | Optional idempotency key (partial unique index) |
| `metadata` | `jsonb` | Extra context |
| `created_at` | `timestamptz` | Event timestamp |

### Security (RLS)

- **SELECT**: users read rows where `user_id = auth.uid()`; company owners read where `employer_id = auth.uid()`.
- **INSERT/UPDATE/DELETE**: blocked for client roles — writes go through Edge Functions with the service role.

### Lifecycle

1. Edge function authenticates the user.
2. `preflightUsage()` resolves `employer_id`, effective plan, and current monthly usage.
3. If over limit → `429` with structured payload (see below).
4. After successful provider call → `recordUsageEvent()`.
5. Duplicate `request_id` inserts are ignored (retry-safe).

## Usage units (Phase 1)

| Unit | Description |
|------|-------------|
| `ai_request` | OpenAI chat/completion calls |
| `weather_request` | WeatherAPI forecast/history calls |
| `geocode_request` | Mapbox geocode |
| `travel_request` | Mapbox directions / travel time |
| `place_search` | Mapbox place / batch plant search |
| `email_send` | Resend transactional send |

## Monthly limits by plan

Limits are defined in:

- Edge: `supabase/functions/_shared/usageLimits.ts`
- Frontend mirror: `src/lib/usageLimits.ts`

| Unit | Free | Starter | Professional | Business |
|------|------|---------|--------------|----------|
| `ai_request` | 0 | 50 | 250 | 1,000 |
| `weather_request` | 25 | 250 | 1,000 | 5,000 |
| `geocode_request` | 10 | 100 | 500 | 2,000 |
| `travel_request` | 10 | 100 | 500 | 2,000 |
| `place_search` | 10 | 100 | 500 | 2,000 |
| `email_send` | 10 | 100 | 500 | 2,000 |

Period: UTC calendar month (`getUsagePeriod()`).

Plan resolution matches entitlements: only `active` / `trialing` subscriptions unlock paid limits; otherwise **Free**. Employee usage bills against the employer's subscription.

## Metered edge functions

| Feature key | Edge function | Unit |
|-------------|---------------|------|
| `ai.ask_concrete` | `askConcrete` | `ai_request` |
| `ai.scope_summary` | `summarize-project-scope` | `ai_request` |
| `ai.project_scope_professionalize` | `professionalize-project-scope` | `ai_request` |
| `ai.estimate_divisions` | `recommend-estimate-divisions` | `ai_request` |
| `ai.suggest_divisions` | `suggest-divisions-from-scope` | `ai_request` |
| `ai.batch_plant_pricing` | `batch-plant-pricing` | `ai_request` |
| `ai.batch_plant_contact` | `batch-plant-contact` | `ai_request` |
| `ai.labor_crew_review` | `labor-crew-review` | `ai_request` |
| `weather.forecast` | `getWeatherForecast` | `weather_request` |
| `mapbox.geocode` | `geocode-address` | `geocode_request` |
| `mapbox.travel_time` | `mapbox-travel-time` | `travel_request` |
| `mapbox.place_search` | `find-batch-plant` | `place_search` |
| `email.transactional` | `send-transactional-email` | `email_send` |
| `email.employee_invite` | `invite-employee` | `email_send` |

AI metering runs only when the OpenAI path is taken (not keyword/regional fallbacks). Email metering runs only when a message is actually sent.

## Blocked response contract

HTTP **429** body:

```json
{
  "error": "usage_limit_reached",
  "featureKey": "weather.forecast",
  "usageUnit": "weather_request",
  "limit": 25,
  "used": 25,
  "planId": "free",
  "upgradeRequired": true
}
```

Frontend: `UsageLimitError` in `src/lib/usageMetering.ts`; services use `parseEdgeFunctionJson()`.

## Shared edge helpers

| Module | Purpose |
|--------|---------|
| `_shared/usageLimits.ts` | Plan limits + pure check helpers |
| `_shared/usage.ts` | Context resolution, aggregate, record, 429 response |
| `_shared/meterUsage.ts` | Thin wrappers for edge function handlers |

## Adding a new metered API (Phase 2+)

1. Add a `usage_unit` (and limit row for each plan) in both `usageLimits.ts` files.
2. Add a `feature_key` constant.
3. In the edge function:
   ```ts
   import { isUsageConfigured, requireUsageQuota, trackMeteredUsage, usageConfigErrorResponse } from "../_shared/meterUsage.ts";

   // after requireAuth
   if (!isUsageConfigured()) return usageConfigErrorResponse(corsHeaders);
   const quota = await requireUsageQuota(user.id, "my.feature", "my_unit", corsHeaders);
   if (!quota.ok) return quota.response;

   // ... call external provider ...

   await trackMeteredUsage(quota.context, {
     featureKey: "my.feature",
     usageUnit: "my_unit",
     requestId: req.headers.get("x-request-id"),
   });
   ```
4. Update frontend service to use `getMeteredAuthHeaders()` / `parseEdgeFunctionJson()`.
5. Document the mapping in this file.

## Explicitly not metered (Phase 1)

- Supabase DB reads/writes, page loads, dashboard widgets
- Arden Calc local math (volume, PSI, cost formula, waste factor, price breakdown)
- Stripe checkout/webhooks (unchanged)

## Arden Calc / Concrete Calculator — metering policy

The concrete calculator is split into two tiers:

### Free / local (always unmetered)

| Action | What runs |
|--------|-----------|
| Opening Arden Calc | Nothing metered |
| Typing dimensions (length, width, thickness, volume, PSI) | Local math only |
| Changing waste factor, delivery options | Local math only |
| Saving a calculation | DB write only |

No browser geolocation request, no geocode call, no batch-plant search, no travel-time call, and no AI call fires automatically on mount or on input change.

### Metered supplier tools (explicit user action only)

All location, map, and AI calls are behind explicit buttons in the **Supplier tools** section of the calculator.

| User action | Edge function | Usage unit | UI helper text |
|-------------|---------------|------------|----------------|
| Click **"Find nearby batch plants"** | `find-batch-plant` (`place_search`) + `mapbox-travel-time` (`travel_request`) | `place_search` + `travel_request` | _"Uses map/location credits."_ |
| Click **"Use my current location"** (inside jobsite section) | `geocode-address` (`geocode_request`) | `geocode_request` | — |
| Click **"Estimate supplier pricing with AI"** | `batch-plant-pricing` (`ai_request`) | `ai_request` | _"Uses AI credits."_ |

#### Usage limit messages

| Limit reached | Message shown |
|---------------|---------------|
| `place_search` / `travel_request` / `geocode_request` limit | "You've reached your monthly map/location lookup limit." |
| `ai_request` limit | "You've reached your monthly AI request limit." |

The **Supplier tools** section is collapsed by default and only appears after the user interacts with the jobsite section. Clicking **"Find nearby batch plants"** requires a verified jobsite address; the button is disabled until a location is applied.

## Future: Stripe re-up / overage (Phase 3 — not implemented)

Phase 3 may add:

- Stripe metered billing or one-time overage packs
- Per-seat or per-project caps

See **Phase 2** and **Phase 3** sections below for current visibility vs planned purchases.

---

## Phase 2 — Usage visibility (implemented)

### Where users view usage

1. **Billing → Usage & Limits** — [`BillingSubscriptionPanel`](src/components/subscription/BillingSubscriptionPanel.tsx) renders [`UsageLimitsPanel`](src/components/subscription/UsageLimitsPanel.tsx) under subscription status.
2. **Operations Dashboard → Usage Meter widget** — optional catalog widget (`usageMeter`) in Admin / Business category.

### Usage summary API

Edge function: [`supabase/functions/get-usage-summary/index.ts`](supabase/functions/get-usage-summary/index.ts)

Frontend service: [`src/services/usageSummaryService.ts`](src/services/usageSummaryService.ts)

Response:

```json
{
  "periodStart": "2026-06-01T00:00:00.000Z",
  "periodEnd": "2026-07-01T00:00:00.000Z",
  "planId": "starter",
  "items": [
    {
      "usageUnit": "ai_request",
      "label": "AI requests",
      "used": 12,
      "limit": 50,
      "remaining": 38,
      "percentUsed": 24,
      "resetsAt": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

Aggregation mirrors enforcement scope: **employer/company totals** for the UTC calendar month.

### Role visibility (Phase 2)

- **Owners/admins**: can load usage summary and add the Usage Meter widget.
- **Employees**: billing shows an owner-only notice; widget is hidden from catalog.

### Usage state colors

| Percent used | Band | UI |
|--------------|------|-----|
| 0–69% | normal | cyan progress |
| 70–89% | caution | yellow progress |
| 90–99% | warning | amber progress |
| 100% or limit 0 | blocked | red progress + upgrade CTA |

Helpers: [`src/lib/usageLabels.ts`](src/lib/usageLabels.ts)

### Limit-reached UX

When edge functions return `usage_limit_reached`, frontend surfaces friendly copy via [`src/lib/usageLimitUx.ts`](src/lib/usageLimitUx.ts):

- used / limit
- reset date (UTC month end)
- upgrade link to Billing (`buildBillingUpgradeUrl`)

Integrated in Concrete Chat, Weather widget, Project form (scope/name/geocode), and metered services.

### Usage Meter widget behavior

| Width | Shows |
|-------|-------|
| third | top 2 categories by % used |
| half | top 4 categories with progress bars |
| full | all metered categories + reset date |

CTA: **Open Billing** / **Upgrade plan** when at limit.

---

## Phase 3 — Stripe re-up / usage credit purchases (implemented)

See **[docs/USAGE-CREDIT-PACKS.md](USAGE-CREDIT-PACKS.md)** for the full reference.

### Overview

Paid plan owners can purchase one-time usage credit packs through Stripe Checkout when they have exhausted their monthly base allowance.

### Pack catalog

| Pack ID | Stripe Lookup Key | Credits |
|---------|-------------------|---------|
| `ai_100` | `arden_ai_request_pack_100` | 100 × `ai_request` |
| `weather_map_500` | `arden_weather_map_pack_500` | 125 each × `weather_request`, `geocode_request`, `travel_request`, `place_search` |
| `email_500` | `arden_email_send_pack_500` | 500 × `email_send` |

### Credit consumption order

1. Monthly base allowance is consumed first.
2. Credit pack balance is drawn only after base is exhausted.
3. Credits expire at the end of the UTC calendar month of purchase.

### Key files

| Layer | File |
|-------|------|
| Migration | `supabase/migrations/20260717140000_usage_credit_packs.sql` |
| Pack catalog (edge) | `supabase/functions/_shared/usageCreditPacks.ts` |
| Checkout + webhook helpers (edge) | `supabase/functions/_shared/usageCreditPackCheckout.ts` |
| Credit-aware check (edge) | `supabase/functions/_shared/usageCredits.ts` |
| Checkout edge function | `supabase/functions/create-usage-credit-checkout/index.ts` |
| Pack catalog (frontend) | `src/lib/usageCreditPacks.ts` |
| Checkout helpers (frontend) | `src/lib/usageCreditPackCheckout.ts` |
| Credit check (frontend) | `src/lib/usageCredits.ts` |
| Limit-reached UX | `src/lib/usageLimitUx.ts` |
| Usage limits panel | `src/components/subscription/UsageLimitsPanel.tsx` |
| Usage limit notice | `src/components/subscription/UsageLimitNotice.tsx` |

### Stripe dashboard setup (manual — production)

Create three one-time prices with exact lookup keys listed above. See `docs/USAGE-CREDIT-PACKS.md → Stripe setup` for full instructions.

### Phase 3 NOT yet implemented

- Optional Stripe metered billing / overage automation
- Admin tooling for custom Business limits

Do not implement Phase 3 until usage recording and visibility are verified in production.
