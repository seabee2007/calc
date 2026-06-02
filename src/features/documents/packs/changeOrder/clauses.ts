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
];

export const changeOrderPackClauseKeys: string[] = changeOrderPackClauses.map(
  (clause) => clause.key,
);
