# Conceptual Estimate Persistence Audit

## Source Of Truth

Saved conceptual estimate business data is persisted in Supabase on the `estimates` row for the project. The canonical storage location is the `estimates.assumptions` JSONB column, marked with `type: "conceptual_estimate"`. Estimate row metadata remains in first-class columns on `estimates`.

Primary DB locations:

- `estimates.estimate_type`: canonical workflow type, `conceptual`.
- `estimates.estimate_type_label`: display label for the workflow.
- `estimates.scheduling_enabled`, `estimates.estimate_mode_config`, `estimates.pricing_mode`: workflow settings.
- `estimates.totals`: recomputed conceptual totals/rollup summary.
- `estimates.summary`: save metadata and lightweight conceptual summary.
- `estimates.assumptions`: full conceptual payload, estimate settings, and shared schedule assumptions.

Local storage is not used for saved conceptual estimate data. It is only used for UI preferences such as the guided-help badge dismissal and workspace focus mode.

## Persistence Map

| Tab | Field | Frontend state | Save payload | DB location | Reload path | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Conceptual Budget | Revision name/title | `conceptualEstimate.rawPayload.revision.name` | `snapshot.assumptions.revision.name` | `estimates.assumptions.revision.name` | `conceptualEstimateFromAssumptions(...).revision.name` | Persists |
| Conceptual Budget | Basis of estimate / description | `conceptualEstimate.rawPayload.revision.basisOfEstimate` | `snapshot.assumptions.revision.basisOfEstimate` | `estimates.assumptions.revision.basisOfEstimate` | `conceptualEstimateFromAssumptions(...).revision.basisOfEstimate` | Persists |
| Conceptual Budget | Revision date, design stage, notes | `conceptualEstimate.rawPayload.revision` | `snapshot.assumptions.revision` | `estimates.assumptions.revision` | `conceptualEstimateFromAssumptions(...).revision` | Persists |
| Conceptual Budget | Line item title/type/category | `conceptualEstimate.rawPayload.lineItems[]` | `snapshot.assumptions.lineItems[]` | `estimates.assumptions.lineItems[]` | `conceptualEstimateFromAssumptions(...).lineItems[]` | Persists |
| Conceptual Budget | Quantity/unit/unit cost/amount | `conceptualEstimate.rawPayload.lineItems[]` | `snapshot.assumptions.lineItems[]` | `estimates.assumptions.lineItems[]` | `parseLineItem()` + `applyLineItemAmount()` | Persists |
| Conceptual Budget | Line item confidence/source/notes | `conceptualEstimate.rawPayload.lineItems[]` | `snapshot.assumptions.lineItems[]` | `estimates.assumptions.lineItems[]` | `conceptualEstimateFromAssumptions(...).lineItems[]` | Persists |
| Assumptions & Exclusions | Assumptions | `conceptualEstimate.rawPayload.assumptions[]` and `conceptualEstimate.draftItems.assumption` | `snapshot.assumptions.assumptions[]` after `buildPayloadWithDraftItems()` | `estimates.assumptions.assumptions[]` | `conceptualEstimateFromAssumptions(...).assumptions[]` | Persists, including visible draft fields on global Save |
| Assumptions & Exclusions | Exclusions | `conceptualEstimate.rawPayload.exclusions[]` and `conceptualEstimate.draftItems.exclusion` | `snapshot.assumptions.exclusions[]` after `buildPayloadWithDraftItems()` | `estimates.assumptions.exclusions[]` | `conceptualEstimateFromAssumptions(...).exclusions[]` | Persists, including visible draft fields on global Save |
| Assumptions & Exclusions | Allowance notes | `conceptualEstimate.rawPayload.allowanceNotes[]` and `conceptualEstimate.draftItems.allowanceNote` | `snapshot.assumptions.allowanceNotes[]` after `buildPayloadWithDraftItems()` | `estimates.assumptions.allowanceNotes[]` | `conceptualEstimateFromAssumptions(...).allowanceNotes[]` | Persists, including visible draft fields on global Save |
| Scenarios | Scenario name/description/notes | `conceptualEstimate.rawPayload.scenarios[]` | `snapshot.assumptions.scenarios[]` | `estimates.assumptions.scenarios[]` | `conceptualEstimateFromAssumptions(...).scenarios[]` | Persists |
| Scenarios | Scenario line item ids and selected scenario | `conceptualEstimate.rawPayload.scenarios[]`, `selectedScenarioId` | `snapshot.assumptions.scenarios[]`, `selectedScenarioId` | `estimates.assumptions.scenarios[]`, `estimates.assumptions.selectedScenarioId` | `conceptualEstimateFromAssumptions(...)` | Persists |
| Risks & Contingency | Risk register | `conceptualEstimate.rawPayload.risks[]` | `snapshot.assumptions.risks[]` | `estimates.assumptions.risks[]` | `conceptualEstimateFromAssumptions(...).risks[]` | Persists |
| Risks & Contingency | Conceptual contingency percent | `conceptualEstimate.rawPayload.contingencyPercent` | `snapshot.assumptions.contingencyPercent` | `estimates.assumptions.contingencyPercent` | `conceptualEstimateFromAssumptions(...).contingencyPercent` | Persists |
| Costs & Markup | Indirect cost, overhead, profit, tax, pricing bases | `estimateSettings.settings` | `snapshot.assumptions.estimateSettings` | `estimates.assumptions.estimateSettings` | `parseEstimateSettingsFromAssumptions()` | Persists |
| Costs & Markup | Totals/summaries | `conceptualEstimate.rollup`, `estimateSettings.settings` | `snapshot.totals`, `snapshot.summary` | `estimates.totals`, `estimates.summary` | `mapEstimateRowToCurrentEstimate()` and recomputed rollup | Persists |
| Settings | Currency, hours per day, default crew size | `estimateSettings.settings` | `snapshot.assumptions.estimateSettings` | `estimates.assumptions.estimateSettings` | `parseEstimateSettingsFromAssumptions()` | Persists |
| Settings | Estimate type/scheduling/pricing mode | `currentEstimate` row state | `estimate_type`, `scheduling_enabled`, `estimate_mode_config`, `pricing_mode` | `estimates` row columns | `mapEstimateRowToCurrentEstimate()` | Persists |
| Settings | Project crew size | Planner project state | `updateProject()` project save path | Project record | Planner project load | Persists outside estimate row |

## Fixes Applied

- Added a testable `buildConceptualEstimatePersistenceSnapshot()` that constructs the complete conceptual DB payload before any Supabase write.
- The conceptual save path now stores metadata with `projectId`, `estimateId`, `estimateType`, and `savedAt` inside `estimates.assumptions.metadata`.
- Legacy/partial conceptual records are no longer treated as empty when `assumptions` contains conceptual data but `estimate_type` or totals are missing.
- Estimate type is inferred as `conceptual` when the row has conceptual assumptions but no explicit `estimate_type`.
- Estimate settings now hydrate from both `assumptions.estimateSettings` and older nested `assumptions.markupSettings.estimateSettings`.
- Existing save success behavior remains DB-confirmed: the UI only calls `markSaved()` and shows the saved toast after the Supabase update/insert returns a saved row.
- Assumption, exclusion, and allowance-note draft inputs now live in the conceptual controller. Typing in those visible fields marks the estimate dirty, and global Save flushes meaningful draft values into the payload before writing to Supabase. Draft fields clear only after the DB-confirmed saved row is applied.
- Production console logs were removed from the estimate persistence service; diagnostic payload-key logging is gated to development mode only.

## Load/Save Flow

Save:

1. `EstimateWorkspacePage.handleSaveEstimate()` detects conceptual workflow.
2. It collects `conceptualEstimate.rawPayload`, `estimateSettings.settings`, row workflow settings, and existing schedule assumptions.
3. It calls `conceptualEstimate.buildPayloadWithDraftItems()` so visible assumption, exclusion, and allowance-note drafts are converted to payload items before persistence.
4. `saveCurrentConceptualEstimate()` builds the full snapshot and writes it to `estimates`.
5. Local page state is updated only from the DB-returned row.

Load:

1. `loadCurrentEstimateForProject()` reads the newest `estimates` row for the project.
2. `mapEstimateRowToCurrentEstimate()` maps row columns and JSONB fields.
3. `useConceptualEstimate.rehydrateFromEstimate()` hydrates all conceptual tabs from `estimates.assumptions`.
4. `useEstimateSettings.rehydrateFromEstimate()` hydrates Costs & Markup and Settings from `estimates.assumptions.estimateSettings`.

## Remaining Manual QA

Manual QA should still verify the production flow against Supabase:

1. Create/open a conceptual estimate.
2. Fill data in every conceptual tab.
3. Save and confirm success.
4. Navigate away/back, hard refresh, logout/login, and open in another browser.
5. Confirm the same data appears and the Supabase `estimates` row contains the expected `assumptions`, `totals`, and `summary` payload.
