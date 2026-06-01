import type {
  DocumentComplianceIssue,
  DocumentComplianceResult,
  DocumentExportPolicy,
  DocumentInput,
} from '../types';
import { DRAFT_DISCLAIMER } from '../types';
import { DEFAULT_PACK_KEY, getPackCatalog } from '../packs/registry';
import { getPriceModel, getProjectType, toRenderData } from './inputUtils';
import { selectClauses } from './documentAssembly';
import { getComplianceProfile } from '../registry/complianceRegistry';
import { buildQuestionnaire, findMissingRequiredAnswers } from './questionnaireEngine';

/**
 * Resolve the export policy for an input. The Generic Residential Pack is
 * draft-only: preview is always allowed, but final export stays blocked until
 * an attorney-reviewed pack is active and no blocking issues remain.
 */
export function evaluateExportPolicy(
  input: DocumentInput,
  hasBlocker = false,
): DocumentExportPolicy {
  const catalog = getPackCatalog(input.packKey) ?? getPackCatalog(DEFAULT_PACK_KEY);
  if (!catalog) {
    return {
      allowPreview: true,
      allowFinalExport: false,
      reason: `Unknown pack "${input.packKey}". Preview only.`,
    };
  }

  const { pack } = catalog;
  const allowFinalExport =
    pack.finalExportAllowed && pack.attorneyReviewed && !hasBlocker;

  let reason: string | undefined;
  if (!allowFinalExport) {
    if (hasBlocker) {
      reason = 'Resolve blocking compliance issues before final export.';
    } else if (!pack.attorneyReviewed) {
      reason =
        pack.status === 'attorney_review_required'
          ? `${pack.label} contains locked statutory notices that require attorney review for ${pack.jurisdictions.join(', ')} before final export.`
          : `${pack.label} is draft-only. Final export requires an attorney-reviewed pack for the jurisdiction.`;
    } else {
      reason = 'Final export is not enabled for this pack.';
    }
  }

  return { allowPreview: true, allowFinalExport, reason };
}

/**
 * Evaluate draft/final eligibility. Missing recommended fields are warnings
 * (drafts may contain blanks); missing required clauses are blockers. Generic
 * packs never unlock final export here.
 */
export function evaluateDocumentCompliance(
  input: DocumentInput,
): DocumentComplianceResult {
  const issues: DocumentComplianceIssue[] = [];
  const catalog = getPackCatalog(input.packKey) ?? getPackCatalog(DEFAULT_PACK_KEY);

  if (!catalog) {
    issues.push({
      code: 'unknown_pack',
      message: `No catalog registered for pack "${input.packKey}".`,
      severity: 'blocker',
    });
    return {
      compliant: false,
      canFinalExport: false,
      issues,
      disclaimer: DRAFT_DISCLAIMER,
    };
  }

  const answers = toRenderData(input);

  // Missing-field checks (warnings: a draft may still be generated).
  const profile = getComplianceProfile(input.documentType);
  const questionnaire = buildQuestionnaire(
    input.documentType,
    profile.questionnaireModeForValidation,
  );
  for (const missing of findMissingRequiredAnswers(questionnaire, answers)) {
    issues.push({
      code: `missing_field:${missing}`,
      message: `Required field "${missing}" has not been provided.`,
      severity: 'warning',
    });
  }

  // Required clause presence (blocker: the document would be invalid).
  const projectType = getProjectType(input);
  const priceModel = getPriceModel(input);
  const selectedKeys = new Set(
    selectClauses(catalog, projectType, priceModel, answers).map((clause) => clause.key),
  );
  for (const requiredKey of profile.requiredClauseKeys) {
    if (!selectedKeys.has(requiredKey)) {
      issues.push({
        code: `missing_required_clause:${requiredKey}`,
        message: `Required clause "${requiredKey}" is not present in the assembled document.`,
        severity: 'blocker',
      });
    }
  }

  // Legal-posture: attorney-review-required packs surface as a warning, plain
  // draft-only packs as info. Neither blocks draft preview.
  if (!catalog.pack.attorneyReviewed) {
    if (catalog.pack.status === 'attorney_review_required') {
      issues.push({
        code: 'attorney_review_required',
        message: `${catalog.pack.label} includes locked statutory notices for ${catalog.pack.jurisdictions.join(', ')} that require attorney review before any export. Notice blocks are placeholders pending verified text.`,
        severity: 'warning',
      });
    } else {
      issues.push({
        code: 'draft_only',
        message: `${catalog.pack.label} produces draft documents only. Have a qualified attorney review before use.`,
        severity: 'info',
      });
    }
  }

  const hasBlocker = issues.some((issue) => issue.severity === 'blocker');
  const policy = evaluateExportPolicy(input, hasBlocker);

  return {
    compliant: !hasBlocker,
    canFinalExport: policy.allowFinalExport,
    issues,
    disclaimer: DRAFT_DISCLAIMER,
  };
}
