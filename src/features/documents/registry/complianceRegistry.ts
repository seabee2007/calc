import type { DocumentType } from '../types';
import type { ComplianceProfile } from './types';

const profiles: Partial<Record<DocumentType, ComplianceProfile>> = {
  residential_contract: {
    requiredClauseKeys: ['contract.title', 'scope.work'],
    questionnaireModeForValidation: 'advanced',
  },
  change_order: {
    requiredClauseKeys: ['co.title', 'co.scope', 'co.pricing_summary'],
    questionnaireModeForValidation: 'standard',
    advisoryNotes: [
      'Change orders should be approved in writing before work begins.',
      'Schedule impact should be documented even when calendar days are not added.',
      'Original contract terms remain unchanged except as modified by this change order.',
      'Emergency work should be documented with photos, notes, and timely owner notification.',
    ],
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
