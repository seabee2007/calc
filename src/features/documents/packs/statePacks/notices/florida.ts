import type { DocumentClause } from '../../../types';
import { makeStateNotice } from './_shared';

/**
 * Florida residential statutory notices (LOCKED).
 *
 * Sources to verify before use:
 *  - Florida Statutes Section 501.031 (home solicitation cancellation)
 *  - Florida Statutes Chapter 713 (construction lien law)
 *  - Florida Homeowners' Construction Recovery Fund (Ch. 489)
 */
export const floridaNotices: DocumentClause[] = [
  makeStateNotice({
    key: 'notice.fl.cancellation',
    title: "Home Solicitation - Buyer's Right to Cancel",
    state: 'Florida',
    requires:
      "the home solicitation buyer's right-to-cancel notice (three business days) when the sale is a home solicitation sale.",
    authority: 'Fla. Stat. Section 501.031.',
  }),
  makeStateNotice({
    key: 'notice.fl.construction_lien',
    title: 'Construction Lien Law Warning',
    state: 'Florida',
    requires:
      'the statutory Construction Lien Law warning required for direct residential contracts.',
    authority: 'Fla. Stat. Chapter 713 (Construction Lien Law).',
  }),
  makeStateNotice({
    key: 'notice.fl.recovery_fund',
    title: "Florida Homeowners' Construction Recovery Fund Notice",
    state: 'Florida',
    requires:
      "the statutory notice regarding the Florida Homeowners' Construction Recovery Fund.",
    authority: 'Fla. Stat. Chapter 489.',
  }),
  makeStateNotice({
    key: 'notice.fl.unlicensed_warning',
    title: 'Unlicensed Contractor Warning',
    state: 'Florida',
    requires:
      'the consumer warning regarding unlicensed contractors and verification of licensure.',
    authority: 'Fla. Stat. Chapter 489.',
  }),
  makeStateNotice({
    key: 'notice.fl.roofing_insurance',
    title: 'Roofing / Emergency / Insurance Claim Notices',
    state: 'Florida',
    requires:
      'roofing, emergency, and property insurance claim notices and disclosures when those triggers apply.',
    authority: 'Fla. Stat. Chapter 489; Fla. Stat. Chapter 627 (insurance).',
  }),
];
