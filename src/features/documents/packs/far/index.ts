import type { DocumentPack } from '../../types';
import { GENERIC_FAR_TEMPLATE } from './template';

export { farPackClauses, farPackClauseKeys } from './clauses';
export { GENERIC_FAR_TEMPLATE } from './template';
export { farQuestions } from './questions';

export const GENERIC_FAR_PACK: DocumentPack = {
  packKey: 'GENERIC_FAR',
  label: 'Field Adjustment Request',
  documentType: 'far',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_FAR_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
