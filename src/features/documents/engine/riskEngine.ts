import type { DocumentInput, DocumentRiskScore } from '../types';

/**
 * Phase 0.1 placeholder: returns a baseline low-risk score with no factors.
 * The scoring model (0-100, low/medium/high/extreme) is implemented in a
 * later phase from questionnaire answers and contract facts.
 */
export function scoreDocumentRisk(_input: DocumentInput): DocumentRiskScore {
  return {
    score: 0,
    level: 'low',
    factors: [],
  };
}
