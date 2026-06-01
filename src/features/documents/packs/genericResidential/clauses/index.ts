import type { DocumentClause } from '../../../types';
import { masterClauses } from './master';
import { paymentClauses, pricingClauses } from './pricingPayment';
import { changeOrderClauses } from './changeOrder';
import { scheduleClauses } from './schedule';
import { riskClauses } from './risk';
import { warrantyClauses } from './warranty';
import { contractorClauses, ownerClauses } from './responsibilities';
import { disputeClauses, terminationClauses } from './disputeTermination';
import { completionClauses, protectionClauses } from './completionProtection';

/**
 * All Generic Residential Pack clauses in canonical assembly order.
 * Draft-only; none are attorney reviewed.
 */
export const genericResidentialClauses: DocumentClause[] = [
  ...masterClauses,
  ...pricingClauses,
  ...paymentClauses,
  ...changeOrderClauses,
  ...scheduleClauses,
  ...riskClauses,
  ...completionClauses,
  ...warrantyClauses,
  ...ownerClauses,
  ...contractorClauses,
  ...protectionClauses,
  ...disputeClauses,
  ...terminationClauses,
];

/** Ordered clause keys, used to populate the residential contract template. */
export const genericResidentialClauseKeys: string[] =
  genericResidentialClauses.map((clause) => clause.key);
