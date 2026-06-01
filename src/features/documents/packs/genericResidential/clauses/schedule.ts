import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  category: 'schedule' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const scheduleClauses: DocumentClause[] = [
  {
    ...base,
    key: 'schedule.project',
    title: 'Project Schedule',
    bodyTemplate: `Approximate Start Date: {{schedule.startDate}}
Approximate Completion Date: {{schedule.completionDate}}

These dates are estimates unless this Agreement expressly states that time is of the essence.`,
  },
  {
    ...base,
    key: 'schedule.delays',
    title: 'Delays',
    bodyTemplate: `Contractor shall not be responsible for delays caused by events beyond Contractor's reasonable control, including but not limited to weather, storms, flooding, fire, earthquake, material shortages, shipping delays, permit delays, inspection delays, utility delays, Owner delays, Change Orders, labor shortages, subcontractor delays, unavailable materials, acts of government, emergencies, and unsafe site conditions.

The project schedule shall be extended by a reasonable time for such delays.`,
  },
  {
    ...base,
    key: 'schedule.access',
    title: 'Work Hours and Access',
    bodyTemplate: `Owner shall provide Contractor reasonable access to the Project Property during normal working hours or other agreed work hours.

Normal work hours: {{schedule.workHours}}

Owner shall provide access to work areas, driveways, utilities, water, electricity, restroom access if agreed, and storage areas if agreed.

Delays caused by lack of access may result in additional cost and time.`,
  },
];
