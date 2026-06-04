import type {
  DocumentInput,
  DocumentRiskFactor,
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
  /**
   * Optional informational notes surfaced as `info`-severity compliance issues.
   * Does not block export or draft preview.
   */
  advisoryNotes?: string[];
}

export interface RiskProfileEvaluator {
  evaluateDerived(input: DocumentInput): DocumentRiskFactor[];
}
