import type { DocumentQuestion, DocumentType } from '../types';
import { residentialQuestions } from '../engine/questionnaire/residentialQuestions';
import { changeOrderQuestions } from '../packs/changeOrder';

const banks = new Map<DocumentType, DocumentQuestion[]>([
  ['residential_contract', residentialQuestions],
  ['change_order', changeOrderQuestions],
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
