import type { DocumentClause } from '../../../types';
import { makeStateNotice } from './_shared';

/**
 * California residential home improvement statutory notices (LOCKED).
 *
 * Sources to verify before use:
 *  - California Business & Professions Code (BPC) Section 7159
 *  - CSLB Home Improvement Contract guidance
 *  - California Civil Code (down payment / progress payment limits)
 */
export const californiaNotices: DocumentClause[] = [
  makeStateNotice({
    key: 'notice.ca.identity',
    title: 'Home Improvement Contract - Contractor Identity & License',
    state: 'California',
    requires:
      "the statutory 'Home Improvement' heading and contractor name, business address, and CSLB license number formatting.",
    authority: 'BPC Section 7159; CSLB Home Improvement Contract guidance.',
    fields: [
      'Contractor: {{contractor.legalName}}',
      '{{contractor.address}}',
      'CSLB License No.: {{contractor.licenseNumber}}',
    ],
  }),
  makeStateNotice({
    key: 'notice.ca.price_downpayment',
    title: 'Contract Price & Down Payment Limitation',
    state: 'California',
    requires:
      'the contract price and the statutory down payment limitation disclosure (generally the lesser of 10% of the contract price or $1,000 for home improvement contracts).',
    authority: 'BPC Section 7159; California Civil Code.',
    fields: ['Contract Price: {{currency pricing.contractPrice}}'],
  }),
  makeStateNotice({
    key: 'notice.ca.progress_payments',
    title: 'Schedule of Progress Payments & Approximate Dates',
    state: 'California',
    requires:
      'the schedule of progress payments stated in dollars and cents, and the approximate start and completion dates.',
    authority: 'BPC Section 7159.',
    fields: [
      'Approximate Start Date: {{schedule.startDate}}',
      'Approximate Completion Date: {{schedule.completionDate}}',
    ],
  }),
  makeStateNotice({
    key: 'notice.ca.change_orders',
    title: 'Extra Work and Change Order Notice',
    state: 'California',
    requires:
      'the statutory extra work and change order notice describing how changes to the contract must be documented and signed.',
    authority: 'BPC Section 7159.',
  }),
  makeStateNotice({
    key: 'notice.ca.commercial_general_liability',
    title: 'Commercial General Liability (CGL) Insurance Notice',
    state: 'California',
    requires:
      "the statutory notice disclosing the contractor's commercial general liability insurance status.",
    authority: 'BPC Section 7159.',
  }),
  makeStateNotice({
    key: 'notice.ca.workers_comp',
    title: "Workers' Compensation Insurance Notice",
    state: 'California',
    requires: "the statutory workers' compensation insurance disclosure.",
    authority: 'BPC Section 7159.',
  }),
  makeStateNotice({
    key: 'notice.ca.mechanics_lien',
    title: 'Mechanics Lien Warning',
    state: 'California',
    requires:
      'the exact Mechanics Lien Warning required for California home improvement contracts.',
    authority: 'BPC Section 7159; California Civil Code (mechanics lien).',
  }),
  makeStateNotice({
    key: 'notice.ca.cslb',
    title: 'Contractors State License Board (CSLB) Notice',
    state: 'California',
    requires:
      "the CSLB notice describing the board's contact information and the consumer's right to file a complaint.",
    authority: 'BPC Section 7159; CSLB guidance.',
  }),
  makeStateNotice({
    key: 'notice.ca.cancellation',
    title: 'Notice of Right to Cancel (3 / 5 / 7 Day)',
    state: 'California',
    requires:
      "the buyer's right-to-cancel notice, including the three-day right and any extended five-day (senior) or seven-day (disaster/emergency) rights when triggered.",
    authority: 'BPC Section 7159; California Civil Code (home solicitation).',
  }),
  makeStateNotice({
    key: 'notice.ca.subcontractors',
    title: 'Subcontractor & Supplier Disclosure',
    state: 'California',
    requires:
      'any required disclosure of subcontractors and material suppliers as applicable.',
    authority: 'BPC Section 7159; California Civil Code.',
  }),
  makeStateNotice({
    key: 'notice.ca.bond',
    title: 'Performance & Payment Bond Notice',
    state: 'California',
    requires: 'the performance/payment bond notice when applicable.',
    authority: 'BPC Section 7159.',
  }),
];
