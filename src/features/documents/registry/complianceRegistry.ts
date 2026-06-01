import type { DocumentType } from '../types';
import type { ComplianceProfile } from './types';

const profiles: Partial<Record<DocumentType, ComplianceProfile>> = {
  residential_contract: {
    requiredClauseKeys: ['contract.title', 'scope.work'],
    questionnaireModeForValidation: 'advanced',
  },
};

export function getComplianceProfile(documentType: DocumentType): ComplianceProfile {
  return (
    profiles[documentType] ?? {
      requiredClauseKeys: ['contract.title', 'scope.work'],
      questionnaireModeForValidation: 'advanced',
    }
  );
}
