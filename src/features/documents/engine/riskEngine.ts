import type {
  DocumentInput,
  DocumentRiskFactor,
  DocumentRiskLevel,
  DocumentRiskScore,
} from '../types';
import { evaluateDerivedRisk, getDeclarativeQuestions } from '../registry/riskRegistry';
import { answerMatches, getAnswer } from './inputUtils';

function classify(score: number): DocumentRiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'extreme';
}

/**
 * Deterministic, rule-based contract risk score (0-100).
 *
 * Two sources contribute:
 *   1. Declarative `riskSignals` on questionnaire answers (matched by value).
 *   2. Threshold / derived rules that cannot be expressed as simple equality
 *      (project type, age of structure, contract value).
 *
 * The score is the clamped sum of all triggered factors. AI-assisted scoring
 * can layer on top later; this baseline is fully reproducible.
 */
export function scoreDocumentRisk(input: DocumentInput): DocumentRiskScore {
  const factors: DocumentRiskFactor[] = [];

  // 1. Declarative signals from the question bank.
  for (const question of getDeclarativeQuestions(input.documentType)) {
    if (!question.riskSignals) continue;
    const answer = getAnswer(input, question.questionKey);
    for (const signal of question.riskSignals) {
      if (answerMatches(answer, signal.whenEquals)) {
        factors.push({ key: signal.key, label: signal.label, points: signal.points });
      }
    }
  }

  // 2. Threshold / derived rules from the risk registry.
  factors.push(...evaluateDerivedRisk(input));

  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  return { score, level: classify(score), factors };
}
