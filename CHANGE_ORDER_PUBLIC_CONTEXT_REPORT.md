# Change Order Public Page Context Improvement Report

## Files Changed

- `supabase/migrations/20260617000000_change_order_public_context.sql` (new)
- `src/lib/changeOrderTracking.ts`
- `src/utils/changeOrderDocumentContext.ts`
- `src/pages/PublicChangeOrder.tsx`

## What Changed

### Supabase RPC (`get_change_order_by_public_token`)

The function now returns **jsonb** instead of a bare `change_orders` row:

```json
{
  "change_order": { ...full change order row... },
  "project": { name, jobsite_*, client_info, base_contract_value, approved_change_order_total, current_contract_value } | null,
  "company": { company_name, address, phone, email, license_number, logo_url } | null
}
```

- Still **SECURITY DEFINER** — anon clients do not get broad table access.
- Only non-draft, non-void change orders are returned (unchanged rule).
- Company is resolved from project owner `user_id`, falling back to change order `user_id`.
- **No table schema changes** — function-only migration.

### Client parsing and fallbacks

- `fetchChangeOrderPublicBundle()` loads and parses the RPC response.
- `parseChangeOrderPublicBundle()` supports:
  - **New** jsonb bundle shape (project + company included).
  - **Legacy** flat `change_orders` row if the migration is not deployed yet (`project` and `company` are `null`).
- `buildChangeOrderDocumentContextFromPublic()` maps the bundle into `ChangeOrderDocumentContext` for the shared document renderer.

### Public page (`PublicChangeOrder.tsx`)

- Uses `fetchChangeOrderPublicBundle` and passes `audience="client"` with `context` into `ChangeOrderDocument`.
- Accept/decline/open flows unchanged; bundle `order` is updated after RPC actions while project/company snapshot is retained.

## Public Page Now Shows (when RPC + data available)

| Section | Source |
|--------|--------|
| Company name, phone, email, address, license, logo | `company_settings` via RPC |
| Project name, address, client | `projects` + `client_info` via RPC |
| Total change order price | `order.total` (client pricing summary only) |
| Contract value summary | Project financial fields + this CO total |

## Client-Safe Guarantees (unchanged)

- `audience="client"` on `ChangeOrderDocument` — **total price only** in pricing summary.
- No line-item internal breakdown, overhead, profit, margin, or markup on the public page.
- Signing RPCs (`record_change_order_client_action`) were **not** modified.

## Pricing / Workflow

- `changeOrderFinancials.ts` — **not modified**.
- Save/send flows — **not modified**.
- Signing behavior — **not modified**.

## Deployment Note

Apply migration `20260617000000_change_order_public_context.sql` in Supabase for full project/company context on public links. Until then, the app falls back to the legacy flat row parser and still renders using contractor name and generic labels.

## Data Missing / Fallback Behavior

| Field | If missing |
|-------|------------|
| Company block | Contractor name from change order; empty phone/email/address |
| Project name | Label **Project** |
| Project address | **—** |
| Client name | **—** (unless `client_info` on project) |
| Company logo | Hidden |
| `base_contract_value` | **Original contract amount not provided.** |
| Revised contract | **—** unless `current_contract_value` can be used |
| Project row (deleted) | `project: null` — document still loads |
| Company settings row | `company: null` — contractor name fallback |

Internal pricing fields remain on the `ChangeOrder` object in memory for mapping but are **not rendered** in client audience mode.

## Validation

- Lint: no issues on changed TypeScript files.
- `npm run build`: succeeded.
