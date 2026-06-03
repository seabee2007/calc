import type { DocumentQuestion, DocumentType } from '../types';
import { residentialQuestions } from '../engine/questionnaire/residentialQuestions';
import { changeOrderQuestions } from '../packs/changeOrder';
import { rfiQuestions } from '../packs/rfi';
import { submittalQuestions } from '../packs/submittal';
import { dailyReportQuestions } from '../packs/dailyReport';
import { qcReportQuestions } from '../packs/qcReport';
import { warrantyCloseoutQuestions } from '../packs/warrantyCloseout';
import { punchListQuestions } from '../packs/punchList';

const banks = new Map<DocumentType, DocumentQuestion[]>([
  ['residential_contract', residentialQuestions],
  ['change_order', changeOrderQuestions],
  ['rfi', rfiQuestions],
  ['submittal', submittalQuestions],
  ['daily_report', dailyReportQuestions],
  ['qc_report', qcReportQuestions],
  ['warranty_letter', warrantyCloseoutQuestions],
  ['punch_list', punchListQuestions],
]);

export function registerQuestionBank(documentType: DocumentType, questions: DocumentQuestion[]): void {
  banks.set(documentType, questions);
}

export function getQuestions(documentType: DocumentType): DocumentQuestion[] {
  return banks.get(documentType) ?? [];
}

export function listQuestionnaireTypes(): DocumentType[] {
  return [...banks.keys()];
}
