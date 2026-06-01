import type { DocumentAddendum, ProjectType } from '../../types';
import { ALL_PRICE_MODELS } from '../../types';

/**
 * Concrete differentiator addenda - the ConcreteCalc-specific contract modules.
 * All are scoped to the `concrete` project type so the assembly engine
 * auto-includes them only on concrete jobs (and the recommendation engine can
 * surface the high-value ones). Draft-only, not attorney reviewed.
 */
const base = {
  category: 'addendum' as const,
  documentType: 'residential_contract' as const,
  applicableProjectTypes: ['concrete'] as ProjectType[],
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const concreteAddendums: DocumentAddendum[] = [
  {
    ...base,
    key: 'addendum.concrete',
    title: 'Concrete Addendum',
    bodyTemplate: `CONCRETE ADDENDUM

This addendum governs the concrete portion of the work.

Mix design: {{concrete.mixDesign}}
Specified strength: {{concrete.psi}} PSI
Slump: {{concrete.slump}}
Air entrainment: {{concrete.air}}
Reinforcement: {{concrete.reinforcement}}
Jointing: {{concrete.jointing}}
Finish: {{concrete.finish}}
Curing method: {{concrete.curing}}

Placement is subject to weather, temperature, subgrade conditions, and ready-mix availability. Owner acknowledges that concrete is a natural material that varies in color, texture, and finish, and that minor variation is normal and not a defect.`,
  },
  {
    ...base,
    key: 'addendum.concrete_cracking',
    title: 'Concrete Cracking Disclaimer',
    bodyTemplate: `CONCRETE CRACKING DISCLAIMER

Concrete may develop shrinkage cracks, surface checking, color variation, curling, crazing, and minor cosmetic imperfections despite proper installation. These conditions are inherent to concrete and are not considered defects in workmanship.

Control joints are placed to encourage cracking at planned locations, but they do not prevent all cracking. Cracks that do not affect the structural integrity or intended use of the concrete are normal and are not covered by the workmanship warranty.

Contractor is not responsible for cracking caused by soil movement, settlement, tree roots, drainage, freeze/thaw cycles, deicing salts, heavy loads, or conditions outside Contractor's scope.`,
  },
  {
    ...base,
    key: 'addendum.ready_mix',
    title: 'Ready-Mix Disclaimer',
    bodyTemplate: `READY-MIX DISCLAIMER

Concrete is supplied by a third-party ready-mix plant. Contractor does not control plant scheduling, batching, dispatch, or delivery logistics.

Contractor is not responsible for delays or impacts caused by plant backlog, batching errors by the supplier, truck or driver availability, traffic, road conditions, weather holds, or mix availability and shortages.

If delivery is delayed or a load is rejected for quality, Contractor may reschedule the placement to protect the quality of the work. Such delays may extend the schedule and, where they increase cost, may result in a Change Order.`,
  },
  {
    ...base,
    key: 'addendum.concrete_spec_sheet',
    title: 'Concrete Specification Sheet',
    bodyTemplate: `CONCRETE SPECIFICATION SHEET

Strength (PSI): {{concrete.psi}}
Slump: {{concrete.slump}}
Air content: {{concrete.air}}
Fiber: {{concrete.fiber}}
Rebar: {{concrete.rebar}}
Mesh: {{concrete.mesh}}
Jointing: {{concrete.jointing}}
Finish: {{concrete.finish}}
Curing: {{concrete.curing}}

These specifications reflect the agreed mix and placement requirements. Substitutions may be made where a specified material is unavailable, using a comparable material, with notice to Owner.`,
  },
  {
    ...base,
    key: 'addendum.ready_mix_order',
    title: 'Ready-Mix Order Summary',
    bodyTemplate: `READY-MIX ORDER SUMMARY

Plant: {{readyMix.plant}}
Mix: {{readyMix.mix}}
Yards ordered: {{readyMix.yards}}
Delivery date: {{readyMix.deliveryDate}}
Pump required: {{readyMix.pumpRequired}}

Quantities are estimated from field measurements. Actual yardage may vary based on subgrade, form depth, and waste. Additional concrete required beyond the estimate may be billed as an extra.`,
  },
  {
    ...base,
    key: 'addendum.concrete_acceptance',
    title: 'Concrete Acceptance Criteria',
    bodyTemplate: `CONCRETE ACCEPTANCE CRITERIA

Flatness: {{acceptance.flatness}}
Levelness: {{acceptance.levelness}}
Finish type: {{acceptance.finishType}}
Jointing: {{acceptance.jointing}}
Tolerance: {{acceptance.tolerance}}

The work is acceptable when it meets the stated criteria within normal industry tolerances. Minor cosmetic variation, color variation, and hairline cracking within tolerance are acceptable and do not constitute a defect.`,
  },
  {
    ...base,
    key: 'addendum.owner_maintenance',
    title: 'Owner Maintenance Guide',
    bodyTemplate: `OWNER MAINTENANCE GUIDE

To protect the concrete and preserve any workmanship warranty, Owner should:

- Curing: keep new concrete moist and protected during the initial curing period and avoid loading it too soon.
- Sealing: apply a quality sealer as recommended and reseal periodically to resist moisture and staining.
- Freeze/thaw: minimize standing water and ensure drainage to reduce freeze/thaw damage.
- Deicing salts: avoid deicing chemicals on new concrete, especially during the first winter; use sand for traction instead.
- Crack expectations: expect minor shrinkage cracks and surface variation over time; these are normal for concrete.

Failure to maintain the concrete may void workmanship coverage for related issues.`,
  },
];

export const concreteAddendumKeys: string[] = concreteAddendums.map((addendum) => addendum.key);
