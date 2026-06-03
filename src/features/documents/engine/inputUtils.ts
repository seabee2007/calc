import type {
  AnswerScalar,
  DocumentInput,
  DocumentRecommendationDecision,
  PriceModel,
  ProjectType,
  QuestionnaireMode,
} from '../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../types';

const QUESTIONNAIRE_MODES: QuestionnaireMode[] = ['quick', 'standard', 'advanced'];

/** Well-known answer/fact keys the engine reads by convention. */
export const FACT_KEYS = {
  projectType: 'projectType',
  priceModel: 'priceModel',
  acceptedAddendumKeys: 'acceptedAddendumKeys',
  mode: 'mode',
  recommendationDecisions: 'recommendationDecisions',
} as const;

/**
 * Flattened view of an input for token resolution: questionnaire answers first,
 * with structured facts taking precedence on key collisions.
 */
export function toRenderData(input: DocumentInput): Record<string, unknown> {
  const base = { ...input.answers, ...input.facts };
  if (input.documentType !== 'change_order') return base;
  return { ...input.answers, ...buildChangeOrderRenderOverlay(input), ...input.facts };
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return undefined;
}

/** Coerce questionnaire currency answers; missing values become 0 for display. */
function numOrZero(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Maps flat Change Order questionnaire answers to nested template paths such as
 * `changeOrder.totalAmount`. Client-facing clauses use total only — no markup,
 * margin, or internal cost breakdown.
 */
function buildChangeOrderRenderOverlay(input: DocumentInput): Record<string, unknown> {
  const answers = input.answers;
  const totalAmount = numOrZero(answers.totalChangeOrderAmount);
  const originalContractAmount = numOrZero(answers.originalContractAmount);
  const previousApprovedTotal = numOrZero(answers.previouslyApprovedChangeOrders);
  const revisedContractValue =
    originalContractAmount + previousApprovedTotal + totalAmount;

  return {
    changeOrder: {
      displayNumber: str(answers.changeOrderNumber) ?? 'Draft',
      date: new Date().toLocaleDateString('en-US'),
      title: str(answers.changeOrderTitle) ?? 'Change Order',
      status: str(answers.status) ?? 'draft',
      requestedBy: str(answers.requestedBy),
      reasonForChange: str(answers.reasonForChange) ?? '',
      scopeDescription: str(answers.scopeOfChange) ?? '',
      addedWork: str(answers.addedWork),
      deletedWork: str(answers.deletedWork),
      exclusions: str(answers.exclusions),
      scheduleImpact: str(answers.scheduleImpact),
      additionalCalendarDays: answers.additionalCalendarDays,
      revisedCompletionDate: str(answers.revisedCompletionDate),
      totalAmount,
      originalContractAmount:
        originalContractAmount > 0 ? originalContractAmount : undefined,
      previousApprovedTotal,
      revisedContractValue: revisedContractValue > 0 ? revisedContractValue : undefined,
      approvalRequired: answers.approvalRequiredBeforeWorkStarts === true,
      customTerms: str(answers.terms),
      contractorName: str(answers.contractorName),
    },
  };
}

function readKey(input: DocumentInput, key: string): unknown {
  if (input.facts[key] !== undefined) return input.facts[key];
  return input.answers[key];
}

export function getAnswer(input: DocumentInput, key: string): unknown {
  return readKey(input, key);
}

export function getProjectType(input: DocumentInput): ProjectType | undefined {
  const value = readKey(input, FACT_KEYS.projectType);
  return (ALL_PROJECT_TYPES as string[]).includes(value as string)
    ? (value as ProjectType)
    : undefined;
}

export function getPriceModel(input: DocumentInput): PriceModel | undefined {
  const value = readKey(input, FACT_KEYS.priceModel);
  return (ALL_PRICE_MODELS as string[]).includes(value as string)
    ? (value as PriceModel)
    : undefined;
}

export function getAcceptedAddendumKeys(input: DocumentInput): string[] {
  const value = readKey(input, FACT_KEYS.acceptedAddendumKeys);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function getQuestionnaireMode(input: DocumentInput): QuestionnaireMode | undefined {
  const value = readKey(input, FACT_KEYS.mode);
  return QUESTIONNAIRE_MODES.includes(value as QuestionnaireMode)
    ? (value as QuestionnaireMode)
    : undefined;
}

export function getRecommendationDecisions(
  input: DocumentInput,
): DocumentRecommendationDecision[] {
  const value = readKey(input, FACT_KEYS.recommendationDecisions);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DocumentRecommendationDecision =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as DocumentRecommendationDecision).clauseKey === 'string' &&
      typeof (item as DocumentRecommendationDecision).accepted === 'boolean',
  );
}

/** True when `answer` matches (or, for arrays, includes) one of `equals`. */
export function answerMatches(answer: unknown, equals: AnswerScalar[]): boolean {
  if (Array.isArray(answer)) {
    return answer.some((item) => equals.includes(item as AnswerScalar));
  }
  return equals.includes(answer as AnswerScalar);
}
