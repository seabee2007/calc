/**
 * Contract & Document Engine - public surface.
 *
 * All consumers import from this barrel only. Internal module layout
 * (engine/, templates/, packs/) is an implementation detail.
 *
 * The engine logic is real and deterministic (questionnaire, assembly,
 * compliance, risk, and rule-based recommendations). No UI, routes, Supabase,
 * or PDF export are wired up yet. The Generic Residential Pack ships real
 * clause and addendum catalogs - including concrete differentiator addenda -
 * all draft-only and not attorney reviewed.
 */

// Types (isolatedModules requires type-only re-exports).
export type {
  DocumentType,
  DocumentPackStatus,
  PriceModel,
  ProjectType,
  ClauseCategory,
  DocumentClause,
  DocumentAddendum,
  DocumentTemplate,
  DocumentPack,
  PackCatalog,
  QuestionnaireMode,
  QuestionType,
  QuestionOption,
  AnswerScalar,
  IntakeGroup,
  QuestionVisibilityRule,
  QuestionRiskSignal,
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
export { DRAFT_DISCLAIMER, ALL_PROJECT_TYPES, ALL_PRICE_MODELS } from './types';

// Engine functions.
export {
  assembleDocument,
  selectClauses,
  selectAddenda,
  buildManifest,
} from './engine/documentAssembly';
export { renderTemplate } from './engine/templateRenderer';
export {
  evaluateDocumentCompliance,
  evaluateExportPolicy,
} from './engine/complianceEngine';
export {
  buildQuestionnaire,
  isQuestionVisible,
  isQuestionRequired,
  resolveVisibleQuestions,
  findMissingRequiredAnswers,
} from './engine/questionnaireEngine';
export { generateDocumentManifest } from './engine/documentManifest';
export { scoreDocumentRisk } from './engine/riskEngine';
export { recommendDocumentClauses } from './engine/recommendationEngine';
export {
  toRenderData,
  getAnswer,
  getProjectType,
  getPriceModel,
  getAcceptedAddendumKeys,
  answerMatches,
  FACT_KEYS,
} from './engine/inputUtils';

// Packs.
export {
  GENERIC_RESIDENTIAL_PACK,
  GENERIC_RESIDENTIAL_CONTRACT_TEMPLATE,
  genericResidentialClauses,
  genericResidentialClauseKeys,
  genericResidentialAddendums,
  genericResidentialAddendumKeys,
} from './packs/genericResidential';
export {
  getPack,
  getPackCatalog,
  listPackKeys,
  DEFAULT_PACK_KEY,
} from './packs/registry';
export { residentialQuestions } from './engine/questionnaire/residentialQuestions';
export { concretePacks, concreteAddendums, concreteAddendumKeys } from './packs/concrete';
export { roofingPacks } from './packs/roofing';
export { insuranceRestorationPacks } from './packs/insuranceRestoration';
export { timeAndMaterialsPacks } from './packs/timeAndMaterials';
export { statePacks } from './packs/statePacks';

// Document-level template catalogs (per document type).
export { contractTemplates } from './templates/contracts';
export { proposalTemplates } from './templates/proposals';
export { changeOrderTemplates } from './templates/changeOrders';
export { rfiTemplates } from './templates/rfis';
export { submittalTemplates } from './templates/submittals';
export { dailyReportTemplates } from './templates/dailyReports';
export { safetyTemplates } from './templates/safety';
export { qcTemplates } from './templates/qc';
export { closeoutTemplates } from './templates/closeout';
