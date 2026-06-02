import type { DocumentPack } from '../../types';
import { GENERIC_CHANGE_ORDER_TEMPLATE } from './template';

export { changeOrderPackClauses, changeOrderPackClauseKeys } from './clauses';
export { GENERIC_CHANGE_ORDER_TEMPLATE } from './template';
export { changeOrderQuestions } from './questions';

/**
 * Generic Change Order Pack.
 *
 * A nationwide construction document pack — not a state-specific legal pack.
 * Draft-only posture: final export allowed (it is a construction form, not a
 * legal contract requiring attorney review), but the draft-only flag prevents
 * confusing it with an attorney-reviewed legal pack.
 */
export const GENERIC_CHANGE_ORDER_PACK: DocumentPack = {
  packKey: 'GENERIC_CHANGE_ORDER',
  label: 'Generic Change Order Pack',
  documentType: 'change_order',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_CHANGE_ORDER_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
