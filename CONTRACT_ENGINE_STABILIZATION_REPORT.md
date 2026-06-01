# Contract Engine Stabilization Report (Phase A)

**Date:** 2026-06-01  
**Scope:** Phase A — Stabilization Sprint  
**Build:** `npm run build` — **PASS**

---

## Summary

Phase A decomposed the Contract Builder UI, integrated it with Planner/Tools project flows, introduced explicit registries for document configuration, hardened the public signing token lifecycle, and aligned styling with existing field-tool patterns. Residential contract behavior remains the default runtime path; no new document types were added.

---

## 1. UI Decomposition

**What changed**

- Refactored `DocumentBuilderPage.tsx` into focused presentation panels under `src/features/documents/ui/panels/`:
  - `DocumentMetaPanel` — title, project, save/load, saved-doc list
  - `IntakePanel` — pack, mode, grouped questionnaire fields
  - `SignaturePanel` — contractor counter-sign, send, copy link
  - `CompliancePanel` — risk score, recommendations, compliance issues
  - `ExportPanel` — PDF/manifest export + export policy
  - `VersionHistoryPanel` — immutable version browsing
  - `PreviewPanel` — read-only contract preview
- Shared UI constants moved to `contractBuilderConstants.ts`.
- Orchestration (state, engine calls, handlers) remains in `DocumentBuilderPage.tsx`.

**Architectural decision:** Behavior-preserving extraction first — panels receive props and callbacks only; no engine logic in React components.

---

## 2. Project / Planner / Tools Integration

**What changed**

- `ToolsModal.tsx`: `/tools/contract-builder` added to `pathsWithProject` so active project is forwarded via `?project=`.
- `plannerRoutes.ts`:
  - Added `contractBuilderToolHref(projectId, documentId?)`
  - Extended `plannerDocumentsHref` with `contract` highlight param
  - Added `contract` to `PROJECT_ENTITY_QUERY_KEYS`
- `PlannerDocumentsPage.tsx`: new **Contracts** section listing project-scoped saved contracts with deep links to the builder.
- `DocumentBuilderPage.tsx`: hydrates from `?project=` and `?id=` query params; project-scoped saved-doc listing via `listContractDocuments(projectId)`.

**Integration points**

| From | To | Mechanism |
|------|----|-----------|
| Tools modal | Contract Builder | `/tools/contract-builder?project={id}` |
| Planner Documents | Contract Builder | `/tools/contract-builder?project={id}&id={docId}` |
| Field tool layout | Planner Documents | Back link when `?project=` present |

---

## 3. Registry Layer

**What changed**

New `src/features/documents/registry/` modules:

| Module | Responsibility |
|--------|----------------|
| `documentTypeRegistry` | Supported types, default pack/template keys |
| `questionnaireRegistry` | Question banks per document type |
| `templateRegistry` | Template lookup by key and type |
| `complianceRegistry` | Required clause keys, validation mode |
| `riskRegistry` | Declarative + derived risk rules |

**Engine wiring (backward-compatible signatures)**

- `questionnaireEngine.ts` → reads questions from `questionnaireRegistry`
- `complianceEngine.ts` → reads profiles from `complianceRegistry`
- `riskEngine.ts` → declarative signals + `evaluateDerivedRisk()` from `riskRegistry`
- Public exports added to `src/features/documents/index.ts`

**Architectural decision:** Registries wrap existing residential constants; residential behavior unchanged.

---

## 4. Public Token Hardening

**Migration:** `supabase/migrations/20260616000000_contract_token_hardening.sql`

**Schema additions**

- `contract_documents.public_token_expires_at` (nullable — backward compatible)
- `contract_documents.public_token_revoked_at`
- `contract_signing_audit_events` — append-only audit table (sent/viewed/signed/declined/revoked)

**RPC updates**

- `is_public_contract_token_valid()` — checks status, revocation, expiry
- `get_contract_by_public_token` — returns null for invalid/expired/revoked tokens
- `record_contract_client_action` — enforces validity + writes audit events
- **New** `send_contract_for_signature` — owner RPC with invariants, 90-day default expiry, audit
- **New** `revoke_contract_public_token` — owner RPC to revoke active links

**Service / UI updates**

- `contractDocumentService.ts`: `sendContractForSignature` now uses RPC; added `revokeContractPublicToken`
- `contractDocumentTypes.ts`: expiry/revocation fields on row types
- `PublicContractPage.tsx`: clearer unavailable/expired/revoked messaging; expiry display
- Client portal (`client-project-portal/index.ts`, `clientPortalBuilder.ts`): filters revoked/expired contract links

**User action required:** Run `supabase db push` and redeploy `client-project-portal` edge function.

---

## 5. Styling Alignment

**What changed**

- `DocumentBuilderPage` wrapped in `FieldToolPageLayout` (shared field-tool shell, project selector, back-to-documents link).
- `PublicContractPage` aligned with `appTheme` tokens (`APP_SECTION_CARD`, `TEXT_FOREGROUND`, `TEXT_BODY`, `TEXT_MUTED`, `CC_PAGE_HERO_TITLE`).
- Panel cards use `APP_SECTION_CARD` and shared severity/risk styling from `contractBuilderConstants.ts`.

---

## 6. Build Validation

```
npm run build — PASS (17.6s)
DocumentBuilderPage chunk: ~94 KB (gzip ~26 KB)
PublicContractPage chunk: ~5.8 KB (gzip ~2.1 KB)
```

No new build errors introduced by this sprint.

---

## Caveats & Follow-ups

1. **Migration not applied automatically** — token hardening requires `supabase db push` in your environment.
2. **Revoke UI not exposed** — `revokeContractPublicToken` service exists; builder UI for revocation can be added in a future sprint.
3. **Manifest PII on public RPC** — unchanged from Phase 6.2; public read still returns full manifest in the frozen version payload (audit recommendation remains open).
4. **Recommendation accept/reject** — still cosmetic for base clauses; recorded in manifest only.
5. **Empty template barrels** — proposals, RFIs, etc. remain `[]`; registries are ready for future document types.

---

## Files Touched (high level)

- `src/features/documents/ui/` — page refactor + 7 panel files + constants
- `src/features/documents/registry/` — 6 new registry modules
- `src/features/documents/engine/` — questionnaire, compliance, risk engines
- `src/features/documents/services/` — contract service + types
- `src/pages/planner/PlannerDocumentsPage.tsx`
- `src/utils/plannerRoutes.ts`
- `src/components/workflow/ToolsModal.tsx`
- `supabase/migrations/20260616000000_contract_token_hardening.sql`
- `supabase/functions/client-project-portal/` + `_shared/clientPortalBuilder.ts`

---

## Verdict

Phase A stabilization objectives are complete. The Contract Builder is decomposed, project-aware, registry-backed, and token lifecycle is hardened at the database layer. Residential draft-only behavior is preserved.
