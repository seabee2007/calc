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

export const masterClauses: DocumentClause[] = [
  {
    ...base,
    key: 'contract.title',
    title: 'Contract Title',
    category: 'master',
    bodyTemplate: `RESIDENTIAL CONSTRUCTION AGREEMENT

This Residential Construction Agreement is entered into by and between:

Contractor: {{contractor.legalName}}
{{contractor.address}}
Phone: {{contractor.phone}}
Email: {{contractor.email}}
License No.: {{contractor.licenseNumber}}

Owner: {{owner.fullName}}
{{owner.mailingAddress}}
Phone: {{owner.phone}}
Email: {{owner.email}}

Project Property: {{property.address}}
Project Type: {{project.projectType}}

This document is a draft generated for review. Contractor is responsible for confirming all state, local, licensing, permit, lien, notice, warranty, and cancellation requirements before use.`,
  },
  {
    ...base,
    key: 'scope.work',
    title: 'Scope of Work',
    category: 'master',
    bodyTemplate: `Contractor shall provide labor, supervision, materials, tools, equipment, and ordinary incidental items necessary to perform the following work at the Project Property:

{{project.scopeSummary}}

Included work:
{{#each project.scopeItems}}
- {{description}}
{{/each}}

The work shall be performed in a workmanlike manner and in general accordance with the contract documents listed in this Agreement.`,
  },
  {
    ...base,
    key: 'scope.exclusions',
    title: 'Exclusions',
    category: 'master',
    bodyTemplate: `The following items are excluded unless specifically included by written change order:

{{#each project.exclusions}}
- {{description}}
{{/each}}

Common exclusions may include, but are not limited to: engineering, architectural design, surveying, permit fees unless stated otherwise, utility relocation, hazardous material testing or remediation, mold remediation, asbestos abatement, lead paint abatement, hidden structural repairs, unforeseen subsurface conditions, owner-requested upgrades, and HOA fees or approvals unless stated otherwise.`,
  },
  {
    ...base,
    key: 'contract.documents',
    title: 'Contract Documents',
    category: 'master',
    bodyTemplate: `The Contract Documents consist of this Agreement and the following attached or incorporated documents:

{{#each project.contractDocuments}}
- {{title}} dated {{date}}
{{/each}}

If there is a conflict between documents, the following order controls unless prohibited by applicable law:
1. Signed change orders
2. This Agreement
3. Written specifications
4. Drawings and plans
5. Proposal attachments
6. Other incorporated documents`,
  },
];
