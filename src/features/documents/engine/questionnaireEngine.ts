import type {
  DocumentQuestionnaire,
  DocumentType,
  QuestionnaireMode,
} from '../types';

/**
 * Phase 0.1 placeholder: returns an empty questionnaire for the requested
 * document type and mode. Question banks and project-type branching are added
 * in a later phase.
 */
export function buildQuestionnaire(
  documentType: DocumentType,
  mode: QuestionnaireMode = 'standard',
): DocumentQuestionnaire {
  return {
    documentType,
    mode,
    questions: [],
  };
}
