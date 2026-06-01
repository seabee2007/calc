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
  | 'addendum'
  | 'state_notice';

export interface DocumentClause {
  clauseKey: string;
  title: string;
  category: ClauseCategory;
  jurisdictions: string[];
  projectTypes: string[];
  priceModels: PriceModel[];
  bodyTemplate: string;
  locked: boolean;
  attorneyReviewed: boolean;
  version: string;
}

export interface DocumentAddendum {
  addendumKey: string;
  title: string;
  bodyTemplate: string;
  jurisdictions: string[];
  projectTypes: string[];
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

/**
 * Optional conditional-display rule. When present, the question is only shown
 * if the referenced answer matches one of the provided values.
 */
export interface QuestionVisibilityRule {
  questionKey: string;
  equals: Array<string | number | boolean>;
}

export interface DocumentQuestion {
  questionKey: string;
  label: string;
  type: QuestionType;
  options?: QuestionOption[];
  required: boolean;
  mode: QuestionnaireMode;
  showIf?: QuestionVisibilityRule;
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
