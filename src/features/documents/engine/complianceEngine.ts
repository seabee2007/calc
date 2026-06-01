import type { DocumentComplianceResult, DocumentInput } from '../types';
import { DRAFT_DISCLAIMER } from '../types';

/**
 * Phase 0.1 placeholder: every document is treated as a compliant draft that
 * is blocked from final export. State-pack and attorney-review gating is added
 * in a later phase.
 */
export function evaluateDocumentCompliance(
  _input: DocumentInput,
): DocumentComplianceResult {
  return {
    compliant: true,
    canFinalExport: false,
    issues: [],
    disclaimer: DRAFT_DISCLAIMER,
  };
}
