import type {
  DocumentQuestion,
  DocumentQuestionnaire,
  DocumentType,
  QuestionnaireMode,
  QuestionVisibilityRule,
} from '../types';
import { answerMatches } from './inputUtils';
import { residentialQuestions } from './questionnaire/residentialQuestions';

const MODE_RANK: Record<QuestionnaireMode, number> = {
  quick: 0,
  standard: 1,
  advanced: 2,
};

const QUESTION_BANKS: Partial<Record<DocumentType, DocumentQuestion[]>> = {
  residential_contract: residentialQuestions,
};

function rulesSatisfied(
  rules: QuestionVisibilityRule[] | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every((rule) => answerMatches(answers[rule.questionKey], rule.equals));
}

/**
 * Build the questionnaire for a document type at the requested complexity mode.
 * Questions are included when their declared mode is at or below the requested
 * mode (quick is the smallest set, advanced the largest).
 */
export function buildQuestionnaire(
  documentType: DocumentType,
  mode: QuestionnaireMode = 'standard',
): DocumentQuestionnaire {
  const bank = QUESTION_BANKS[documentType] ?? [];
  const limit = MODE_RANK[mode];
  const questions = bank.filter((question) => MODE_RANK[question.mode] <= limit);
  return { documentType, mode, questions };
}

/** A question is visible when ALL of its `visibleWhen` rules are satisfied. */
export function isQuestionVisible(
  question: DocumentQuestion,
  answers: Record<string, unknown>,
): boolean {
  return rulesSatisfied(question.visibleWhen, answers);
}

/**
 * Effective requiredness: a question with `requiredWhen` is required only when
 * those rules match; otherwise its base `required` flag applies. Hidden
 * questions are never required.
 */
export function isQuestionRequired(
  question: DocumentQuestion,
  answers: Record<string, unknown>,
): boolean {
  if (!isQuestionVisible(question, answers)) return false;
  if (question.requiredWhen) return rulesSatisfied(question.requiredWhen, answers);
  return question.required;
}

/** Questions currently visible given the answers collected so far. */
export function resolveVisibleQuestions(
  questionnaire: DocumentQuestionnaire,
  answers: Record<string, unknown>,
): DocumentQuestion[] {
  return questionnaire.questions.filter((question) => isQuestionVisible(question, answers));
}

/**
 * Keys of questions that are visible, effectively required, and unanswered.
 * Used by the compliance engine for missing-field checks.
 */
export function findMissingRequiredAnswers(
  questionnaire: DocumentQuestionnaire,
  answers: Record<string, unknown>,
): string[] {
  return questionnaire.questions
    .filter((question) => isQuestionRequired(question, answers))
    .filter((question) => {
      const value = answers[question.questionKey];
      return value === undefined || value === null || value === '';
    })
    .map((question) => question.questionKey);
}
