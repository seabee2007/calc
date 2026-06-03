import type { DocumentPack } from '../../types';
import { GENERIC_SUBMITTAL_TEMPLATE } from './template';

export { submittalPackClauses, submittalPackClauseKeys } from './clauses';
export { GENERIC_SUBMITTAL_TEMPLATE } from './template';
export { submittalQuestions } from './questions';

export const GENERIC_SUBMITTAL_PACK: DocumentPack = {
  packKey: 'GENERIC_SUBMITTAL',
  label: 'Submittal Cover Sheet',
  documentType: 'submittal',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_SUBMITTAL_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
