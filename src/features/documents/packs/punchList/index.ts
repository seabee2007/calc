import type { DocumentPack } from '../../types';
import { GENERIC_PUNCH_LIST_TEMPLATE } from './template';

export { punchListPackClauses, punchListPackClauseKeys } from './clauses';
export { GENERIC_PUNCH_LIST_TEMPLATE } from './template';
export { punchListQuestions } from './questions';

export const GENERIC_PUNCH_LIST_PACK: DocumentPack = {
  packKey: 'GENERIC_PUNCH_LIST',
  label: 'Punch List',
  documentType: 'punch_list',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_PUNCH_LIST_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
