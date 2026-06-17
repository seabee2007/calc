# API Usage Inventory — Arden Project OS

Audit date: 2026-06-17  
Scope: discovery/documentation only (no billing implementation in this pass)

## Summary Table

| Service / Integration | Type | Core caller files | Cost / rate limit | Recommended quota unit | Meter candidate |
|---|---|---|---|---|---|
| OpenAI (multiple AI edge functions) | external paid API (via Supabase Edge) | `src/components/ConcreteChat.tsx`, `src/services/projectScopeSummaryService.ts`, `src/services/batchPlantPricingService.ts`, `src/services/laborCrewReviewService.ts`, estimate/project AI services | Yes (token-based) | `ai_request` (optionally `ai_token`) | High |
| Stripe | external paid API + webhook | `src/services/billingService.ts`, `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/stripe-webhook/index.ts` | Yes (payment + API) | `subscription_event` / overage SKU hook | Medium |
| Resend | external paid API + webhook | `src/services/emailService.ts`, `supabase/functions/send-transactional-email/index.ts`, `supabase/functions/resend-webhook/index.ts` | Yes (per email) | `email_send` | High |
| WeatherAPI | external paid API (via Edge) | `src/services/weatherService.ts`, `supabase/functions/getWeatherForecast/index.ts` | Yes (request based) | `weather_request` | High |
| Mapbox (geocode/search/directions/travel) | external paid API (via Edge) | `src/services/geocodeService.ts`, `src/services/mapboxTravelService.ts`, `src/services/batchPlantService.ts`, `supabase/functions/*mapbox*` | Yes (request based) | `geocode_request`, `travel_request`, `place_search` | High |
| Nominatim OSM reverse geocode | external API (direct browser) | `src/utils/location.ts` | Free but strict limits | `reverse_geocode_request` | Medium |
| Supabase Auth | internal Supabase auth / OAuth | `src/contexts/AuthContext.tsx`, `src/lib/oauthAuth.ts`, auth pages | Supabase MAU/rate limits | `auth_session` / `mau` | Medium |
| Supabase DB/RPC | internal Supabase DB | `src/services/*`, `src/lib/*`, store + feature services | Supabase compute/IO limits | `db_operation` (or domain-specific) | Medium |
| Supabase Storage | internal Supabase storage | `src/services/storageService.ts`, `src/services/fieldRecordAttachmentService.ts` | Storage + egress | `storage_mb`, `upload_count` | High |
| Supabase Edge Functions (all) | Supabase Edge Function | `src/services/*` + `src/components/*` invokers, `supabase/functions/*` handlers | Depends on downstream API usage | function-specific | High |
| OAuth providers (Google/GitHub via Supabase) | OAuth | `src/components/auth/SocialLoginButtons.tsx`, `src/lib/oauthAuth.ts` | Provider throttles; no direct paid API in app | `oauth_login` | Low |
| Public token routes (proposal/change order/contract/client portal) | token-based service routes / RPC | `src/lib/proposalTracking.ts`, `src/lib/changeOrderTracking.ts`, `src/features/documents/services/contractDocumentService.ts`, `src/services/clientPortalService.ts` | DB/edge usage, abuse-sensitive | `public_token_view` / `public_action` | High |

---

## Detailed Inventory

### 1) OpenAI-backed AI services

1. **Name**: OpenAI (chat/completions through edge functions)  
2. **Type**: external paid API  
3. **Files that call it**:
   - Frontend: `src/components/ConcreteChat.tsx`, `src/services/projectScopeSummaryService.ts`, `src/features/projects/application/professionalizeProjectScope.ts`, `src/features/estimating/application/recommendEstimateDivisions.ts`, `src/features/estimating/application/suggestEstimateActivitiesFromScope.ts`, `src/services/batchPlantPricingService.ts`, `src/services/batchPlantContactService.ts`, `src/services/laborCrewReviewService.ts`
   - Edge: `supabase/functions/askConcrete/index.ts`, `supabase/functions/summarize-project-scope/index.ts`, `supabase/functions/professionalize-project-scope/index.ts`, `supabase/functions/recommend-estimate-divisions/index.ts`, `supabase/functions/suggest-divisions-from-scope/index.ts`, `supabase/functions/batch-plant-pricing/index.ts`, `supabase/functions/batch-plant-contact/index.ts`, `supabase/functions/labor-crew-review/index.ts`
4. **What it does**: chat assistant, scope summarize/professionalize, division/activity suggestions, batch plant pricing/contact guidance, labor crew review
5. **Costs / limits**: yes; token and request based
6. **Should count against plan limits?** yes
7. **Access recommendation**: owner-only for cost-heavy planning AI; employee-accessible only where field workflow requires it
8. **Current auth method**: edge functions generally require auth; some frontend callers still send anon-key bearer instead of user JWT
9. **Current env vars/secrets**: `OPENAI_API_KEY` (edge/functions), optional script-time `OPENAI_API_KEY` in tooling
10. **Current error handling**: mostly try/catch with fallback responses; limited recoveries; no robust multi-attempt policy
11. **Current retry behavior**: typically none (single call)
12. **Recommended quota unit**: `ai_request` (+ optional `ai_token` later)
13. **Recommended plan limit**:
   - Free: disabled
   - Starter: low monthly allowance
   - Professional: moderate allowance
   - Business: high allowance
14. **Overage/re-up**: yes (usage add-on already aligned with Stripe overage key path)

---

### 2) Stripe billing

1. **Name**: Stripe (checkout, portal, webhook sync)
2. **Type**: external paid API + webhook
3. **Files that call it**:
   - Frontend: `src/services/billingService.ts`, `src/components/subscription/BillingSubscriptionPanel.tsx`, `src/lib/stripeConfig.ts`, `src/lib/stripeBilling.ts`, `src/lib/stripeEnv.ts`
   - Edge: `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/create-customer-portal-session/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/_shared/stripe.ts`
4. **What it does**: subscription purchase, plan changes via portal, source-of-truth subscription status sync to `subscriptions` table
5. **Costs / limits**: payment processor fees + API throttles
6. **Should count against plan limits?** itself no (it defines limits), but usage overages can bill through Stripe
7. **Access recommendation**: owner-only for billing actions
8. **Current auth method**: user JWT for checkout/portal; webhook signature verification for inbound events
9. **Current env vars/secrets**: `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`, `APP_URL`, optional `STRIPE_PUBLISHABLE_KEY` in edge
10. **Current error handling**: function returns structured errors, webhook logs and 500 for retries
11. **Current retry behavior**: Stripe webhook retries handled by Stripe platform
12. **Recommended quota unit**: `subscription_event` (operational), not user-facing quota
13. **Recommended plan limit**: N/A (billing backbone)
14. **Overage/re-up**: yes for add-ons/usage SKUs, not for Stripe API calls

---

### 3) Resend email platform

1. **Name**: Resend
2. **Type**: external paid API + webhook
3. **Files that call it**:
   - Frontend: `src/services/emailService.ts`, proposal/change-order/client-portal email workflows
   - Edge: `supabase/functions/send-transactional-email/index.ts`, `supabase/functions/invite-employee/index.ts`, `supabase/functions/_shared/resend.ts`, `supabase/functions/resend-webhook/index.ts`
4. **What it does**: transactional and invitation emails, webhook status updates
5. **Costs / limits**: yes, per message/provider tier
6. **Should count against plan limits?** yes (especially high-volume follow-up automation)
7. **Access recommendation**: owner-only default; employee-accessible only for approved project comms
8. **Current auth method**: user JWT for send endpoints; webhook signature verification for inbound events
9. **Current env vars/secrets**: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, sender/reply-to envs, email mode flags
10. **Current error handling**: failure logging + status persistence, surfaced errors to caller
11. **Current retry behavior**: no app-level retries; webhook retries by provider
12. **Recommended quota unit**: `email_send`
13. **Recommended plan limit**:
   - Free: minimal/disabled
   - Starter: low monthly sends
   - Professional: moderate
   - Business: high/custom
14. **Overage/re-up**: yes

---

### 4) Weather forecast API

1. **Name**: WeatherAPI (via `getWeatherForecast`)
2. **Type**: external paid API (proxied via Supabase Edge Function)
3. **Files that call it**:
   - Frontend: `src/services/weatherService.ts`, dashboard weather widget and pour-planner weather consumers
   - Edge: `supabase/functions/getWeatherForecast/index.ts`
4. **What it does**: forecast + optional history enrichment for operations/pour planning
5. **Costs / limits**: yes; request-quota based
6. **Should count against plan limits?** yes
7. **Access recommendation**: owner + employee where role requires weather-dependent execution
8. **Current auth method**: user JWT to edge + anon `apikey` header for Supabase call context
9. **Current env vars/secrets**: `WEATHER_API_KEY`, `MAX_FORECAST_DAYS`, `MAX_HISTORY_DAYS`
10. **Current error handling**: function and client catch/return null or error payloads
11. **Current retry behavior**: little/no explicit retry logic
12. **Recommended quota unit**: `weather_request`
13. **Recommended plan limit**:
   - Free: small monthly bucket
   - Starter: medium
   - Professional: higher
   - Business: high/unlimited policy
14. **Overage/re-up**: yes (or soft throttle)

---

### 5) Mapbox geocoding / travel / place search

1. **Name**: Mapbox APIs (geocoding, directions, place search)
2. **Type**: external paid API (via Supabase Edge Functions)
3. **Files that call it**:
   - Frontend: `src/services/geocodeService.ts`, `src/services/mapboxTravelService.ts`, `src/services/batchPlantService.ts`, location and planner pages/components
   - Edge: `supabase/functions/geocode-address/index.ts`, `supabase/functions/mapbox-travel-time/index.ts`, `supabase/functions/find-batch-plant/index.ts`, shared mapbox utils in `_shared`
4. **What it does**: jobsite normalization, travel time estimates, nearby batch plant discovery
5. **Costs / limits**: yes; usage billed per request family
6. **Should count against plan limits?** yes
7. **Access recommendation**: owner + employee where required for field logistics
8. **Current auth method**:
   - `geocode-address`: expects user auth
   - `mapbox-travel-time` / `find-batch-plant`: currently weak/no auth hardening compared to others
9. **Current env vars/secrets**: `MAPBOX_ACCESS_TOKEN`
10. **Current error handling**: variant fallbacks in edge logic; caller catches and degrades
11. **Current retry behavior**: some fallback pathing; little explicit retry/backoff
12. **Recommended quota unit**: `geocode_request`, `travel_request`, `place_search`
13. **Recommended plan limit**:
   - Free: low
   - Starter: medium
   - Professional: higher
   - Business: high/custom
14. **Overage/re-up**: yes

---

### 6) OpenStreetMap Nominatim (direct browser reverse geocode)

1. **Name**: Nominatim OSM reverse geocode
2. **Type**: external API (direct browser call)
3. **Files that call it**: `src/utils/location.ts`
4. **What it does**: lat/lng → readable address fallback path
5. **Costs / limits**: free but strict public rate limits/usage policy
6. **Should count against plan limits?** optional (likely low priority), still abuse-sensitive
7. **Access recommendation**: owner + employee only when geolocation feature used
8. **Current auth method**: none
9. **Current env vars/secrets**: none
10. **Current error handling**: graceful fallback to coordinate text
11. **Current retry behavior**: none
12. **Recommended quota unit**: `reverse_geocode_request`
13. **Recommended plan limit**: mostly operational cap, not monetized
14. **Overage/re-up**: usually no; prefer hard rate protection

---

### 7) Supabase Auth + OAuth

1. **Name**: Supabase Auth (email/password + OAuth)
2. **Type**: internal Supabase auth + OAuth
3. **Files that call it**: `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`, `src/lib/oauthAuth.ts`, login/signup/callback pages, auth hooks
4. **What it does**: authentication, session refresh, OAuth redirects, role bootstrap
5. **Costs / limits**: Supabase MAU/auth limits
6. **Should count against plan limits?** no direct feature quota (use MAU/platform monitoring)
7. **Access recommendation**: public entry, authenticated app routes after login
8. **Current auth method**: Supabase session JWT
9. **Current env vars/secrets**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional auth URL config vars
10. **Current error handling**: explicit handling in context and auth session utilities
11. **Current retry behavior**: refresh + revalidation paths, no aggressive retries
12. **Recommended quota unit**: `auth_session` / `oauth_login`
13. **Recommended plan limit**: N/A
14. **Overage/re-up**: N/A

---

### 8) Supabase DB/RPC data plane

1. **Name**: Supabase Postgres + RPC endpoints
2. **Type**: internal Supabase DB/storage/auth
3. **Files that call it**: broad usage across `src/services/*`, `src/lib/*`, feature modules, and store
4. **What it does**: primary app state (projects, estimates, planner, documents, invitations, subscription reads, etc.)
5. **Costs / limits**: Supabase compute/storage/egress limits
6. **Should count against plan limits?** partially (align by business object: projects/seats/exports)
7. **Access recommendation**: owner+employee by role and project access; public token RPCs remain limited
8. **Current auth method**: user JWT + RLS; select token-based public RPCs
9. **Current env vars/secrets**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
10. **Current error handling**: local try/catch and thrown service errors
11. **Current retry behavior**: minimal
12. **Recommended quota unit**: domain-specific (`active_project`, `planner_record`, `public_view`)
13. **Recommended plan limit**: already partially implemented in entitlements
14. **Overage/re-up**: yes for seat/project/storage expansions

---

### 9) Supabase Storage uploads

1. **Name**: Supabase Storage (logos, attachments, sound assets tooling)
2. **Type**: internal Supabase DB/storage/auth
3. **Files that call it**: `src/services/storageService.ts`, `src/services/fieldRecordAttachmentService.ts`, scripts like `scripts/uploadSounds.ts`
4. **What it does**: file uploads/download URLs, logo management, field attachments
5. **Costs / limits**: storage + egress billable
6. **Should count against plan limits?** yes
7. **Access recommendation**: owner+employee where feature requires, with per-project constraints
8. **Current auth method**: session-based Supabase storage calls
9. **Current env vars/secrets**: frontend supabase vars; script has legacy `VITE_SUPABASE_SERVICE_KEY` pattern
10. **Current error handling**: service-level throw/log
11. **Current retry behavior**: minimal
12. **Recommended quota unit**: `storage_mb`, `upload_count`
13. **Recommended plan limit**:
   - Free: low
   - Starter: moderate
   - Professional: higher
   - Business: high/custom
14. **Overage/re-up**: yes

---

### 10) Client/public token-based routes and RPCs

1. **Name**: Public token services (proposal, change-order, contract, client portal, invite accepts)
2. **Type**: token-based service routes + public RPC
3. **Files that call it**:
   - `src/lib/proposalTracking.ts`
   - `src/lib/changeOrderTracking.ts`
   - `src/features/documents/services/contractDocumentService.ts`
   - `src/services/clientPortalService.ts`
   - `src/services/employeeService.ts` (invite token flow)
4. **What it does**: external recipient access without full account login
5. **Costs / limits**: DB/edge usage + abuse surface
6. **Should count against plan limits?** yes for high-volume public traffic
7. **Access recommendation**: public only with signed/tokenized access; owner-driven issuance
8. **Current auth method**: token params/body + RPC function checks
9. **Current env vars/secrets**: supabase anon/public URLs, function URLs
10. **Current error handling**: caller-level handling with not-found and validation states
11. **Current retry behavior**: minimal/no retries
12. **Recommended quota unit**: `public_token_view`, `public_action`
13. **Recommended plan limit**:
   - Free: very low
   - Starter: low-moderate
   - Professional: moderate-high
   - Business: high/custom
14. **Overage/re-up**: yes

---

## Supabase Edge Function Inventory (usage-sensitive focus)

- AI-related: `askConcrete`, `summarize-project-scope`, `professionalize-project-scope`, `recommend-estimate-divisions`, `suggest-divisions-from-scope`, `batch-plant-pricing`, `batch-plant-contact`, `labor-crew-review`
- Billing: `create-checkout-session`, `create-customer-portal-session`, `stripe-webhook`
- Email: `send-transactional-email`, `invite-employee`, `resend-webhook`
- Geo/weather: `getWeatherForecast`, `geocode-address`, `mapbox-travel-time`, `find-batch-plant`
- Public portal: `client-project-portal`

---

## Recommended Metering Candidates

Highest-value candidates to meter first:

1. `ai_request` (all OpenAI functions)
2. `email_send` (Resend sends)
3. `weather_request`
4. `geocode_request` / `travel_request` / `place_search`
5. `storage_mb` + `upload_count`
6. `document_export` (PDF/export heavy routes)
7. `public_token_view` for externally shared links

---

## High-Risk Unmetered APIs / Paths

1. AI endpoints where frontend callers still use anon bearer to auth-hardened functions (reliability + metering blind spot)
2. Mapbox-heavy endpoints with weaker auth posture (`mapbox-travel-time`, `find-batch-plant`)
3. High-volume email sends without user-level quota controls
4. Public token routes without explicit per-token rate governance
5. Storage growth paths without per-plan storage ceilings

---

## Frontend-Exposed Keys / Vars Review

Expected public vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Findings:

- No Stripe/Mapbox/OpenAI/Resend secret keys found in frontend code
- Ensure no `VITE_*` service-role or secret vars are introduced
- Script/tooling has a legacy `VITE_SUPABASE_SERVICE_KEY` usage pattern; should remain non-frontend and be normalized server-side naming

---

## Additional Config Notes

- `.env.example` includes expected Stripe/Supabase placeholders and local defaults
- `netlify.toml` CSP currently allows Supabase + `*.resend.com` + `api.open-meteo.com`; weather runtime uses edge proxy, but direct OSM reverse geocode path should be rechecked against CSP/allowlist policy

---

## Next Step (separate pass)

Use this inventory to define:

- per-service quota model
- owner vs employee enforcement rules
- plan tiers and overage behavior
- centralized usage tracking schema

This document intentionally stops at discovery/documentation.
