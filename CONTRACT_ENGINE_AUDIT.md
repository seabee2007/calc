# CONTRACT_ENGINE_AUDIT

## SECTION 1
## IMPLEMENTATION SCORECARD

Audit basis: roadmap phases requested by product direction and implemented code under [`c:/Users/Admin/Desktop/calc/calc/src/features/documents`](c:/Users/Admin/Desktop/calc/calc/src/features/documents), routing in [`c:/Users/Admin/Desktop/calc/calc/src/App.tsx`](c:/Users/Admin/Desktop/calc/calc/src/App.tsx), and DB migrations in [`c:/Users/Admin/Desktop/calc/calc/supabase/migrations`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations).

| Phase | Score | Status | Why |
|---|---:|---|---|
| Phase 0 - Legal Guardrails | 90% | Complete | Draft-only legal posture is enforced in both type and runtime layers: `DRAFT_DISCLAIMER` and pack legal metadata in [`types.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/types.ts), final export gating in [`complianceEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/complianceEngine.ts). Minor gap: safeguards are mostly policy-level, not fully DB-enforced for all signature/send transitions. |
| Phase 0.1 - Architecture Foundation | 92% | Complete | Required folder architecture and pure TS engine boundaries exist and are active (`engine/`, `packs/`, `templates/`, `ui/`, `types.ts`). Gap: stale barrel comment in [`index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/index.ts) still says no UI/Supabase/PDF wiring. |
| Phase 0.5 - Generic Residential Pack | 95% | Complete | Generic nationwide draft pack implemented with `GENERIC_RESIDENTIAL` and defaulted in builder via [`genericResidential/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/genericResidential/index.ts), [`registry.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/registry.ts), [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx). |
| Phase 1 - Domain Model + Template Library | 86% | Partial | Core models are strong and extensible (`DocumentType`, `DocumentManifest`, `DocumentClause`, `DocumentAddendum`). Residential template coverage is high; however non-residential template barrels are still empty arrays in files like [`templates/proposals/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates/proposals/index.ts), [`templates/changeOrders/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates/changeOrders/index.ts), [`templates/rfis/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates/rfis/index.ts). |
| Phase 1.5 - Questionnaire Engine | 88% | Complete | Dynamic mode-based questionnaire engine and visibility/required rules are implemented in [`questionnaireEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaireEngine.ts) and [`residentialQuestions.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaire/residentialQuestions.ts). Gap: only `residential_contract` question bank is wired. |
| Phase 2 - Assembly Engine + Compliance | 84% | Partial | Deterministic assembly and compliance are in place (`selectClauses`, `selectAddenda`, `buildManifest`, `evaluateDocumentCompliance`, `evaluateExportPolicy`). Gap: compliance required-clause logic is residential-specific (`REQUIRED_CLAUSE_KEYS` in [`complianceEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/complianceEngine.ts)), and some recommendation acceptance states do not fully control clause inclusion. |
| Phase 3 - UI + Preview + Export | 87% | Complete | Builder UI, preview, PDF export, route wiring, and manifest download are implemented in [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx), [`contractPdf.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractPdf.ts), [`App.tsx`](c:/Users/Admin/Desktop/calc/calc/src/App.tsx), [`lazyPages.tsx`](c:/Users/Admin/Desktop/calc/calc/src/routes/lazyPages.tsx). Gaps are UX/accessibility polish and monolithic component size. |
| Phase 4 - Construction-Specific Modules | 90% | Complete | Concrete differentiators are implemented and tested (`addendum.concrete`, cracking, ready-mix, spec sheet, acceptance, maintenance) in [`packs/concrete/addendums.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/concrete/addendums.ts), with scenario coverage in [`goldenScenarios.test.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/goldenScenarios.test.ts). |
| Phase 5 - State Packs | 88% | Complete | CA/FL/NY locked notices and TX/GA/GU draft warnings exist via composable state packs in [`packs/statePacks/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/statePacks/index.ts). Remaining legal risk is expected: attorney-reviewed final exports are still blocked. |
| Phase 6 - Persistence + Signatures | 81% | Partial | 6.1 and 6.2 are materially implemented: immutable version table + RPC save flow and public token signing flows in migrations [`20260614000000_contract_documents.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260614000000_contract_documents.sql), [`20260615000000_contract_public_signing.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260615000000_contract_public_signing.sql), service/UI wiring in [`contractDocumentService.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/services/contractDocumentService.ts), [`PublicContractPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/PublicContractPage.tsx). Security/data-governance gaps remain (public manifest payload breadth, DB-level send/sign integrity checks). |
| Phase 7 - Testing + Release Readiness | 83% | Partial | Engine and helper tests are strong (8 test files under [`src/features/documents`](c:/Users/Admin/Desktop/calc/calc/src/features/documents)); build has passed in prior implementation cycle. Missing: focused UI/signing integration tests, migration-level verification scripts, and release hardening checklist for security edge cases. |

---

## SECTION 2
## ARCHITECTURE REVIEW

### Does implementation follow planned architecture?
Mostly yes. The structure under [`src/features/documents`](c:/Users/Admin/Desktop/calc/calc/src/features/documents) follows the planned boundaries:
- Pure engine logic in [`engine`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine)
- Packs in [`packs`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs)
- Template catalogs in [`templates`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates)
- UI in [`ui`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui)
- Types in [`types.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/types.ts)

### Are responsibilities properly separated?
- **Yes (core):** assembly/compliance/questionnaire/rendering are isolated into dedicated engine modules.
- **Partially (UI):** [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx) is now a large orchestration component handling intake, rendering, persistence, versioning, and signing.

### Is business logic inside React components?
- **Mostly no** for core contract logic.
- **Some orchestration yes:** save/send/version/signing flow orchestration and status transitions sit in UI handlers in [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx).

### Is document assembly isolated?
Yes. [`documentAssembly.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/documentAssembly.ts) is pure TS and deterministic.

### Is compliance logic isolated?
Yes. [`complianceEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/complianceEngine.ts).

### Is questionnaire logic isolated?
Yes. [`questionnaireEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaireEngine.ts) + [`questionnaire/residentialQuestions.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaire/residentialQuestions.ts).

### Are templates properly separated from rendering?
Yes. Template content lives in packs/templates files; rendering lives in [`templateRenderer.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/templateRenderer.ts).

### GOOD ARCHITECTURE
- Pure deterministic engine functions (easy to test and reason about).
- Manifest generation delegated through assembly for consistency in [`documentManifest.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/documentManifest.ts).
- State pack composition reuses generic clauses and appends notices in [`packs/statePacks/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/statePacks/index.ts).
- DB-free snapshot helpers in [`ui/contractVersionState.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractVersionState.ts).

### QUESTIONABLE ARCHITECTURE
- Stale barrel documentation in [`index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/index.ts) no longer reflects reality.
- Service-layer type imports from UI (`SaveContractVersionPayload` in [`contractDocumentService.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/services/contractDocumentService.ts)) invert layering.
- Runtime UI imports from barrel (`from '../index'`) in [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx) increases coupling.

### TECHNICAL DEBT
- `DocumentBuilderPage` is a god component.
- Empty non-contract template catalogs exported publicly (false readiness signal).
- Pack registry is not document-type aware (pack key only).

### RISK AREAS
- Future multi-document expansion currently blocked by single active question bank and residential-only input mapper.
- Signing flow integrity depends heavily on app logic and owner RLS updates rather than stricter DB state-transition controls.

---

## SECTION 3
## CONTRACT ENGINE REVIEW

### Can it realistically support future document types today?

| Target doc type | Current realistic support | Notes |
|---|---|---|
| Residential Contracts | Yes | Fully supported end-to-end. |
| Commercial Contracts | No (schema/type only) | `DocumentType` includes `commercial_contract` but no active pack/template/question bank pipeline. |
| Government Contracts | No | No gov-specific pack/model/rules. |
| Change Orders | Partial (outside engine) | Existing app has mature separate change-order system; document engine template barrel is empty. |
| RFIs | Partial (outside engine) | Planner RFI workflows exist outside this engine. |
| Submittals | Not yet | Template placeholder only. |
| Daily Reports | Not yet | Template placeholder only. |
| Safety Forms | Partial (outside engine) | Existing field tools are separate. |
| QC Forms | Partial (outside engine) | Existing checklists are separate. |
| Warranty Documents | Partial | Warranty clauses exist inside residential contract, but no standalone warranty document template pipeline. |

### Is it still hardcoded around residential?
Mostly yes at runtime:
- Questionnaire bank only maps `residential_contract` in [`questionnaireEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaireEngine.ts).
- Input builder hardcodes `documentType: 'residential_contract'` in [`contractInput.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractInput.ts).
- Contract templates list only one real template in [`templates/contracts/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates/contracts/index.ts).

### Expansion blockers
- Non-residential template catalogs are empty.
- No document-type-aware registry resolution path.
- UI shell is contract-centric and currently residential-labeled.
- Compliance/risk assumptions are residential-biased.

---

## SECTION 4
## UI / UX REVIEW

### Grade: **B**

### Deductions
- **Navigation consistency (-1):** Feature is available in tools flow but not yet integrated into planner documents context ([`ToolsModal.tsx`](c:/Users/Admin/Desktop/calc/calc/src/components/workflow/ToolsModal.tsx), [`PlannerDocumentsPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/pages/planner/PlannerDocumentsPage.tsx)).
- **Mobile form flow (-1):** On small screens, long intake precedes output; preview and signing context are deep in scroll.
- **Accessibility (-1):** Canvas signature control in [`SignatureBlock.tsx`](c:/Users/Admin/Desktop/calc/calc/src/components/change-order/SignatureBlock.tsx) is touch/mouse-centric and lacks stronger assistive semantics.
- **Component complexity (-1):** Very large builder component hurts maintainability and UX iteration speed.

### Observations
- **Layout consistency:** Good use of shared card/input/button primitives and app theme tokens in builder.
- **Navigation consistency:** Route wiring is correct (`/tools/contract-builder`, `/contract/:token`).
- **Mobile responsiveness:** Utility classes exist, but information hierarchy is not optimized for short viewports.
- **Readability:** Clause preview is clear and uses section-based rendering.
- **Form flow:** Dynamic question groups and mode tiers work; save/load/history/signing all in one page can feel heavy.
- **Preview experience:** Strong (live + immutable version preview).
- **Signature workflow:** Good parity with existing public signing UX patterns.

### Screenshot placeholders
- Screenshot Placeholder: `DocumentBuilderPage` header + three-column desktop layout after answers entered.
- Screenshot Placeholder: `DocumentBuilderPage` save/load/version history panel with a selected historical version.
- Screenshot Placeholder: `DocumentBuilderPage` signing card showing `sent` status and copy link button.
- Screenshot Placeholder: `PublicContractPage` signature block + sign/decline actions.

---

## SECTION 5
## CONCRETE CALC DESIGN SYSTEM COMPLIANCE

### Does this feel like part of Concrete Calc?
**Mostly yes, with visible inconsistencies.**

### Compliance by area
- **Color palette:** Mostly aligned in builder; public contract page still uses mixed gray/slate token usage.
- **Typography:** Generally aligned with existing utility patterns.
- **Spacing/Card design:** Builder cards align with app card language; some nested card patterns create visual density.
- **Buttons/Inputs:** Uses shared `Button`, `Input`, `Select` components.
- **Modals/Tables:** Not central to this feature; save/load lists are custom list patterns.
- **Headers/Navigation:** Builder header style diverges from standardized field tool page shell.
- **Dark mode:** Works, but public page has mixed token families.
- **Concrete texture integration:** Not explicitly integrated in this feature.

### Inconsistencies list
- Contract builder does not use standardized field-tool shell used by safety/QC tools ([`FieldToolPageLayout.tsx`](c:/Users/Admin/Desktop/calc/calc/src/components/tools/FieldToolPageLayout.tsx)).
- `ToolsModal` project-context forwarding omits contract builder in `pathsWithProject` ([`ToolsModal.tsx`](c:/Users/Admin/Desktop/calc/calc/src/components/workflow/ToolsModal.tsx)).
- Planner documents page currently only surfaces safety meetings and QC checklists, not contracts ([`PlannerDocumentsPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/pages/planner/PlannerDocumentsPage.tsx)).

### Screenshot placeholders
- Screenshot Placeholder: Compare `FieldToolPageLayout` page header vs `DocumentBuilderPage` header.
- Screenshot Placeholder: `ToolsModal` showing contract builder tile and project-context behavior.
- Screenshot Placeholder: `PlannerDocumentsPage` lacking contracts section.

---

## SECTION 6
## BUNDLE SIZE IMPACT

### SAFE
- Contract builder and public contract are lazy routes in [`lazyPages.tsx`](c:/Users/Admin/Desktop/calc/calc/src/routes/lazyPages.tsx) and [`App.tsx`](c:/Users/Admin/Desktop/calc/calc/src/App.tsx).
- `PublicContractPage` is comparatively lean and service-focused.

### CONCERNING
- `DocumentBuilderPage` imports runtime logic from barrel (`from '../index'`), encouraging a larger lazy chunk.
- Static top-level `jspdf` import in [`contractPdf.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractPdf.ts) loads PDF dependency when builder loads.
- Vite warning threshold is high (`chunkSizeWarningLimit: 1500`) in [`vite.config.ts`](c:/Users/Admin/Desktop/calc/calc/vite.config.ts).

### HIGH RISK
- Monolithic builder page plus pack/question data in one lazy page creates a heavy feature chunk and reduced maintainability.

---

## SECTION 7
## DATABASE REVIEW

### Tables and relationships
- `contract_documents` + `contract_document_versions` with immutable version chain model in [`20260614000000_contract_documents.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260614000000_contract_documents.sql).
- `current_version_id` pointer and `latest_version_number` support version navigation.
- 6.2 adds public token and signature fields in [`20260615000000_contract_public_signing.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260615000000_contract_public_signing.sql).

### RLS and indexes
- Owner/project read access policy exists for documents.
- Version table has owner insert + owner/project select, no update/delete policies.
- Practical indexes are present for user/project/document lookups and token lookup.

### Versioning and auditability
- Versioning support is strong (append-only versions + unique `(document_id, version_number)`).
- Full audit log table for signing events is not present.

### Does schema support future needs?
- **Multiple contract versions:** Yes.
- **Future document types:** Partially (generic columns and `document_type` exist, but naming/table semantics remain contract-first).
- **Client portal:** Yes (via edge function linkage).
- **Signatures:** Yes (stored fields + public action RPC).
- **State packs:** Yes (captured via pack metadata/manifest).
- **Clause versioning:** Partial (manifest stores version maps, but no normalized clause-version tables).

### Missing pieces
- Stronger DB-level send/sign transition constraints.
- More constrained relation between `sent_version_id` and owning document.
- Optional signing event trail table.

---

## SECTION 8
## SECURITY REVIEW

### Security risks
- Public token read RPC returns full stored manifest, which includes broad snapshot metadata from engine manifests in current design (privacy scope may be broader than necessary) ([`20260615000000_contract_public_signing.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260615000000_contract_public_signing.sql), [`documentAssembly.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/documentAssembly.ts)).
- `sendContractForSignature` currently updates owner rows directly from app service layer, with fewer DB-level transition guarantees than an explicit send RPC path ([`contractDocumentService.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/services/contractDocumentService.ts)).

### Privacy risks
- Signature fields are stored as plain text/image payload strings and returned to token callers.
- Public link acts as bearer credential without expiry controls in current migration.

### Compliance risks
- Limited non-repudiation metadata (no dedicated signing-event ledger with immutable action records).
- Legal-notice placeholder status is signaled in UI/compliance but legal readiness still depends on external attorney review process.

### Recommended improvements
- Reduce public payload to least-privilege fields (especially around manifest internals).
- Add DB-level send/sign state transition enforcement RPC/trigger model.
- Add dedicated signing audit events table if legal enforceability requirements increase.
- Consider token rotation/expiry strategy for external-facing signature links.

---

## SECTION 9
## CODE QUALITY REVIEW

| File | Issue | Risk Level | Recommendation |
|---|---|---|---|
| [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx) | God component (intake, engine orchestration, persistence, signing, export, preview) | High | Split into focused panels/hooks. |
| [`contractDocumentService.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/services/contractDocumentService.ts) | Service depends on UI type (`SaveContractVersionPayload` from UI layer) | Medium | Move payload contracts into shared/service type module. |
| [`index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/index.ts) | Stale header comment contradicts current implementation | Low | Update technical docs/comments. |
| [`templates/*/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/templates) | Multiple exported empty catalogs | Low | Keep but clearly mark roadmap placeholders, or hide from public barrel until implemented. |
| [`packs/*/index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs) | Multiple exported empty pack arrays | Low | Same as above. |
| [`PublicContractPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/PublicContractPage.tsx) vs [`PublicChangeOrder.tsx`](c:/Users/Admin/Desktop/calc/calc/src/pages/PublicChangeOrder.tsx) | Similar public signing flow patterns duplicated | Medium | Extract shared public signing shell/hook. |
| [`contractPdf.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractPdf.ts) | Static `jspdf` import in feature path | Medium | Consider dynamic import at export-time. |

### Dead code / unused exports
No severe dead-code hotspot found in core documents feature, but roadmap placeholders (empty template/pack exports) behave as latent unused scaffolding.

---

## SECTION 10
## CONTRACT TEMPLATE REVIEW

### What is present
- Broad residential clause/addendum coverage in generic pack and concrete addenda:
  - Core + pricing/schedule/risk/warranty/dispute/etc. via [`packs/genericResidential/clauses`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/genericResidential/clauses)
  - Addendums via [`packs/genericResidential/addendums.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/genericResidential/addendums.ts)
  - Concrete differentiators via [`packs/concrete/addendums.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/concrete/addendums.ts)
  - State notices via [`packs/statePacks/notices`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/statePacks/notices)

### Missing / incomplete template areas
- Commercial contract template pack: missing.
- Government contract template pack: missing.
- Standalone change order/RFI/submittal/daily/safety/QC/warranty templates in this engine: missing (placeholder arrays only).
- Roofing/insurance-restoration/time-and-materials dedicated packs: placeholders in pack modules, not complete standalone pack catalogs.

### Duplicate/overlap risk
- Some business domains (change orders, safety, QC, RFIs) are already implemented in separate app systems, creating parallel-template risk if document engine versions are added without migration strategy.

---

## SECTION 11
## CONSTRUCTION OPERATIONS ALIGNMENT

### Vision alignment (Lead ? Proposal ? Contract ? Planning ? Safety ? QC ? Execution ? Change Orders ? Closeout)
- **Current fit:** Good for contract stage, partial for portal/customer communication, not yet a full lifecycle document platform.
- **Why:** The engine is robust for residential contract generation and now supports persistence/signing, but most non-contract operations are still handled by separate existing modules.

### Is it still too contract-centric?
Yes, today it is still contract-centric in runtime behavior.

### Changes needed to become full Construction Document Platform
- Introduce document-type-aware registries (question banks, packs, templates, compliance/risk profiles per type).
- Add at least one non-contract type end-to-end in this engine (recommended first: change order, because mature domain data already exists elsewhere in app).
- Unify planner document surfaces so contracts appear alongside safety/QC artifacts.
- Add migration strategy to reduce duplicated systems over time.

---

## SECTION 12
## TIDY-UP LIST

### QUICK WINS (< 1 day)
| File | Issue | Why it matters | Estimated effort |
|---|---|---|---|
| [`index.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/index.ts) | Stale top comment | Prevents architecture confusion | 0.25 day |
| [`ToolsModal.tsx`](c:/Users/Admin/Desktop/calc/calc/src/components/workflow/ToolsModal.tsx) | Add contract builder to `pathsWithProject` | Better project-context consistency | 0.25 day |
| [`contractDocumentService.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/services/contractDocumentService.ts) | Introduce dedicated shared payload type file | Fix layering clarity | 0.5 day |

### MEDIUM IMPROVEMENTS (1-3 days)
| File | Issue | Why it matters | Estimated effort |
|---|---|---|---|
| [`DocumentBuilderPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/DocumentBuilderPage.tsx) | Split into panel components/hooks | Reduces regression risk and speeds future features | 2-3 days |
| [`contractPdf.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractPdf.ts) | Convert to dynamic `jspdf` import | Improves feature chunk load behavior | 1 day |
| [`PlannerDocumentsPage.tsx`](c:/Users/Admin/Desktop/calc/calc/src/pages/planner/PlannerDocumentsPage.tsx) | Add contracts section and deep links | Closes operations workflow gap | 1-2 days |

### MAJOR IMPROVEMENTS (3+ days)
| File | Issue | Why it matters | Estimated effort |
|---|---|---|---|
| [`questionnaireEngine.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/engine/questionnaireEngine.ts), [`packs/registry.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/packs/registry.ts), [`contractInput.ts`](c:/Users/Admin/Desktop/calc/calc/src/features/documents/ui/contractInput.ts) | Make full runtime document-type-aware architecture | Required for platform-scale multi-document vision | 4-7 days |
| [`20260615000000_contract_public_signing.sql`](c:/Users/Admin/Desktop/calc/calc/supabase/migrations/20260615000000_contract_public_signing.sql) + service layer | Stronger DB-level send/sign transition enforcement and payload minimization | Security/compliance hardening for production signing | 3-5 days |
| Documents + legacy systems integration | Bridge/merge change order, RFI, safety, QC flows into unified platform roadmap | Eliminates long-term duplicate maintenance | 5+ days |

---

## SECTION 13
## FINAL GRADE

- **Architecture Grade:** B+
- **UI Grade:** B
- **Code Quality Grade:** B-
- **Scalability Grade:** B-
- **Construction Industry Fit Grade:** B
- **Overall Grade:** **B**

### Production approval question
**If this were a commercial SaaS construction platform, would you approve this implementation for production?**

**YES WITH CONDITIONS**

### Why
The implementation is strong enough for controlled production on residential contract workflows (drafting, persistence, versioning, and basic signing). However, before broad commercial rollout, the following conditions should be met:
1. Security hardening on public signing payload/state transitions.
2. Better planner/document workflow integration.
3. Reduced component complexity and clearer layer boundaries.
4. Clear roadmap execution for non-residential document types to avoid parallel-system drift.

---

## Additional Screenshot Placeholders (for report completeness)
- Screenshot Placeholder: Route `/tools/contract-builder` showing questionnaire mode selector and grouped intake cards.
- Screenshot Placeholder: Route `/tools/contract-builder` showing compliance panel + export controls + manifest download.
- Screenshot Placeholder: Route `/contract/:token` signed-state banner and read-only signature blocks.
- Screenshot Placeholder: Route `/client/project/:token` documents list with contract link after portal linkage.
