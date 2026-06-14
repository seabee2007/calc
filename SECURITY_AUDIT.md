# Arden Project OS — Security Audit

**Date:** June 14, 2026  
**Auditor:** Cursor Agent  
**Scope:** `src/` (React/TypeScript), 77 SQL migrations, 19 edge functions, `netlify.toml`

---

## Executive Summary

Overall posture is **solid for authenticated owner flows**: financial/settings routes are now `OwnerGuard`-protected, contract signing and client portal use hardened token patterns, and core tables have RLS with project-scoped helpers. The main open gaps are **public-token RPCs that return full database rows** (internal costs/profit visible in raw API responses even when the UI hides them), and **several edge functions callable without user authentication** that proxy paid APIs (OpenAI, Mapbox, WeatherAPI), creating credit-exhaustion and abuse risk. Netlify security headers (HSTS, CSP, Permissions-Policy) were added this session; CSP still allows `unsafe-inline`/`unsafe-eval` for Vite compatibility.

---

## Already Fixed (this session)

- **Owner-only routes:** `/proposals`, `/accounting-tax`, `/settings`, `/financials`, `/proposal-generator` wrapped with `OwnerGuard` in `src/App.tsx`.
- **Netlify hardening:** `netlify.toml` now includes `Strict-Transport-Security`, `Permissions-Policy`, and a starter `Content-Security-Policy`.

---

## Critical Findings

*None — no unauthenticated access to owner financial data or authentication bypass without a valid token was identified.*

---

## High Findings

### H1 — Public proposal RPC returns full row including internal financials

**Files:** `supabase/migrations/20250527120000_proposal_tracking_and_financial_dashboard.sql`, `src/lib/proposalTracking.ts`  
**Risk:** Anyone with a sent proposal link can call `get_proposal_by_public_token` (anon, no JWT) and receive `labor_cost`, `material_cost`, `gross_profit`, `gross_margin_percent`, `user_id`, and the full `data` JSONB including `importedEstimateSummary` with profit/overhead breakdown. The UI uses `audience='client'` filter but the **network payload is not filtered** — a client with browser devtools or any HTTP client can read margin data.  
**Recommended fix:** Replace `RETURNS proposals` with a `jsonb` projection returning client-safe fields only (totals, title, scope, payment terms), mirroring the contract `get_contract_by_public_token` pattern. Strip `importedEstimateSummary`, line-item costs, `user_id`, `gross_profit`, `gross_margin_percent`.  
**Migration required:** Yes  
**Netlify config:** No  
**Edge redeploy:** No

---

### H2 — Public change-order RPC returns full row including markup and unit costs

**Files:** `supabase/migrations/20260617000000_change_order_public_context.sql`, `src/lib/changeOrderTracking.ts`  
**Risk:** `get_change_order_by_public_token` uses `to_jsonb(co)` — the entire `change_orders` row — including `markup_percent`, `labor_items`, `material_items`, `equipment_items`, `gross_profit`, `user_id`, `project_id`. `record_change_order_client_action` also `RETURNS change_orders` (full row). UI hides internals but API does not.  
**Recommended fix:** Return a client-safe JSON shape (agreed totals, scope summary, display-only status fields). Never return markup, line-item unit costs, or overhead on public paths.  
**Migration required:** Yes  
**Netlify config:** No  
**Edge redeploy:** No

---

### H3 — Paid API proxy edge functions callable without authentication

**Files:** `supabase/functions/askConcrete/index.ts`, `summarize-project-scope/index.ts`, `geocode-address/index.ts`, `getWeatherForecast/index.ts`, `labor-crew-review/index.ts`, `batch-plant-contact/index.ts`, `batch-plant-pricing/index.ts`  
**Risk:** All accept requests with only the public Supabase anon key — no JWT required. Anyone can exhaust OpenAI, Mapbox, and WeatherAPI credits. `askConcrete` also accepts arbitrary `projectContext` strings.  
**Recommended fix:** Add JWT validation (`Authorization: Bearer <token>`) on all paid-proxy functions. Add per-user rate limiting. Consider a shared `requireAuth` helper for Deno edge functions.  
**Migration required:** No  
**Netlify config:** No  
**Edge redeploy:** Yes (all 7 functions)

---

### H4 — `field-attachments` storage bucket is public

**Files:** `supabase/migrations/20260601000002_field_planner_attachments_messages.sql`, `src/services/storageService.ts`  
**Risk:** The `field-attachments` bucket has `public: true` with a `SELECT TO public` policy. Jobsite photos and task documents are accessible to anyone who knows or guesses the URL path. UUIDs in paths reduce guessability but authenticated-only access is the correct model for customer project files.  
**Recommended fix:** Set bucket to private; generate signed URLs with a short TTL (e.g. 1 hour) at read time. Scope upload RLS to assigned employees only.  
**Migration required:** Yes  
**Netlify config:** No  
**Edge redeploy:** No

---

## Medium Findings

### M1 — `getPublicAppUrl` uses `window.location.origin` on app host

**Files:** `src/config/brand.ts`, `src/lib/proposalTracking.ts`  
**Risk:** Share links generated from Netlify preview/staging deploys will point clients to non-production URLs. Edge email helpers correctly use `SITE_URL`/`PUBLIC_APP_URL`; the frontend does not.  
**Recommended fix:** Prefer `import.meta.env.VITE_APP_URL` (or equivalent) for all externally-shared URLs in production builds. Reserve `window.location.origin` for development fallback only.  
**Migration required:** No  
**Netlify config:** No (env var already set)  
**Edge redeploy:** No

---

### M2 — `client-project-portal` edge function builds document URLs from `Origin` header

**File:** `supabase/functions/client-project-portal/index.ts`  
**Risk:** Links returned in the client portal payload (proposal/contract review links) are constructed from `req.headers.get("origin")`. A misconfigured or spoofed `Origin` could embed a wrong host in links sent to clients.  
**Recommended fix:** Use the configured `SITE_URL` / `PUBLIC_APP_URL` environment variable instead.  
**Migration required:** No  
**Netlify config:** No  
**Edge redeploy:** Yes

---

### M3 — Planner estimate workspace accessible to all authenticated users

**Files:** `src/App.tsx`, `supabase/migrations/20260620000000_estimating_engine_core.sql`  
**Risk:** `/projects/:projectId/planner/estimate` is `auth-general`. Employees assigned via `employee_project_assignments` can read `estimate_line_items` including `labor_rate`, `profit_percent`, `overhead_percent` via the `can_access_project` RLS helper. May be intentional for PM/foreman roles but should be confirmed.  
**Recommended fix:** If employees should not see margin/rates, add a separate employee-facing estimate view (redacted) and restrict the main estimate SELECT to owners. Alternatively, document explicitly that PM/foreman access to rates is intentional.  
**Migration required:** Yes (if restricting)  
**Netlify config:** No  
**Edge redeploy:** No

---

### M4 — `/tools/contract-builder` not owner-only

**File:** `src/App.tsx`  
**Risk:** Any authenticated user (including employees) can open the contract builder UI. RLS limits writes to `user_id = auth.uid()`, but the UI should be owner-only if only owners send contracts.  
**Recommended fix:** Wrap with `OwnerGuard` in `App.tsx` if employees should not access contract creation.  
**Migration required:** No  
**Netlify config:** No  
**Edge redeploy:** No

---

### M5 — CORS `Access-Control-Allow-Origin: *` on all edge functions

**File:** `supabase/functions/_shared/cors.ts`  
**Risk:** Combined with unauthenticated functions (see H3), any web origin can invoke functions from a victim's browser session. After auth is enforced on all functions, this reduces to defence-in-depth.  
**Recommended fix:** Restrict to `https://app.ardenprojectos.com` and known marketing origins.  
**Migration required:** No  
**Netlify config:** No  
**Edge redeploy:** Yes (shared file change)

---

### M6 — CSP allows `unsafe-inline` and `unsafe-eval`

**File:** `netlify.toml`  
**Risk:** Weakens XSS mitigation; a content injection vulnerability could run arbitrary scripts. This is a common starting point for Vite/Tailwind apps.  
**Recommended fix:** After confirming app loads on preview, remove `unsafe-eval` first (it is rarely needed at runtime), then work toward eliminating `unsafe-inline` with nonces or a hash-based policy.  
**Migration required:** No  
**Netlify config:** Yes  
**Edge redeploy:** No

---

### M7 — `send-transactional-email` exception handler returns `error.message`

**File:** `supabase/functions/send-transactional-email/index.ts`  
**Risk:** Unexpected exceptions may leak internal details (e.g. database connection strings, query structure) to API callers.  
**Recommended fix:** Return a generic "Internal server error" message on uncaught exceptions; log full error server-side only.  
**Migration required:** No  
**Netlify config:** No  
**Edge redeploy:** Yes

---

## Low Findings

### L1 — Public error messages slightly distinguish draft vs invalid token

**Files:** `src/pages/PublicProposal.tsx`, `src/pages/PublicChangeOrder.tsx`  
**Risk:** "unavailable or has not been sent yet" vs generic error — minor enumeration signal. Contract and portal pages use better generic messaging.  
**Recommended fix:** Use a single message for all invalid token states: "This link is invalid or no longer available."  

---

### L2 — `production_rate_sources` table has no RLS

**File:** `supabase/migrations/20260625000000_production_rate_sources.sql`  
**Risk:** Reference/seed catalog data. Low risk if no sensitive rows are added, but direct PostgREST reads are unrestricted for authenticated users.  
**Recommended fix:** Add `ENABLE ROW LEVEL SECURITY` + read-only `authenticated` policy.  
**Migration required:** Yes  

---

### L3 — OAuth callback uses `window.location.origin`

**File:** `src/lib/oauthAuth.ts`  
**Risk:** Expected pattern for OAuth redirects. Verify Supabase redirect URL allowlist is limited to production domains only.  
**Recommended fix:** Audit Supabase dashboard redirect URL allowlist; remove `localhost` if present (acceptable in development project, not production).  

---

### L4 — Dev-only routes in production build gate

**File:** `src/App.tsx`  
**Risk:** None — `import.meta.env.DEV` ensures routes are tree-shaken from production builds.  
**Recommended fix:** No action required.  

---

## Confirmed Safe

- **Token generation:** Proposals, change orders, and contracts use `gen_random_uuid()`. Client portals use `crypto.randomUUID()` + 32 hex bytes — high entropy, per-resource, non-sequential.
- **Contract public signing:** Token expiry, revocation, and audit events implemented (`20260616000000_contract_token_hardening.sql`). `get_contract_by_public_token` returns only client-safe fields; invalid/expired/revoked tokens return `NULL` with a generic UI error.
- **Client portal:** No direct table reads from browser. `client-project-portal` edge function validates token + `is_active`, builds payload via `buildClientPortalSafePayload` — no cost/profit fields.
- **Employee route guard:** `/employee/*` behind `AuthGuard` + `EmployeeGuard`. Employees redirected to `/employee/dashboard` if they hit owner routes.
- **Owner route guard:** Settings, financials, accounting-tax, proposals list, proposal generator — `OwnerGuard` applied (fixed this session).
- **Client-side secrets:** No `SUPABASE_SERVICE_ROLE`, `sk-`, or `re_` keys found in `src/` or `public/`. `.env.local` exists locally, matched by `*.local` in `.gitignore` — not committed.
- **Email edge function auth:** `send-transactional-email` requires valid JWT. Validates proposal/portal/change-order ownership before sending.
- **Employee invite:** `invite-employee` requires JWT + `employer_id` ownership match.
- **AI estimate suggestions:** `suggest-estimate-activities` and `suggest-divisions-from-scope` require JWT + `can_access_project` / `employee_project_assignments` check.
- **Resend webhook:** Svix signature verification (`resend-webhook/index.ts`).
- **Service-role key isolation:** All edge functions read `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env` only; not referenced in any `src/` file.
- **Token logging:** No production logging of raw token strings found.
- **Company settings RLS:** `user_id = auth.uid()` on all operations.

---

## RLS Audit Table

| Table | RLS enabled | Owner policy | Employee policy | Public/token policy | Risk |
|---|---|---|---|---|---|
| `projects` | Yes | `user_id = auth.uid()` | `can_access_project` | None | Low |
| `proposals` | Yes | `user_id = auth.uid()` ALL | None | RPC returns full row | **High** |
| `change_orders` | Yes | `is_project_owner` ALL | `can_access_project` SELECT | RPC returns full row | **High** |
| `contract_documents` | Yes | `user_id = auth.uid()` ALL | `can_access_project` SELECT | Filtered RPC + expiry/revoke | Low |
| `estimates` | Yes | Owner CUD | `can_access_project` SELECT | None | Medium |
| `estimate_line_items` | Yes | Owner INSERT | `can_access_project` SELECT | None | Medium |
| `project_construction_activities` | Yes | Owner CUD | `can_access_project` SELECT | None | Low |
| `company_settings` | Yes | `user_id = auth.uid()` | None | None | Low |
| `company_labor_rates` | Yes | `user_id = auth.uid()` ALL | None | None | Low |
| `project_labor_rates` | Yes | Owner CUD | `can_access_project` SELECT | None | Medium |
| `employee_project_assignments` | Yes | Owner ALL | `employee_id = auth.uid()` SELECT | None | Low |
| `task_attachments` | Yes | `can_access_project` | `can_access_project` | None | Low |
| `rfi_requests` | Yes | Owner manage | `can_access_project` | None | Low |
| `field_adjustment_requests` | Yes | Owner manage | `can_access_project` | None | Low |
| `field_notifications` | Yes | `user_id = auth.uid()` | None | None | Low |
| `contract_signing_audit_events` | Yes | Owner SELECT via join | None | None | Low |
| `email_events` | Yes | Owner SELECT | None | None | Low |
| `user_legal_acceptances` | Yes | Own INSERT/SELECT | None | None | Low |
| `pilot_survey_responses` | Yes | Own INSERT/SELECT/UPDATE | None | None | Low |
| `client_portals` | Yes | `contractor_user_id = auth.uid()` | None | Edge function only (service role) | Low |
| `production_rate_sources` | **No** | — | — | Unrestricted authenticated reads | Low |

---

## Storage Bucket Audit

| Bucket | Public | Signed URLs used | Risk |
|---|---|---|---|
| `logos` | Yes | No — `getPublicUrl` | Low (intended for proposal branding) |
| `field-attachments` | **Yes** | **No** — `getPublicUrl` | **High** (jobsite photos/documents) |

---

## Edge Function Auth Summary

| Function | Auth required | Ownership check | Stack trace risk | Notes |
|---|---|---|---|---|
| `client-project-portal` | Token in body | Portal token + `is_active` | No | Service role; safe payload |
| `send-transactional-email` | Yes — JWT | Proposal/portal/CO owner match | Partial (`error.message`) | Service role from `Deno.env` |
| `invite-employee` | Yes — JWT | `employer_id = user.id` | Partial | Service role from `Deno.env` |
| `suggest-estimate-activities` | Yes — JWT | `can_access_project` | No | OpenAI from `Deno.env` |
| `suggest-divisions-from-scope` | Yes — JWT | `can_access_project` | No | — |
| `professionalize-project-scope` | Yes — JWT | Yes | No | — |
| `recommend-estimate-divisions` | Yes — JWT | Yes | No | — |
| `askConcrete` | **No** | None | No | **OpenAI abuse risk** |
| `summarize-project-scope` | **No** | None | No | OpenAI abuse risk |
| `geocode-address` | **No** | None | No | Mapbox abuse risk |
| `getWeatherForecast` | **No** | None | No | WeatherAPI abuse risk |
| `labor-crew-review` | **No** | None | No | OpenAI abuse risk |
| `batch-plant-contact` | **No** | None | No | OpenAI abuse risk |
| `batch-plant-pricing` | **No** | None | No | OpenAI abuse risk |
| `resend-webhook` | Webhook secret (Svix) | N/A | No | Correct — no user JWT |
| `create-checkout-session` | Stub/empty | — | — | Placeholder |

---

## Route Classification

| Route pattern | Classification |
|---|---|
| `/`, `/resources/*`, `/terms` | public |
| `/login`, `/signup`, `/auth/callback`, `/reset-password` | public |
| `/proposal/:token`, `/change-order/:token`, `/contract/:token` | public-token |
| `/client/project/:token`, `/invite/:token` | public-token |
| `/proposals`, `/financials`, `/accounting-tax`, `/settings`, `/proposal-generator`, `/employees`, `/owner/review` | **owner-only** ✓ |
| `/employee/*` | employee-only ✓ |
| `/planner/:id/estimate`, `/tools/contract-builder` | auth-general (see M3, M4) |
| All other authenticated routes | auth-general |
| `/dev/*` | public — DEV build only |

---

## Recommended Next Steps (priority order)

| Priority | Action | Type |
|---|---|---|
| P0 | Redact `get_proposal_by_public_token` to client-safe fields (H1) | Migration |
| P0 | Redact `get_change_order_by_public_token` and action RPC return types (H2) | Migration |
| P0 | Add JWT requirement to `askConcrete`, `geocode-address`, `getWeatherForecast`, `summarize-project-scope`, `labor-crew-review`, `batch-plant-contact`, `batch-plant-pricing` (H3) | Edge redeploy |
| P1 | Make `field-attachments` bucket private; switch to signed URLs (H4) | Migration + app |
| P1 | Fix `getPublicAppUrl` / `getPublicProposalUrl` to use `VITE_APP_URL` (M1) | App code |
| P1 | Fix `client-project-portal` to use `SITE_URL` for document links (M2) | Edge redeploy |
| P2 | Decide and apply: `OwnerGuard` on `/tools/contract-builder` (M4) | App code |
| P2 | Decide and document employee access to estimate margins (M3) | Decision / migration |
| P2 | Restrict CORS origins after auth hardening (M5) | Edge redeploy |
| P2 | Harden `send-transactional-email` exception responses (M7) | Edge redeploy |
| P3 | Tighten CSP to remove `unsafe-eval` (M6) | Netlify config |
| P3 | Add RLS to `production_rate_sources` (L2) | Migration |
| P3 | Normalise invalid-token error messages (L1) | App code |
| P3 | Audit Supabase redirect URL allowlist (L3) | Dashboard |
