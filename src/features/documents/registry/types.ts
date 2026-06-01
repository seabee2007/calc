import type {
  DocumentInput,
  DocumentQuestion,
  DocumentRiskFactor,
  DocumentTemplate,
  DocumentType,
  QuestionnaireMode,
} from '../types';

export interface DocumentTypeDefinition {
  documentType: DocumentType;
  label: string;
  runtimeSupported: boolean;
  defaultPackKey: string;
  defaultTemplateKey: string;
}

export interface ComplianceProfile {
  requiredClauseKeys: string[];
  questionnaireModeForValidation: QuestionnaireMode;
}

export interface RiskProfileEvaluator {
  evaluateDerived(input: DocumentInput): DocumentRiskFactor[];
}
