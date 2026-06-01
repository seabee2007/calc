import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  category: 'change_order' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const changeOrderClauses: DocumentClause[] = [
  {
    ...base,
    key: 'change_order.required',
    title: 'Change Orders Required',
    bodyTemplate: `No change in the scope of work, Contract Price, materials, schedule, or payment terms shall be binding unless documented in a written Change Order signed by Owner and Contractor before the changed work begins, except where emergency protection work is required to prevent immediate damage or unsafe conditions.

Each Change Order shall state:
- Description of added, deleted, or revised work
- Amount added to or deducted from the Contract Price
- Effect on the payment schedule
- Effect on the project schedule
- Signatures of Owner and Contractor`,
  },
  {
    ...base,
    key: 'change_order.pricing',
    title: 'Change Order Pricing',
    bodyTemplate: `Change Orders may be priced by lump sum, unit price, time and materials, or cost plus agreed markup.

Unless otherwise stated, Change Orders shall include labor, materials, equipment, subcontractors, fees, permits, overhead, profit, and schedule impact.`,
  },
  {
    ...base,
    key: 'change_order.unknown_conditions',
    title: 'Unknown Conditions',
    bodyTemplate: `If concealed, latent, or unknown conditions are discovered, Contractor may stop affected work and notify Owner. Unknown conditions may include, but are not limited to: rot, termite damage, water damage, mold, asbestos, lead paint, unsafe wiring, plumbing defects, structural defects, code violations, hidden utilities, unsuitable soil, rock, debris, or buried objects, and other unforeseen site conditions.

Correction of unknown conditions is not included unless expressly stated in the scope of work. Contractor may submit a Change Order for additional cost and time.`,
  },
];
