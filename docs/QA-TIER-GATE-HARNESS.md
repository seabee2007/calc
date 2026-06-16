# Tier Gate QA Harness

Dev/staging-only tooling to seed subscription tiers, dummy projects, and run headed Playwright checks against Arden Project OS entitlement gates.

**Do not run against production** unless you explicitly set `ALLOW_QA_SEED_PRODUCTION=true` and understand the risk.

## Prerequisites

1. Local Supabase project or staging environment
2. App running at `http://localhost:5173` (`npm run dev`)
3. `VITE_ENFORCE_PLAN=true` in `.env.local` so tier limits apply locally
4. Service role key available to Node scripts only

## Environment variables

Add to `.env.local` (never commit real keys):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_ENFORCE_PLAN=true
APP_URL=http://localhost:5173
QA_TEST_PASSWORD=Password123!
```

QA Node scripts load `.env.local` then `.env` automatically via `scripts/qa/shared/loadQaEnv.ts`. Use **`SUPABASE_SERVICE_ROLE_KEY` only** — never prefix the service role key with `VITE_` (browser-exposed vars are blocked).

Optional safety override (discouraged):

```env
ALLOW_QA_SEED_PRODUCTION=true
```

## Seeded users

| Email | Tier simulation |
| --- | --- |
| `qa-free@arden.test` | No subscription row → Free |
| `qa-starter@arden.test` | Active Starter subscription |
| `qa-professional@arden.test` | Active Professional + field data |
| `qa-business@arden.test` | Active Business + export data |
| `qa-pastdue@arden.test` | Professional / past_due |
| `qa-canceled@arden.test` | Professional / canceled |

Default password: `QA_TEST_PASSWORD` (default `Password123!`)

Manifest written to `scripts/qa/.qa-manifest.json` (gitignored) for safe cleanup.

## Workflow

```powershell
npm run dev                   # terminal 1 — required
npm run qa:cleanup-gates      # optional reset
npm run qa:seed-gates         # create QA users + data
npm run qa:e2e-gates          # auth setup (once per tier) + gate tests + report
```

Or one command:

```powershell
npm run qa:gates
```

**Auth sessions** are saved to `tests/e2e/.auth/{free,starter,professional,business,pastdue,canceled}.json` and reused — you log in **once per tier**, not once per test.

Verbose logging: `$env:QA_VERBOSE='true'; npm run qa:e2e-gates`  
Playwright inspector: `npm run qa:e2e-gates:debug`  
Force re-login: `$env:QA_REFRESH_AUTH='true'; npm run qa:e2e-gates`

If automated login fails during setup, the terminal prints:

```text
Manual step required: Sign in as qa-free@arden.test / Password123!, wait for Dashboard, then press Enter in this terminal.
```

Reports:

- `qa-reports/tier-gates/latest.json` — Playwright JSON
- `qa-reports/tier-gates/latest.md` — human-readable pass/fail table
- Screenshots/traces on failure under `qa-reports/tier-gates/test-results/`

## What gets checked (per tier)

1. Profile plan badge
2. Billing current plan + status
3. Active project count vs tier limit
4. New Project allowed/blocked at limit
5. Employee invite gate
6. Client portal gate on project details
7. Detailed estimate gate in estimate workspace
8. Logic Network gate
9. Accounting & Tax export gate

## Safety rules

Seed/cleanup scripts refuse to run when:

- `NODE_ENV=production`
- Supabase URL looks like production and `ALLOW_QA_SEED_PRODUCTION` is not set
- Service role key is missing

Cleanup deletes **only** users listed in the QA manifest (or matching configured QA emails) and their related rows.

## Manual steps

Most checks are automated. For Stripe checkout verification (optional, separate from tier seeding), use `tests/e2e/helpers/manualStep.ts` in a headed run:

```ts
await manualStep('Click Upgrade and confirm Stripe Checkout opens. Do not pay. Press Enter after verifying.');
```

## Files

| File | Purpose |
| --- | --- |
| `scripts/qa/seed-tier-gate-data.ts` | Creates QA users + dummy data |
| `scripts/qa/cleanup-tier-gate-data.ts` | Removes seeded QA data |
| `scripts/qa/run-tier-gate-checks.ts` | Converts Playwright JSON → Markdown report |
| `tests/e2e/auth.setup.ts` | Logs in each QA user once; saves `tests/e2e/.auth/*.json` |
| `tests/e2e/tier-gates.spec.ts` | Headed tier gate test runner (reuses storageState) |
| `tests/e2e/helpers/auth.ts` | Login, app-ready waits, selector diagnostics |
| `tests/e2e/helpers/qaLog.ts` | `[QA]` step logs + `QA_VERBOSE` detail |
| `playwright.config.ts` | Playwright config |

## Troubleshooting

- **Seed blocked**: Confirm `APP_URL` is localhost or set explicit production override.
- **Runner appears frozen**: Check terminal for `[QA]` step logs. Enable `$env:QA_VERBOSE='true'`.
- **APP_URL missing**: Set `APP_URL=http://localhost:5173` in `.env.local` (required — not `VITE_APP_URL` alone).
- **App not reachable**: Global setup fails with `Start npm run dev in another terminal.`
- **Blank / about:blank page**: Runner logs URL + title, prints browser console/page errors, and saves a screenshot under `qa-reports/tier-gates/screenshots/`.
- **Missing storage state**: Run `npm run qa:e2e-gates` (setup project runs first) or delete `tests/e2e/.auth/` and re-run.
- **Onboarding/legal gate**: Re-run `npm run qa:seed-gates` — seeded users should skip both gates.
- **All plans show Free**: Confirm `VITE_ENFORCE_PLAN=true` and subscription rows were seeded.
- **Missing tables logged as Skipped**: Optional tables are skipped gracefully; core tables must exist.
