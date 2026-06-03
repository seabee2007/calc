import type { DocumentPack } from '../../types';
import { GENERIC_WARRANTY_CLOSEOUT_TEMPLATE } from './template';

export { warrantyCloseoutPackClauses, warrantyCloseoutPackClauseKeys } from './clauses';
export { GENERIC_WARRANTY_CLOSEOUT_TEMPLATE } from './template';
export { warrantyCloseoutQuestions } from './questions';

export const GENERIC_WARRANTY_CLOSEOUT_PACK: DocumentPack = {
  packKey: 'GENERIC_WARRANTY_CLOSEOUT',
  label: 'Warranty / Closeout Letter',
  documentType: 'warranty_letter',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_WARRANTY_CLOSEOUT_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
