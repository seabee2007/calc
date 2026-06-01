import type {
  DocumentInput,
  DocumentRiskFactor,
  DocumentRiskLevel,
  DocumentRiskScore,
} from '../types';
import { answerMatches, getAnswer, getProjectType } from './inputUtils';
import { residentialQuestions } from './questionnaire/residentialQuestions';

function classify(score: number): DocumentRiskLevel {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'extreme';
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
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
  for (const question of residentialQuestions) {
    if (!question.riskSignals) continue;
    const answer = getAnswer(input, question.questionKey);
    for (const signal of question.riskSignals) {
      if (answerMatches(answer, signal.whenEquals)) {
        factors.push({ key: signal.key, label: signal.label, points: signal.points });
      }
    }
  }

  // 2. Threshold / derived rules.
  const projectType = getProjectType(input);
  if (projectType === 'insurance_restoration') {
    factors.push({
      key: 'project.insurance_restoration',
      label: 'Insurance restoration adds carrier, adjuster, and scope-approval dependencies.',
      points: 20,
    });
  }
  if (projectType === 'concrete') {
    factors.push({
      key: 'project.concrete',
      label: 'Concrete work carries weather, cracking, and ready-mix delivery exposure.',
      points: 5,
    });
  }

  const yearBuilt = toNumber(getAnswer(input, 'yearBuilt'));
  if (yearBuilt !== undefined && yearBuilt < 1980) {
    factors.push({
      key: 'property.older_home',
      label: 'Older structures are more likely to hide code, structural, or hazardous-material issues.',
      points: 10,
    });
  }

  const contractValue =
    toNumber(getAnswer(input, 'contractPrice')) ?? toNumber(getAnswer(input, 'estimatedTotal'));
  if (contractValue !== undefined && contractValue >= 100000) {
    factors.push({
      key: 'pricing.high_value',
      label: 'Higher contract value increases financial exposure on a dispute.',
      points: 10,
    });
  }

  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  return { score, level: classify(score), factors };
}
