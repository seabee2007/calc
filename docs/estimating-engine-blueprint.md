# Estimating Engine Blueprint
This document captures the current estimating engine plan for Concrete Calc.
Scope is documentation only.
No application behavior is changed by this document.

## 1) Overall app flow
1. Project is created/selected in `projects`.
2. Estimate inputs are produced from calculators and manual estimate sources.
3. Estimating engine creates a versioned estimate snapshot for the project.
4. Proposal pricing imports from estimate snapshot (with safe fallback to current import path).
5. Approved estimate baseline can publish into schedule/planner/Gantt projections.
6. Downstream documents (proposal/change order/contract) consume consistent estimate data.

Target integration path:
- Projects -> Estimating Workspace -> Proposal -> Schedule/Gantt -> Change Orders/Contracts
- Keep existing calculators and proposal flow working during migration.

## 2) Estimate levels
Use explicit estimate maturity levels:
- **Level 0 (ROM):** fast rough order-of-magnitude budgeting.
- **Level 1 (Conceptual):** early assembly-level takeoff by scope groups.
- **Level 2 (Detailed):** line-item estimate with quantities, labor, equipment, material.
- **Level 3 (Execution Baseline):** approved estimate version used for schedule/proposal/contract controls.

Rules:
- One project can have multiple estimate versions.
- Only one version is marked active baseline at a time.
- Baseline changes require a version increment, never destructive overwrite.

## 3) Estimating methods
Support hybrid methods so current app functionality is preserved:
- **Calculator-derived:** pull from concrete/reinforcement/labor/custom calculators.
- **Assembly-based:** standard crews/assemblies by scope package.
- **Unit-rate line item:** quantity x unit cost.
- **Manual override:** controlled adjustments with reason and audit note.

Method policy:
- Default to deterministic calculator-derived values where available.
- Allow manual override at line level, but keep source traceability.
- Persist source metadata (calculator id, custom source, manual flag).

## 4) CSI division structure
Recommended estimate taxonomy:
- **Division 01** - General Requirements / General Conditions
- **Division 03** - Concrete
- **Division 05** - Metals (reinforcement where needed)
- **Division 31** - Earthwork
- **Division 32** - Exterior Improvements / Flatwork context
- **Division 33** - Utilities (as project scope requires)

Structure:
- Division -> Section -> Work Item
- Every estimate line carries:
  - `csi_division`
  - optional `csi_section`
  - `work_item_code`
  - `description`

Initial concrete-first rollout can focus on Division 03 + required supporting divisions.

## 5) Quantity formulas
Core quantity formulas (current + planned):

- **Slab volume (yd3)**  
  `volume_yd3 = (length_ft * width_ft * (thickness_in / 12)) / 27`

- **Footer volume (yd3)**  
  `volume_yd3 = (length_ft * width_ft * depth_ft) / 27`

- **Rectangular column volume (yd3)**  
  `volume_yd3 = (length_ft * width_ft * height_ft) / 27`

- **Round column volume (yd3)**  
  `volume_yd3 = (PI * (diameter_ft / 2)^2 * height_ft) / 27`

- **Thickened edge slab (yd3)**  
  `total = base_slab_volume + perimeter_edge_volume - overlap_adjustments`

- **Waste-adjusted quantity**  
  `qty_with_waste = base_qty * (1 + waste_factor_percent / 100)`

- **Reinforcement linear quantity (conceptual)**  
  `bars_count = span / spacing + 1`  
  `linear_ft = bars_count * run_length_ft`

All formulas should be stored as deterministic calculation metadata for reproducibility.

## 6) Labor formulas
Labor model should remain compatible with existing labor calculator behavior:

- **Base labor hours**  
  `base_hours = quantity / production_rate`

- **Adjusted labor hours**  
  `adjusted_hours = base_hours * complexity_factor * access_factor * weather_factor`

- **Crew days**  
  `crew_days = adjusted_hours / (crew_size * work_hours_per_day)`

- **Labor cost**  
  `labor_cost = adjusted_hours * burdened_hourly_rate`

- **Overtime-adjusted labor cost (if applicable)**  
  `labor_cost_ot = labor_cost * overtime_multiplier`

- **Small job minimum enforcement (optional policy)**  
  `final_labor_hours = max(adjusted_hours, minimum_hours_threshold)`

## 7) Cost formulas
Standardized cost rollup:

- **Material cost**  
  `material_cost = qty * unit_material_cost * regional_multiplier * waste_multiplier`

- **Equipment cost**  
  `equipment_cost = usage_hours_or_days * unit_equipment_rate`

- **Subcontract cost**  
  `subcontract_cost = quoted_or_modeled_subcontract_total`

- **Direct cost subtotal**  
  `direct_cost = labor_cost + material_cost + equipment_cost + subcontract_cost`

- **Overhead/markup and margin**
  - Markup method: `price = direct_cost * (1 + markup_percent)`
  - Margin method: `price = direct_cost / (1 - target_margin_percent)`

- **Tax application (company settings aware)**
  - none / sales_tax / gross_receipts_tax / vat
  - application scope: materials only, materials+equipment, or entire project

- **Final estimate total**
  `estimate_total = direct_cost + indirects + tax`

## 8) Database plan
Use additive schema only; do not break existing tables.

Phase-1 table plan:
- `estimating_estimates`
  - `id`, `project_id`, `level`, `status`, `active_version_id`, `created_by`, timestamps
- `estimating_versions`
  - `id`, `estimate_id`, `version_no`, `method`, `snapshot_json`, totals, `is_baseline`, timestamps
- `estimating_line_items`
  - `id`, `version_id`, CSI fields, quantity fields, labor/material/equipment/subcontract fields, source metadata
- `estimating_source_links`
  - maps line/version data to source entities (`calculation_id`, `reinforcement_set_id`, `labor_estimate_id`, custom/manual source ids)

Data/ops requirements:
- Strict foreign keys to `projects`.
- RLS consistent with current owner/employee access model.
- Indexes on `project_id`, `estimate_id`, `version_id`, `is_baseline`.
- No destructive migration of current tables (`calculations`, `labor_estimates`, `reinforcement_sets`, `projects`, `proposals`).

## 9) UI plan
Add a dedicated estimating workspace while reusing current UI system:

Primary screens:
- Estimate workspace page (project-scoped)
- Version selector/baseline manager
- Line item editor grouped by CSI
- Quantity/labor/cost summary panel
- Import panel for calculator-derived sources
- Validation/errors panel (missing assumptions, incomplete items)

Reuse existing UI foundations:
- Cards, buttons, forms, modal/drawer/toast components in `src/components/ui`
- Existing theme tokens in `src/theme/*` and domain themes for planner/ops
- Full dark/light compatibility from current class-based theme system

Guardrails:
- Start read-only projection mode first.
- Enable editing and publish actions only after adapter validation.

## 10) Scheduling/Gantt integration plan
Introduce adapter-based publish flow from estimate baseline to schedule/planner:

1. Convert baseline estimate into milestone/task payloads.
2. Map CSI/scope groups to schedule event categories.
3. Compute preliminary durations from quantities and labor production.
4. Publish via service layer (`scheduleEventService`, planner services), not direct UI table writes.
5. Track sync metadata so generated schedule items are identifiable and updatable.

Controls:
- One-way publish initially (estimate -> schedule).
- Re-publish should diff and update only generated items.
- Manual schedule edits should remain possible with conflict markers.

## 11) Concrete Calc integration plan
Concrete Calc is the primary estimator input source in early phases.

Source mapping:
- `calculations` -> concrete quantity + pricing basis
- `reinforcement_sets` -> reinforcement material quantities/cost
- `labor_estimates` (or fallback `placement_order.production`) -> labor baselines
- `custom_estimates` -> manual labor/material/equipment lines

Integration approach:
- Build adapters that normalize each source into estimating line items.
- Keep current calculator save flows intact.
- Use dual-write strategy (feature-flagged) after read-only validation.
- Keep proposal import fallback to existing `proposalPricingImport` until parity is confirmed.

## 12) Safe phased build order
1. **Foundation (additive only)**
   - Create estimating schema + domain models + pure formula/test layer.
2. **Read-only workspace**
   - Add estimate workspace route and projection UI from existing source data.
3. **Source adapters**
   - Implement adapters from concrete/rebar/labor/custom into normalized estimate lines.
4. **Versioning + baseline controls**
   - Introduce estimate versions, baseline selection, immutable snapshots.
5. **Dual-write integration**
   - Feature-flagged writes from calculator save events into estimating tables.
6. **Proposal integration**
   - Prefer estimate baseline for proposal line import, with hard fallback path.
7. **Scheduling/Gantt publish**
   - Publish baseline-derived milestones/tasks through schedule/planner services.
8. **Change order/contract integration**
   - Feed approved estimate baselines into downstream document workflows.
9. **Stabilization and migration hardening**
   - Validate parity, then gradually reduce legacy overlap paths.

Safety boundaries during early phases:
- Do not refactor core project store fallback matrix first.
- Do not break legacy planner redirects.
- Do not replace existing proposal pricing import path until tested parity.
- Do not alter schedule recurrence behavior during foundation phases.
