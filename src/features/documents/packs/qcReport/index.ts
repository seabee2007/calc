import type { DocumentPack } from '../../types';
import { GENERIC_QC_REPORT_TEMPLATE } from './template';

export { qcReportPackClauses, qcReportPackClauseKeys } from './clauses';
export { GENERIC_QC_REPORT_TEMPLATE } from './template';
export { qcReportQuestions } from './questions';

export const GENERIC_QC_REPORT_PACK: DocumentPack = {
  packKey: 'GENERIC_QC_REPORT',
  label: 'QC Report',
  documentType: 'qc_report',
  status: 'draft_only',
  attorneyReviewed: false,
  finalExportAllowed: true,
  jurisdictions: ['US'],
  templateKeys: [GENERIC_QC_REPORT_TEMPLATE.templateKey],
  addendumKeys: [],
  version: '0.1.0',
};
