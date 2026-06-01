/**
 * Contract & Document Engine - core type definitions.
 *
 * Phase 0.1: foundation only. These types describe the shape of the engine
 * but carry no business logic. They are pure TypeScript with no React or
 * Supabase dependencies so the engine can be reused across UI and server code.
 */

export type DocumentType =
  | 'residential_contract'
  | 'commercial_contract'
  | 'proposal'
  | 'change_order'
  | 'work_authorization'
  | 'time_materials_ticket'
  | 'rfi'
  | 'submittal'
  | 'daily_report'
  | 'safety_meeting'
  | 'qc_inspection'
  | 'punch_list'
  | 'closeout_package'
  | 'warranty_letter';

/**
 * Pack legal posture.
 * - draft_only: usable for preview/draft export only.
 * - attorney_review_required: jurisdiction needs review before any export.
 * - attorney_reviewed: cleared for final export.
 */
export type DocumentPackStatus =
  | 'draft_only'
  | 'attorney_review_required'
  | 'attorney_reviewed';

export type PriceModel =
  | 'fixed_price'
  | 'time_and_materials'
  | 'cost_plus';

export type ProjectType =
  | 'remodel'
  | 'repair'
  | 'concrete'
  | 'roofing'
  | 'adu'
  | 'deck'
  | 'fence'
  | 'new_construction'
  | 'insurance_restoration';

export type ClauseCategory =
  | 'master'
  | 'pricing'
  | 'payment'
  | 'change_order'
  | 'schedule'
  | 'risk'
  | 'warranty'
  | 'owner_responsibility'
  | 'contractor_responsibility'
  | 'dispute'
  | 'termination'
  | 'completion'
  | 'insurance'
  | 'site_protection'
  | 'documentation'
  | 'weather'
  | 'addendum'
  | 'state_notice';

/**
 * A single contract clause template. Field names follow the Contract &
 * Document Engine template contract: every template carries a stable `key`,
 * its owning `documentType`, applicability filters, the raw `bodyTemplate`
 * (Handlebars-style tokens), and legal-posture flags.
 */
export interface DocumentClause {
  key: string;
  title: string;
  category: ClauseCategory;
  documentType: DocumentType;
  applicableProjectTypes: ProjectType[];
  applicablePriceModels: PriceModel[];
  bodyTemplate: string;
  locked: boolean;
  attorneyReviewed: boolean;
  version: string;
}

/**
 * Addendum templates share the same shape as clauses. Their `category` is
 * always 'addendum'; they are attached to a document as optional sections.
 */
export interface DocumentAddendum {
  key: string;
  title: string;
  category: ClauseCategory;
  documentType: DocumentType;
  applicableProjectTypes: ProjectType[];
  applicablePriceModels: PriceModel[];
  bodyTemplate: string;
  locked: boolean;
  attorneyReviewed: boolean;
  version: string;
}

export interface DocumentTemplate {
  templateKey: string;
  title: string;
  documentType: DocumentType;
  clauseKeys: string[];
  addendumKeys: string[];
  version: string;
}

export interface DocumentPack {
  packKey: string;
  label: string;
  documentType: DocumentType;
  status: DocumentPackStatus;
  attorneyReviewed: boolean;
  finalExportAllowed: boolean;
  jurisdictions: string[];
  templateKeys: string[];
  addendumKeys: string[];
  version: string;
}

/**
 * A fully resolved pack: its metadata plus the concrete clause/addendum
 * catalogs and the document-level template that orders them.
 */
export interface PackCatalog {
  pack: DocumentPack;
  template: DocumentTemplate;
  clauses: DocumentClause[];
  addenda: DocumentAddendum[];
}

export type QuestionnaireMode = 'quick' | 'standard' | 'advanced';

export type QuestionType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date';

export interface QuestionOption {
  value: string;
  label: string;
}

export type AnswerScalar = string | number | boolean;

/**
 * Structured intake groups (mirrors the report's contract data model). Used to
 * organize the questionnaire and the eventual builder UI.
 */
export type IntakeGroup =
  | 'project'
  | 'parties'
  | 'property'
  | 'scope'
  | 'pricing'
  | 'payments'
  | 'schedule'
  | 'change_management'
  | 'permits'
  | 'insurance'
  | 'risk'
  | 'hoa'
  | 'warranty'
  | 'compliance'
  | 'execution';

/**
 * Conditional rule evaluated against a prior answer. The rule is satisfied when
 * the referenced answer equals (or, for multiselect answers, includes) one of
 * the provided values.
 */
export interface QuestionVisibilityRule {
  questionKey: string;
  equals: AnswerScalar[];
}

/**
 * Maps a specific answer to contract risk points. Evaluated by the risk engine
 * when the answer for this question matches `whenEquals`.
 */
export interface QuestionRiskSignal {
  whenEquals: AnswerScalar[];
  key: string;
  label: string;
  points: number;
}

export interface DocumentQuestion {
  questionKey: string;
  label: string;
  type: QuestionType;
  group: IntakeGroup;
  options?: QuestionOption[];
  /** Base requiredness when the question is visible and `requiredWhen` is absent. */
  required: boolean;
  /** Lowest questionnaire mode at which the question appears. */
  mode: QuestionnaireMode;
  /** Question is visible only when ALL of these rules are satisfied. */
  visibleWhen?: QuestionVisibilityRule[];
  /** When present, the question is required only if ALL of these rules match. */
  requiredWhen?: QuestionVisibilityRule[];
  /** Clause keys this answer can pull into the assembled document. */
  drivesClauses?: string[];
  /** Addendum keys this answer can pull into the assembled document. */
  drivesAddenda?: string[];
  /** Risk contributions evaluated by the risk engine. */
  riskSignals?: QuestionRiskSignal[];
}

export interface DocumentQuestionnaire {
  documentType: DocumentType;
  mode: QuestionnaireMode;
  questions: DocumentQuestion[];
}

export interface DocumentInput {
  documentType: DocumentType;
  packKey: string;
  answers: Record<string, unknown>;
  facts: Record<string, unknown>;
}

export type DocumentRiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface DocumentRiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface DocumentRiskScore {
  score: number;
  level: DocumentRiskLevel;
  factors: DocumentRiskFactor[];
}

export type RecommendationSeverity = 'info' | 'recommended' | 'critical';

export interface DocumentRecommendation {
  clauseKey: string;
  reason: string;
  severity: RecommendationSeverity;
  accepted?: boolean;
}

export type ComplianceSeverity = 'info' | 'warning' | 'blocker';

export interface DocumentComplianceIssue {
  code: string;
  message: string;
  severity: ComplianceSeverity;
}

export interface DocumentComplianceResult {
  compliant: boolean;
  canFinalExport: boolean;
  issues: DocumentComplianceIssue[];
  disclaimer: string;
}

export interface DocumentExportPolicy {
  allowPreview: boolean;
  allowFinalExport: boolean;
  reason?: string;
}

export interface DocumentManifest {
  documentType: DocumentType;
  packKey: string;
  packVersion: string;
  generatedAt: string;
  clauseVersions: Record<string, string>;
  addendumVersions: Record<string, string>;
  disclaimer: string;
}

export interface DocumentSection {
  clauseKey: string;
  title: string;
  body: string;
}

export interface DocumentAssemblyResult {
  documentType: DocumentType;
  packKey: string;
  title: string;
  sections: DocumentSection[];
  disclaimer: string;
  manifest: DocumentManifest;
}

/**
 * Legal disclaimer applied to every generated document during Phase 0.1.
 * Documents are draft-only until a pack is attorney reviewed.
 */
export const DRAFT_DISCLAIMER =
  'Draft document only. This document is not legal advice and should be reviewed by a qualified attorney before use.';

/** Every residential project type supported by the Generic Residential Pack. */
export const ALL_PROJECT_TYPES: ProjectType[] = [
  'remodel',
  'repair',
  'concrete',
  'roofing',
  'adu',
  'deck',
  'fence',
  'new_construction',
  'insurance_restoration',
];

/** Every price model a clause can apply to. */
export const ALL_PRICE_MODELS: PriceModel[] = [
  'fixed_price',
  'time_and_materials',
  'cost_plus',
];
