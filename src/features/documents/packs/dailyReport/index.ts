import type { DocumentPack } from '../../types';
import { GENERIC_DAILY_REPORT_TEMPLATE } from './template';

export { dailyReportPackClauses, dailyReportPackClauseKeys } from './clauses';
export { GENERIC_DAILY_REPORT_TEMPLATE } from './template';
export { dailyReportQuestions } from './questions';

export const GENERIC_DAILY_REPORT_PACK: DocumentPack = {
  packKey: 'GENERIC_DAILY_REPORT',
  label: 'Daily Report',
  documentType: 'daily_report',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_DAILY_REPORT_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
