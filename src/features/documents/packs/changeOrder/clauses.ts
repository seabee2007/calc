import type { DocumentClause } from '../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../types';

const base = {
  documentType: 'change_order' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const changeOrderPackClauses: DocumentClause[] = [
  {
    ...base,
    key: 'co.title',
    title: 'Change Order Header',
    category: 'master',
    bodyTemplate: `CHANGE ORDER

Change Order No.: {{changeOrder.displayNumber}}
Date: {{changeOrder.date}}

Contractor: {{contractor.legalName}}
Owner / Client: {{owner.fullName}}
Project: {{project.name}}`,
  },
  {
    ...base,
    key: 'co.project_info',
    title: 'Project Information',
    category: 'master',
    bodyTemplate: `PROJECT INFORMATION

Project Name: {{project.name}}
Project Address: {{project.address}}
Owner / Client: {{owner.fullName}}
{{#if owner.company}}Client Company: {{owner.company}}
{{/if}}Contractor: {{contractor.legalName}}`,
  },
  {
    ...base,
    key: 'co.change_summary',
    title: 'Change Summary',
    category: 'master',
    bodyTemplate: `CHANGE SUMMARY

Title: {{changeOrder.title}}
Status: {{changeOrder.status}}
{{#if changeOrder.requestedBy}}Requested by: {{changeOrder.requestedBy}}
{{/if}}Reason for change: {{changeOrder.reasonForChange}}`,
  },
  {
    ...base,
    key: 'co.scope',
    title: 'Scope of Change',
    category: 'master',
    bodyTemplate: `SCOPE OF CHANGE

{{changeOrder.scopeDescription}}

{{#if changeOrder.addedWork}}Added work: {{changeOrder.addedWork}}
{{/if}}{{#if changeOrder.deletedWork}}Deleted work: {{changeOrder.deletedWork}}
{{/if}}{{#if changeOrder.exclusions}}Exclusions: {{changeOrder.exclusions}}
{{/if}}`,
  },
  {
    ...base,
    key: 'co.schedule_impact',
    title: 'Schedule Impact',
    category: 'schedule',
    bodyTemplate: `SCHEDULE IMPACT

{{#if changeOrder.scheduleImpact}}{{changeOrder.scheduleImpact}}{{else}}No schedule impact has been identified for this change order.{{/if}}
{{#if changeOrder.additionalCalendarDays}}Additional calendar days: {{changeOrder.additionalCalendarDays}}
{{/if}}{{#if changeOrder.revisedCompletionDate}}Revised completion date: {{changeOrder.revisedCompletionDate}}
{{/if}}`,
  },
  {
    ...base,
    key: 'co.pricing_summary',
    title: 'Pricing Summary',
    category: 'pricing',
    bodyTemplate: `PRICING SUMMARY

Total Change Order Price: {{currency changeOrder.totalAmount}}

This amount represents the complete adjustment to the contract for the work described in this change order. All applicable overhead, profit, taxes, fees, and permits are included unless otherwise noted.`,
  },
  {
    ...base,
    key: 'co.contract_value_summary',
    title: 'Contract Value Summary',
    category: 'pricing',
    bodyTemplate: `CONTRACT VALUE SUMMARY

Original contract amount: {{changeOrder.originalContractAmount}}
Previously approved change orders: {{currency changeOrder.previousApprovedTotal}}
This change order: {{currency changeOrder.totalAmount}}
Revised contract value: {{changeOrder.revisedContractValue}}`,
  },
  {
    ...base,
    key: 'co.terms',
    title: 'Terms and Approval',
    category: 'master',
    bodyTemplate: `TERMS AND APPROVAL

By signing below, both parties acknowledge and approve this change order, including the scope, schedule impact, and pricing stated herein. The original contract terms remain in effect except as modified by this change order.

{{#if changeOrder.approvalRequired}}This change order must be approved in writing before work begins.
{{/if}}{{#if changeOrder.customTerms}}Additional terms: {{changeOrder.customTerms}}
{{/if}}`,
  },
  {
    ...base,
    key: 'co.signatures',
    title: 'Signature Blocks',
    category: 'execution',
    bodyTemplate: `SIGNATURES

Contractor: ___________________________
Printed name: {{changeOrder.contractorName}}
Date: ___________________________

Owner / Client: ___________________________
Printed name: ___________________________
Date: ___________________________`,
  },
  // Optional recommended clauses — surfaced by recommendationEngine when toggles
  // fire; clause text is appended to Additional Terms only when the user accepts.
  {
    ...base,
    key: 'co.approval_before_work',
    title: 'Approval Before Work',
    category: 'change_order',
    bodyTemplate:
      'Work described in this Change Order shall not proceed until approved in writing by the Owner, except emergency protection work required to prevent damage or unsafe conditions.',
  },
  {
    ...base,
    key: 'co.emergency_work_docs',
    title: 'Emergency Work Documentation',
    category: 'change_order',
    bodyTemplate:
      'Emergency work shall be documented with photographs, labor records, materials used, and time logs, and the Owner shall be notified promptly.',
  },
  {
    ...base,
    key: 'co.concealed_condition',
    title: 'Concealed Condition',
    category: 'change_order',
    bodyTemplate:
      'Concealed or unknown conditions were discovered during the course of work. These conditions are excluded from the original contract scope unless specifically included by this Change Order.',
  },
  {
    ...base,
    key: 'co.owner_requested_scope',
    title: 'Owner Requested Scope',
    category: 'change_order',
    bodyTemplate:
      'Owner requested this change and acknowledges that the Contract Price and/or Contract Time may be adjusted accordingly.',
  },
  {
    ...base,
    key: 'co.cost_backup_required',
    title: 'Cost Backup',
    category: 'change_order',
    bodyTemplate:
      'Cost backup or detailed breakdown shall be attached to or made available with this Change Order before final approval.',
  },
  {
    ...base,
    key: 'co.schedule_adjustment',
    title: 'Schedule Adjustment',
    category: 'change_order',
    bodyTemplate:
      'The Contract Time is adjusted as stated in the schedule impact section of this Change Order.',
  },
];

export const changeOrderDocumentClauseKeys: string[] = [
  'co.title',
  'co.project_info',
  'co.change_summary',
  'co.scope',
  'co.schedule_impact',
  'co.pricing_summary',
  'co.contract_value_summary',
  'co.terms',
  'co.signatures',
];

export const changeOrderPackClauseKeys: string[] = changeOrderPackClauses.map(
  (clause) => clause.key,
);
