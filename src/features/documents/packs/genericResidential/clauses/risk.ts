import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  category: 'risk' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const riskClauses: DocumentClause[] = [
  {
    ...base,
    key: 'risk.permits',
    title: 'Permits',
    bodyTemplate: `Permit responsibility: {{permits.responsibleParty}}

Required permits:
{{#each permits.items}}
- {{type}} — {{status}}
{{/each}}

Owner acknowledges that permit requirements are controlled by the local authority having jurisdiction. Delays caused by permit review, inspections, corrections, or government processing are not Contractor-caused delays unless caused by Contractor's failure to perform required duties.`,
  },
  {
    ...base,
    key: 'risk.code_compliance',
    title: 'Code Compliance',
    bodyTemplate: `Work shall be performed in general compliance with applicable codes and permit requirements known at the time of work. If existing conditions do not comply with current code, required corrections are excluded unless specifically included in the scope of work.

Code-required changes, upgrades, or corrections discovered after work begins may require a Change Order.`,
  },
  {
    ...base,
    key: 'risk.hazardous_materials',
    title: 'Hazardous Materials',
    bodyTemplate: `Unless specifically included in the scope, Contractor is not responsible for testing, handling, removal, encapsulation, transport, or disposal of hazardous materials, including but not limited to asbestos, lead, mold, contaminated soil, fuel, chemicals, or biological hazards.

If suspected hazardous materials are discovered, Contractor may stop work in the affected area until the condition is evaluated and corrected by qualified parties.`,
  },
  {
    ...base,
    key: 'risk.material_escalation',
    title: 'Material Escalation',
    bodyTemplate: `The Contract Price is based on material prices available at the time of proposal. If material prices increase substantially due to market conditions, supply shortages, tariffs, transportation costs, disaster conditions, or other causes beyond Contractor's reasonable control, Contractor may request an equitable adjustment by Change Order.

This clause does not apply where prohibited by law.`,
  },
  {
    ...base,
    key: 'risk.force_majeure',
    title: 'Force Majeure',
    bodyTemplate: `Neither party shall be liable for delay or nonperformance caused by events beyond reasonable control, including severe weather, natural disasters, war, civil disturbance, labor disruption, supply chain failure, government order, pandemic, utility failure, or other events that could not reasonably be prevented.`,
  },
];
