import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const ownerClauses: DocumentClause[] = [
  {
    ...base,
    key: 'owner.responsibilities',
    title: 'Owner Responsibilities',
    category: 'owner_responsibility',
    bodyTemplate: `Owner shall be responsible for providing accurate property information, providing access to the work area, removing personal property from work areas, securing pets, providing timely decisions, approving selections, making payments when due, not interfering with the work, not directing subcontractors or workers, disclosing known defects or hazards, obtaining HOA approval if assigned to Owner, and providing utilities if required.

Owner delays may result in additional time and cost.`,
  },
  {
    ...base,
    key: 'owner.supplied_materials',
    title: 'Owner-Supplied Materials',
    category: 'owner_responsibility',
    bodyTemplate: `If Owner supplies materials, fixtures, appliances, equipment, or finishes, Owner is responsible for correct quantity, correct size, correct model, timely delivery, damage before installation, defects, missing parts, manufacturer warranty, and compatibility with the project.

Contractor is not responsible for delays, defects, rework, or warranty claims caused by Owner-supplied items.`,
  },
];

export const contractorClauses: DocumentClause[] = [
  {
    ...base,
    key: 'contractor.responsibilities',
    title: 'Contractor Responsibilities',
    category: 'contractor_responsibility',
    bodyTemplate: `Contractor shall perform the work described in this Agreement, provide reasonable supervision, coordinate labor, materials, and subcontractors, maintain a reasonably clean work area, follow applicable permit inspection requirements, notify Owner of material changes in scope, schedule, or conditions, and provide warranty service as stated in this Agreement.`,
  },
  {
    ...base,
    key: 'contractor.subcontractors',
    title: 'Subcontractors',
    category: 'contractor_responsibility',
    bodyTemplate: `Contractor may use subcontractors to perform portions of the work. Contractor remains responsible for coordinating subcontracted work within the scope of this Agreement.

Known subcontractors:
{{#each subcontractors}}
- {{name}} — {{trade}} — License: {{licenseNumber}}
{{/each}}

If required by state law, the subcontractor notice and list requirements shall be included in the state notice section.`,
  },
];
