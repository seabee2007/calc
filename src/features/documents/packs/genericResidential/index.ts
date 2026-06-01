import type { DocumentPack, DocumentTemplate } from '../../types';
import { genericResidentialClauseKeys } from './clauses';
import { genericResidentialAddendumKeys } from './addendums';

export {
  genericResidentialClauses,
  genericResidentialClauseKeys,
} from './clauses';
export {
  genericResidentialAddendums,
  genericResidentialAddendumKeys,
} from './addendums';

/**
 * Document-level template for the generic residential construction agreement.
 * Lists clauses in canonical assembly order plus the available addendums.
 */
export const GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE: DocumentTemplate = {
  templateKey: 'GENERIC_RESIDENTIAL_CONTRACT',
  title: 'Generic Residential Construction Agreement',
  documentType: 'residential_contract',
  clauseKeys: genericResidentialClauseKeys,
  addendumKeys: genericResidentialAddendumKeys,
  version: '0.1.0',
};

/**
 * Default nationwide residential pack. Draft-only: final export is blocked
 * until an attorney-reviewed pack is active for the target jurisdiction.
 */
export const GENERIC_RESIDENTIAL_PACK: DocumentPack = {
  packKey: 'GENERIC_RESIDENTIAL',
  label: 'Generic Residential Contract Pack',
  documentType: 'residential_contract',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: false,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE.templateKey],
  addendumKeys: genericResidentialAddendumKeys,
  version: '0.1.0',
};
