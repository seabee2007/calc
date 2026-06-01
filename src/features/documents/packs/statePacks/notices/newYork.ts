import type { DocumentClause } from '../../../types';
import { makeStateNotice } from './_shared';

/**
 * New York residential home improvement statutory notices (LOCKED).
 *
 * Sources to verify before use:
 *  - New York General Business Law (GBL) Section 771 (home improvement contracts)
 *  - New York Lien Law (incl. Article 3-A trust fund provisions)
 *  - Applicable local (e.g. NYC, Nassau, Suffolk, Westchester) licensing rules
 */
export const newYorkNotices: DocumentClause[] = [
  makeStateNotice({
    key: 'notice.ny.contract_terms',
    title: 'Written Home Improvement Contract Terms',
    state: 'New York',
    requires:
      'the statutorily required written home improvement contract terms and conspicuous-notice formatting.',
    authority: 'N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.contractor_identity',
    title: 'Contractor Identity & License',
    state: 'New York',
    requires:
      "the contractor's name, address, telephone number, and applicable local license number.",
    authority: 'N.Y. GBL Section 771; local licensing law.',
    fields: [
      'Contractor: {{contractor.legalName}}',
      '{{contractor.address}}',
      'Phone: {{contractor.phone}}',
      'License No.: {{contractor.licenseNumber}}',
    ],
  }),
  makeStateNotice({
    key: 'notice.ny.dates',
    title: 'Estimated Start & Substantial Completion Dates',
    state: 'New York',
    requires: 'the approximate start date and substantial completion date.',
    authority: 'N.Y. GBL Section 771.',
    fields: [
      'Approximate Start Date: {{schedule.startDate}}',
      'Approximate Completion Date: {{schedule.completionDate}}',
    ],
  }),
  makeStateNotice({
    key: 'notice.ny.scope_materials',
    title: 'Description of Work & Materials',
    state: 'New York',
    requires:
      'a detailed description of the work to be performed and the materials to be used.',
    authority: 'N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.mechanics_lien',
    title: 'Mechanics Lien Warning',
    state: 'New York',
    requires: 'the statutory mechanics lien warning.',
    authority: 'N.Y. Lien Law; N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.trust_funds',
    title: 'Advance Payment - Trust Fund or Bond Notice',
    state: 'New York',
    requires:
      'the notice regarding handling of advance payments as trust funds or, alternatively, a bond/deposit arrangement.',
    authority: 'N.Y. Lien Law Article 3-A; N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.progress_payments',
    title: 'Progress Payment Schedule',
    state: 'New York',
    requires: 'the progress payment schedule disclosure.',
    authority: 'N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.cancellation',
    title: 'Three-Business-Day Right to Cancel',
    state: 'New York',
    requires: "the buyer's three-business-day right-to-cancel notice.",
    authority: 'N.Y. GBL Section 771.',
  }),
  makeStateNotice({
    key: 'notice.ny.financing',
    title: 'Financing Disclosure',
    state: 'New York',
    requires: 'the financing disclosure when the work is financed.',
    authority: 'N.Y. GBL Section 771; applicable lending law.',
  }),
];
