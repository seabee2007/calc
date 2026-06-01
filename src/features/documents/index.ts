/**
 * Contract & Document Engine - public surface.
 *
 * All consumers import from this barrel only. Internal module layout
 * (engine/, templates/, packs/) is an implementation detail.
 *
 * Phase 0.1: architecture foundation. Engine functions return safe placeholder
 * data; no UI, routes, Supabase, or PDF export are wired up yet.
 */

// Types (isolatedModules requires type-only re-exports).
export type {
  DocumentType,
  DocumentPackStatus,
  PriceModel,
  ClauseCategory,
  DocumentClause,
  DocumentAddendum,
  DocumentTemplate,
  DocumentPack,
  QuestionnaireMode,
  QuestionType,
  QuestionOption,
  QuestionVisibilityRule,
  DocumentQuestion,
  DocumentQuestionnaire,
  DocumentInput,
  DocumentRiskLevel,
  DocumentRiskFactor,
  DocumentRiskScore,
  RecommendationSeverity,
  DocumentRecommendation,
  ComplianceSeverity,
  DocumentComplianceIssue,
  DocumentComplianceResult,
  DocumentExportPolicy,
  DocumentManifest,
  DocumentSection,
  DocumentAssemblyResult,
} from './types';

// Constants.
export { DRAFT_DISCLAIMER } from './types';

// Engine functions.
export { assembleDocument } from './engine/documentAssembly';
export { renderTemplate } from './engine/templateRenderer';
export { evaluateDocumentCompliance } from './engine/complianceEngine';
export { buildQuestionnaire } from './engine/questionnaireEngine';
export { generateDocumentManifest } from './engine/documentManifest';
export { scoreDocumentRisk } from './engine/riskEngine';
export { recommendDocumentClauses } from './engine/recommendationEngine';

// Packs.
export { GENERIC_RESIDENTIAL_PACK } from './packs/genericResidential';
export { concretePacks } from './packs/concrete';
export { roofingPacks } from './packs/roofing';
export { insuranceRestorationPacks } from './packs/insuranceRestoration';
export { timeAndMaterialsPacks } from './packs/timeAndMaterials';
export { statePacks } from './packs/statePacks';

// Template catalogs (empty placeholders during Phase 0.1).
export { contractTemplates } from './templates/contracts';
export { proposalTemplates } from './templates/proposals';
export { changeOrderTemplates } from './templates/changeOrders';
export { rfiTemplates } from './templates/rfis';
export { submittalTemplates } from './templates/submittals';
export { dailyReportTemplates } from './templates/dailyReports';
export { safetyTemplates } from './templates/safety';
export { qcTemplates } from './templates/qc';
export { closeoutTemplates } from './templates/closeout';
