import type {
  AnswerScalar,
  DocumentInput,
  PriceModel,
  ProjectType,
} from '../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../types';

/** Well-known answer/fact keys the engine reads by convention. */
export const FACT_KEYS = {
  projectType: 'projectType',
  priceModel: 'priceModel',
  acceptedAddendumKeys: 'acceptedAddendumKeys',
} as const;

/**
 * Flattened view of an input for token resolution: questionnaire answers first,
 * with structured facts taking precedence on key collisions.
 */
export function toRenderData(input: DocumentInput): Record<string, unknown> {
  return { ...input.answers, ...input.facts };
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

/** True when `answer` matches (or, for arrays, includes) one of `equals`. */
export function answerMatches(answer: unknown, equals: AnswerScalar[]): boolean {
  if (Array.isArray(answer)) {
    return answer.some((item) => equals.includes(item as AnswerScalar));
  }
  return equals.includes(answer as AnswerScalar);
}
