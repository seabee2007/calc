# Arden Payments - Phase 2 Implementation Plan

Status: Review-only implementation plan. Do not implement code, database migrations, Edge Functions, Stripe Dashboard changes, UI changes, or secrets from this document until it is reviewed and approved.

Scope: accepted proposal to reviewed deposit invoice only.

Phase 2 flow:

```text
Existing proposal email
-> client accepts proposal
-> Arden creates immutable accepted-financial snapshot
-> contractor creates/reviews deposit request
-> Stripe sends contractor-branded invoice email
-> client pays on Stripe Hosted Invoice Page
-> webhook confirms payment
-> Arden updates deposit status and project deposit financials
```

---

## 1. Scope and Hard Boundaries

Phase 2 includes only:

- Immutable accepted-proposal financial snapshot.
- Connected-account-scoped Stripe customer map.
- Deposit-only payment schedule model with default 10%, editable/removable.
- Professional-plan server/UI gate for online collection.
- One reviewed Stripe invoice on the contractor's connected account.
- Stripe sends the invoice email using the contractor's Stripe branding.
- Hosted Invoice Page surfaced in Arden/client portal as current deposit payment status.
- Separate Connect webhook processes invoice/payment status.
- Deposit status and deposit-specific financials appear on the project financial summary.
- Strict Arden metadata filtering so outside Stripe transactions are ignored.

Phase 2 does not include:

- Progress billing.
- Final invoices.
- Change-order billing.
- Manual cash/check/wire tracking.
- Refunds or credits.
- A/R aging.
- QuickBooks exports.
- Custom contractor-branded Arden payment emails.

Do not modify:

- Existing Arden subscription checkout.
- Existing `stripe-webhook`.
- `subscriptions`.
- Proposal email delivery.
- Public proposal token behavior.
- Contracts.
- Change orders.
- Existing client portal base behavior.

---

## 2. Required Prerequisites From Phase 0/1

Phase 2 must not start until the Phase 0/1 handoff criteria in `docs/ARDEN_PAYMENTS_PHASE_0_1_IMPLEMENTATION_PLAN.md` pass in Stripe test mode:

- Company-level Stripe Connect onboarding works for a contractor company.
- `contractor_payment_accounts` exists and stores connected account state.
- `payment_webhook_events` exists and records verified Connect events idempotently.
- `payments-get-connect-status` works and updates account status from Stripe.
- `stripe-connect-webhook` exists and handles `account.updated`.
- Company owner/admin authorization is enforced in UI and Edge Functions.
- `STRIPE_CONNECT_WEBHOOK_SECRET` is configured for the separate Connect webhook.
- Existing subscription checkout, subscription webhook, billing portal, proposal email delivery, proposal acceptance, contracts, change orders, and client portal behavior remain unchanged.

---

## 3. Existing Code Paths to Preserve

### 3.1 Proposal acceptance and email compatibility

Preserve behavior in:

- `src/pages/PublicProposal.tsx`
- `src/lib/proposalTracking.ts`
- `src/lib/proposalService.ts`
- `src/lib/proposalSavePayload.ts`
- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/_shared/emailTemplates.ts`
- `supabase/migrations/20260615000001_security_hardening_rls.sql`

Phase 2 may add an accepted-snapshot side effect to `record_proposal_client_action` on first acceptance, but it must preserve:

- `status = 'accepted'`.
- `accepted_at`.
- public proposal token behavior.
- existing proposal email links.
- existing accept/decline UX.
- legacy manual `markDepositPaid()` / `markPaid()` behavior.

### 3.2 Subscription billing isolation

Do not touch:

- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/_shared/stripe.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-customer-portal-session/index.ts`
- `supabase/functions/create-usage-credit-checkout/index.ts`
- `src/services/billingService.ts`
- `src/contexts/SubscriptionContext.tsx`
- `src/services/subscriptionService.ts`
- subscription migrations

Connect invoice events must never branch into the existing subscription webhook.

---

## 4. Immutable Accepted Snapshot Plan

Add a new append-only `accepted_financial_snapshots` table.

Snapshot creation should happen inside the accepted branch of `record_proposal_client_action`, in the same accepted transition that sets `status = 'accepted'` and `accepted_at`.

Recommended implementation shape:

- Add a SECURITY DEFINER SQL function such as `capture_accepted_proposal_snapshot(p_proposal_id uuid)`.
- Call it from `record_proposal_client_action` only on the first accepted transition.
- Make it idempotent for double-click/retry safety.
- Add an update-blocking trigger patterned after `contract_document_versions` immutability in `supabase/migrations/20260614000000_contract_documents.sql`.

Snapshot fields should capture:

- company/tenant key from the Phase 0/1 canonical ownership decision.
- project reference.
- client reference.
- proposal ID.
- proposal revision/version reference.
- accepted amount.
- accepted line items.
- exclusions.
- allowances.
- taxes, if applicable.
- accepted date/action reference.
- source IDs.
- checksum.
- `source_type = 'proposal'`.
- `created_at`.

Invoices must read from `accepted_financial_snapshots`, never from live `proposals.data`, `computeProposalFinancials`, or editable estimate state after acceptance.

---

## 5. Accepted Snapshot Versioning and Re-Acceptance Rule

The first accepted snapshot is immutable and must never be changed.

Explicit behavior for proposal revision, reopen, or re-acceptance:

- A sent, paid, voided, or otherwise finalized project invoice always remains attached to its exact `accepted_financial_snapshot_id`.
- No live proposal edit, estimate revision, allowance change, or later change order may mutate a prior accepted snapshot.
- If Arden permits a proposal to be revised and accepted again, create a new successor snapshot rather than replacing the original.
- The successor snapshot must record:
  - predecessor snapshot ID;
  - proposal revision/version reference;
  - accepted action/timestamp reference;
  - checksum;
  - reason for supersession.
- A new deposit invoice may only be created from the explicitly selected eligible snapshot.
- A prior deposit invoice must not be silently recalculated from a successor snapshot.

Recommended schema additions:

- `predecessor_snapshot_id` nullable.
- `proposal_revision_ref`.
- `accepted_action_ref`.
- `supersession_reason` nullable.
- `snapshot_status` (`active`, `superseded`) if needed for explicit selection UX.

---

## 6. Deposit-Only Payment Schedule Plan

Add `project_payment_schedules` for Phase 2 deposit only.

Phase 2 schedule behavior:

- Default deposit is 10%.
- Contractor may edit or remove the deposit schedule before invoice creation.
- No automatic charge, invoice, email, or Stripe object is created on proposal acceptance.
- Progress/final/change-order schedules are not implemented in Phase 2.

Suggested fields:

- project ID.
- proposal ID.
- accepted snapshot ID.
- `schedule_type = 'deposit'`.
- sequence.
- label.
- amount type (`fixed` or `percentage`).
- amount.
- percentage.
- status (`planned`, `invoiced`, `paid`, `void`).
- created by.
- timestamps.

Guardrail:

- A deposit schedule item cannot have more than one non-void open Stripe invoice.

---

## 7. Connected-Account Customer Map

Add `contractor_payment_customers`.

Stripe Customers for direct-charge invoices are scoped to the contractor's connected Stripe account. Do not store one global `stripe_customer_id` on the client record.

Required columns:

- company/tenant key.
- client ID.
- `stripe_connected_account_id`.
- `stripe_customer_id`.
- `livemode`.
- `email_at_creation`.
- `created_at`.
- `archived_at` nullable.

Unique key:

```text
(company_id, client_id, stripe_connected_account_id, livemode)
```

Use the canonical company/tenant key chosen in Phase 0/1. If that key is not named `company_id`, adapt the unique key accordingly while preserving the same ownership semantics.

---

## 8. Deposit Invoice Ledger Plan

Add deposit-only invoice tables:

- `project_invoices`
- `project_invoice_line_items`
- `project_payments`

### 8.1 `project_invoices`

Required concepts:

- project ID.
- proposal ID.
- accepted snapshot ID.
- payment schedule ID.
- connected account ID.
- contractor payment customer ID.
- Stripe customer ID.
- Stripe invoice ID.
- Hosted Invoice Page URL (not treated as permanent; refresh from Stripe state).
- currency.
- subtotal.
- tax.
- total.
- amount paid.
- deposit remaining.
- status.
- `stripe_livemode`.
- immutable snapshot JSON.
- required Stripe sync fields.

Deposit invoice status state machine:

```text
draft
-> open / sent
-> processing
-> paid
-> partially_paid
-> void
-> uncollectible
-> refunded
-> disputed
```

Phase 2 should normally produce a single deposit invoice, but the state model should be compatible with asynchronous card/ACH processing.

### 8.2 `project_invoice_line_items`

Line-level audit records for the deposit invoice, sourced from the accepted snapshot.

Phase 2 can use a simple deposit line, but it should retain a source reference to the snapshot.

### 8.3 `project_payments`

Webhook-authored Stripe payment records only in Phase 2.

Do not implement manual cash/check/wire records in Phase 2.

ACH/card payment completion must come from webhook events, not browser redirects.

---

## 9. Deposit-Only Financial Display Rule

Phase 2 invoices only the deposit. Do not label the full accepted contract amount as currently due.

For Phase 2, project financial UI must distinguish:

```text
Accepted Contract Total
Deposit Required
Deposit Paid
Deposit Remaining
Remaining Contract Value - Not Yet Invoiced
```

`Deposit Remaining` is the only amount labeled as currently due in the Phase 2 deposit workflow.

Do not imply that the full remaining contract value is payable until later phases create progress/final invoices.

Suggested touchpoint:

- `src/pages/Projects/ProjectDetails.tsx` project financial summary.

Any dashboard/client portal language should follow the same deposit-specific naming.

---

## 10. Stripe Invoice Creation and Delivery Plan

Phase 2 invoice path:

```text
Accepted proposal snapshot
-> deposit schedule item
-> Arden project invoice
-> Stripe Customer on connected account
-> Stripe invoice + invoice items
-> finalize/send through Stripe
-> contractor-branded Hosted Invoice Page
```

Requirements:

- Use platform Stripe secret with `Stripe-Account` context.
- Customer must exist on the contractor connected account.
- Create invoice/invoice items on the connected account.
- Include required Arden metadata:
  - `arden_company_id`
  - `arden_project_id`
  - `arden_project_invoice_id`
  - `arden_financial_snapshot_id`
  - `arden_source = arden_project_os`
- Stripe sends the invoice email directly using contractor account branding.
- Hosted Invoice Page URL is refreshed from Stripe invoice state and is not treated as permanent.
- No custom contractor-branded Arden/Resend invoice email infrastructure in Phase 2.

---

## 11. Stripe Invoice Reconciliation and Recovery

Creating an Arden invoice and creating its Stripe invoice is a distributed operation. Add a recovery model that prevents duplicate invoices.

Add to `project_invoices`:

```ts
stripe_sync_status:
  | 'not_started'
  | 'creating'
  | 'created'
  | 'send_pending'
  | 'sent'
  | 'sync_failed';

last_stripe_sync_error: string | null;
stripe_sync_attempted_at: string | null;
```

Rules:

1. Create the Arden project invoice row first with `stripe_sync_status = 'creating'`.
2. Use the Arden `project_invoices.id` as the Stripe idempotency key for invoice creation.
3. Include the Arden invoice ID in Stripe metadata.
4. Before retrying Stripe creation, search/reconcile using:
   - connected account ID;
   - `arden_project_invoice_id`;
   - livemode;
   - Stripe invoice metadata.
5. Reuse the matching Stripe invoice when one already exists.
6. Mark `sync_failed` with a safe internal error summary when recovery fails.
7. Never create a second open Stripe invoice for the same Arden project invoice or payment schedule item.
8. Sending an invoice must be a separate idempotent action from creating it.
9. The contractor must see a clear retry/review state, never a misleading `sent` state.

Add tests for:

- retry after Stripe API timeout;
- retry after internal database write succeeds but Stripe call fails;
- Stripe invoice successfully created but response lost before Arden persistence;
- no duplicate Stripe invoice after retry;
- no duplicate open invoice for the same deposit schedule item.

---

## 12. Edge Function Plan

### 12.1 `payments-create-client-customer`

Responsibilities:

- Authenticated company owner/admin.
- Professional plan / `payments_online` gate.
- Validate project/client ownership.
- Create or reuse customer on contractor connected account.
- Persist `contractor_payment_customers`.

### 12.2 `payments-create-project-invoice`

Responsibilities:

- Authenticated company owner/admin.
- Professional plan / `payments_online` gate.
- Read accepted snapshot and deposit schedule only.
- Refuse live proposal/estimate data as invoice source.
- Create internal `project_invoices` row first.
- Create Stripe invoice/invoice items with idempotency and Arden metadata.
- Persist Stripe invoice ID and sync status.
- Leave invoice in a reviewable or ready-to-send state.

### 12.3 `payments-send-project-invoice`

Responsibilities:

- Authenticated company owner/admin.
- Professional plan / `payments_online` gate.
- Finalize/send the existing Stripe invoice.
- Let Stripe send the invoice email.
- Refresh Hosted Invoice Page URL.
- Idempotent resend/retry behavior; do not create a new invoice.

### 12.4 `stripe-connect-webhook`

Extend Phase 1 handler for deposit invoice/payment events.

Required security sequence:

```text
Verify Stripe signature
-> record idempotent verified event receipt
-> confirm connected account + livemode + Arden metadata
-> process invoice/payment event
-> update project invoice/payment state
-> mark event processed or failed
```

Ignore unrelated Stripe activity:

- Missing `arden_source = arden_project_os`.
- Missing/mismatched `arden_project_invoice_id`.
- Connected account mismatch.
- Livemode mismatch.
- No matching Arden invoice/snapshot.

---

## 13. Webhook Event and Payment-State Plan

Handle at least:

- `invoice.finalized`
- `invoice.sent`
- `invoice.paid`
- `invoice.payment_succeeded` if emitted/available in the chosen event set
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.voided`
- `invoice.marked_uncollectible`

Rules:

- Browser redirects never mark paid.
- ACH may enter `processing`; do not mark paid until authoritative webhook confirmation.
- Test/live records are separated by `stripe_livemode`.
- Non-Arden Stripe transactions are recorded as ignored at most; they never mutate project financials.

---

## 14. UI Touchpoints

### 14.1 Contractor review/send flow

Potential files:

- `src/pages/Projects/ProjectDetails.tsx`
- `src/pages/Projects/ProjectProposalsPage.tsx`
- `src/utils/projectProposalNextAction.ts`
- `src/services/paymentsService.ts`

Required UX:

- Accepted proposal shows deposit request option when contractor is Professional and Stripe account is enabled.
- Contractor reviews deposit amount before invoice creation.
- Default deposit is 10%.
- Deposit is editable/removable before invoice creation.
- Sending uses Stripe invoice email.
- Clear retry/review state if Stripe sync fails.

### 14.2 Project financial summary

Display deposit-only labels:

- Accepted Contract Total.
- Deposit Required.
- Deposit Paid.
- Deposit Remaining.
- Remaining Contract Value - Not Yet Invoiced.

### 14.3 Client portal

Potential files:

- `supabase/functions/client-project-portal/index.ts`
- `supabase/functions/_shared/clientPortalBuilder.ts`
- `src/pages/ClientPortal.tsx`

Client portal may show:

- deposit status;
- current Hosted Invoice Page link for matching Arden-created deposit invoice;
- paid/processing state after webhook updates.

It must not show unrelated Stripe invoices or generic project payment links.

---

## 15. Entitlement and Authorization Plan

Add `payments_online` to the existing entitlement model.

Recommended Phase 2 gate:

- Starter: no online collection.
- Professional: deposit invoice online collection.
- Business: no extra Phase 2 behavior yet.

Enforcement:

- UI gate for deposit invoice creation/review/send.
- Edge Function gate in `payments-create-client-customer`, `payments-create-project-invoice`, and `payments-send-project-invoice`.
- Company owner/admin authorization required for create/send/void in Phase 2.
- Client access is limited to Stripe Hosted Invoice Page and safe client portal payload.

Do not add Phase 3+ gates in Phase 2 unless needed as inert definitions.

---

## 16. Tests and Acceptance Criteria

Test plan:

- Snapshot created once on first proposal acceptance.
- Original accepted snapshot is immutable.
- Reaccepted proposal revision creates successor snapshot.
- Prior invoice remains attached to original snapshot after successor snapshot.
- Invoice amount reads snapshot, not live proposal data.
- Default deposit is 10%, editable/removable before invoice creation.
- Professional gate enforced in UI and Edge Functions.
- Connected-account customer uniqueness by company/client/connected account/livemode.
- Stripe invoice creation uses Arden invoice ID idempotency key.
- Recovery after Stripe API timeout.
- Recovery after DB write succeeds but Stripe call fails.
- Recovery after Stripe invoice created but response lost before Arden persistence.
- No duplicate Stripe invoice after retry.
- No duplicate open invoice for same deposit schedule item.
- Webhook ignores non-Arden events.
- Webhook updates deposit paid/processing/failure from authoritative events.
- Test/live separation.
- Hosted Invoice Page URL refreshed from Stripe state.
- Project financial summary uses deposit-only labels.
- Client portal exposes only matching Arden-created deposit invoice.
- Subscription checkout/webhook regression.
- Proposal email/public proposal accept regression.
- Contracts/change orders/client portal base regression.

Phase 2 acceptance test:

1. Professional contractor connects Stripe in test mode.
2. Sends and has a proposal accepted through the current Arden process.
3. Accepted snapshot is created once.
4. Contractor creates/reviews deposit invoice from selected snapshot.
5. Stripe emails the client.
6. Client completes test card or ACH payment.
7. Project shows Deposit Paid / Deposit Remaining correctly.
8. Client portal shows the current deposit payment status.
9. No subscription, proposal-email, or client-portal regression.

---

## 17. Rollback Plan

If Phase 2 must be disabled:

- Hide deposit invoice creation UI.
- Disable `payments-create-client-customer`, `payments-create-project-invoice`, and `payments-send-project-invoice`.
- Keep `stripe-connect-webhook` account status sync from Phase 1 if already live.
- Leave additive ledger tables in place.
- Do not drop snapshots during emergency rollback.
- Existing proposal accept flow should continue; snapshot side effect can be disabled only if it preserves acceptance behavior.
- Existing subscription/proposal/contract/change-order/client portal flows continue unchanged.

---

## Phase 3 Prerequisites

Do not begin progress/final/change-order billing or manual payment tracking until:

- Deposit invoice loop is stable in Stripe test mode.
- Snapshot versioning and re-acceptance behavior are proven.
- Stripe invoice reconciliation prevents duplicates after failures/retries.
- Webhook idempotency and Arden metadata filtering are proven.
- ACH processing behavior is verified.
- Project financial and client portal deposit status are correct.
- Duplicate invoice and stale Hosted Invoice URL behavior are handled.
- Existing subscription/proposal workflows remain green.

Phase 3 scope begins only after this: progress invoices, final invoices, approved change-order billing, and manual payment tracking.
