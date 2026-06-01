import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  category: 'warranty' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const warrantyClauses: DocumentClause[] = [
  {
    ...base,
    key: 'warranty.workmanship',
    title: 'Limited Workmanship Warranty',
    bodyTemplate: `Contractor provides a limited workmanship warranty for {{warranty.months}} months from substantial completion. This warranty covers defects caused by Contractor's workmanship.

This warranty does not cover normal wear and tear, abuse, misuse, lack of maintenance, Owner modifications, work by others, acts of nature, movement, settlement, or cracking caused by existing conditions, manufacturer defects, materials selected or supplied by Owner, or damage caused by moisture, drainage, or ventilation conditions outside Contractor's scope.

Nothing in this warranty waives any non-waivable rights provided by applicable law.`,
  },
  {
    ...base,
    key: 'warranty.manufacturer',
    title: 'Manufacturer Warranties',
    bodyTemplate: `Manufacturer warranties, if any, are separate from Contractor's workmanship warranty. Contractor shall provide available manufacturer warranty information to Owner. Contractor does not control manufacturer warranty decisions.`,
  },
];
