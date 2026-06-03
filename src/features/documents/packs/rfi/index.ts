import type { DocumentPack } from '../../types';
import { GENERIC_RFI_TEMPLATE } from './template';

export { rfiPackClauses, rfiPackClauseKeys } from './clauses';
export { GENERIC_RFI_TEMPLATE } from './template';
export { rfiQuestions } from './questions';

export const GENERIC_RFI_PACK: DocumentPack = {
  packKey: 'GENERIC_RFI',
  label: 'Generic RFI Pack',
  documentType: 'rfi',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_RFI_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
