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

export const disputeClauses: DocumentClause[] = [
  {
    ...base,
    key: 'dispute.resolution',
    title: 'Dispute Resolution',
    category: 'dispute',
    bodyTemplate: `The parties shall first attempt to resolve disputes through good-faith discussion. If unresolved, the parties agree to non-binding mediation before filing litigation or arbitration, unless emergency legal action is needed to preserve rights.

Dispute method: {{dispute.method}}
Venue: {{dispute.venue}}

This clause shall not limit rights that cannot be waived under applicable law.`,
  },
  {
    ...base,
    key: 'dispute.attorney_fees',
    title: 'Attorney Fees',
    category: 'dispute',
    bodyTemplate: `Where allowed by law, the prevailing party in a dispute arising from this Agreement may recover reasonable attorney fees, costs, and expenses.`,
  },
];

export const terminationClauses: DocumentClause[] = [
  {
    ...base,
    key: 'termination.suspension',
    title: 'Suspension of Work',
    category: 'termination',
    bodyTemplate: `Contractor may suspend work after written notice if Owner fails to make payment when due, Owner prevents access to the work, unsafe conditions exist, required permits or approvals are delayed, Owner interferes with the work, hazardous or concealed conditions are discovered, or work cannot continue due to events beyond Contractor's control.

Suspension may result in additional time and cost.`,
  },
  {
    ...base,
    key: 'termination.general',
    title: 'Termination',
    category: 'termination',
    bodyTemplate: `Either party may terminate this Agreement as allowed by law and by the terms of this Agreement.

If Owner terminates without Contractor default, Owner shall pay Contractor for work performed, materials ordered, restocking fees, subcontractor charges, demobilization, reasonable overhead and profit on work performed, and other lawful costs incurred before termination.`,
  },
];
