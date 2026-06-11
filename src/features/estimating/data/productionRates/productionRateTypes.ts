/**
 * Normalized MCRP/NTRP Chapter 5 production-rate pipeline types.
 *
 * Workflow folders:
 *   raw → ai-reviewed → reviewed → approved | rejected
 *
 * Only `approved` records may power the estimator or generated seed bundles.
 */

import type {
  CanonicalConfidence,
  CanonicalProductionRateVariant,
  CanonicalSourceReference,
} from './canonicalProductionRateTypes';

export const SOURCE_DOCUMENT_CODE = 'MCRP 3-40D.12' as const;
export const SOURCE_DOCUMENT_TITLE = 'Construction Estimating' as const;
export const SOURCE_DOCUMENT_FULL =
  'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12' as const;
export const SOURCE_EDITION = 'October 2021, Change 1 October 2022' as const;

export const QA_STATUSES = [
  'raw',
  'needs_review',
  'ai_reviewed',
  'reviewed',
  'approved',
  'rejected',
] as const;

export type ProductionRateQaStatus = (typeof QA_STATUSES)[number];

/** Only approved records may be consumed by the estimator. */
export const ESTIMATOR_ALLOWED_QA_STATUS: readonly ProductionRateQaStatus[] = ['approved'];

export const PRIORITY_DIVISION_CODES = ['03', '06', '31', '32', '26', '22'] as const;

export const EXPANSION_DIVISION_CODES = [
  '09', '04', '05', '07', '08', '10', '13', '21', '23', '33', '34', '35', '41', '46',
] as const;

export const ALL_DIVISION_CODES = [
  ...PRIORITY_DIVISION_CODES,
  ...EXPANSION_DIVISION_CODES,
  '01', '02',
] as const;

export const ANNEX_K_WARNING =
  'Annex K covers divisions 10, 11, and 12. Verify row-level division assignment during review.';

export interface NormalizedProductionRateRecord {
  id: string;
  sourceDocumentCode: typeof SOURCE_DOCUMENT_CODE;
  sourceDocumentTitle: typeof SOURCE_DOCUMENT_TITLE;
  sourceDocumentFull: typeof SOURCE_DOCUMENT_FULL;
  sourceEdition: typeof SOURCE_EDITION;
  division: string;
  divisionName: string;
  figure: string;
  figureTitle: string;
  sourcePage: string;
  sourcePdfPage?: number | null;
  workElementNumber?: string | null;
  workElementLineNumber?: string | null;
  category?: string | null;
  subcategory?: string | null;
  activityName: string;
  description?: string | null;
  unitOfMeasure: string;
  manHoursPerUnit?: number | null;
  fabricateHours?: number | null;
  erectStripHours?: number | null;
  cleanMoveHours?: number | null;
  crewSize?: number | null;
  skilledTrade?: string | null;
  skilledCount?: number | null;
  laborerCount?: number | null;
  equipmentOperatorCount?: number | null;
  equipment?: string | null;
  figureCrewNotes?: string[] | null;
  figureNotes?: string[] | null;
  rowNotes?: string | null;
  qaStatus: ProductionRateQaStatus;
  extractionWarnings?: string[];
  /** Present on Adobe PDF Extract imports. */
  extractionSource?: 'adobe_pdf_extract' | string;
  /** Human review stage for Adobe imports. */
  reviewStatus?: 'final_reviewed' | string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedProductionRateBatchMeta {
  sourceDocumentCode: typeof SOURCE_DOCUMENT_CODE;
  sourceDocumentTitle: typeof SOURCE_DOCUMENT_TITLE;
  sourceDocumentFull: typeof SOURCE_DOCUMENT_FULL;
  sourceEdition: typeof SOURCE_EDITION;
  division: string;
  divisionName: string;
  figure: string;
  figureTitle?: string;
  extractedAt?: string;
  promotedAt?: string;
  reviewedBy?: string;
  approvedBy?: string;
  sourceCsv?: string;
  annexKWarning?: string | null;
  notes?: string;
}

export interface NormalizedProductionRateFile {
  batchMeta: NormalizedProductionRateBatchMeta;
  records: NormalizedProductionRateRecord[];
}

/** Library-facing record used by the Production Rate picker (approved only). */
export interface ProductionRateLibraryEntry {
  id: string;
  divisionCode: string;
  divisionName: string;
  figure: string;
  figureTitle: string;
  sourcePage: string;
  sourcePdfPage?: number | null;
  workElementNumber?: string | null;
  workElementLineNumber?: string | null;
  category?: string | null;
  subcategory?: string | null;
  activityName: string;
  description?: string | null;
  unitOfMeasure: string;
  manHoursPerUnit?: number | null;
  fabricateHours?: number | null;
  erectStripHours?: number | null;
  cleanMoveHours?: number | null;
  crewSize?: number | null;
  figureCrewNotes?: string[] | null;
  figureNotes?: string[] | null;
  rowNotes?: string | null;
  sourceDocumentFull: typeof SOURCE_DOCUMENT_FULL;
  sourceEdition: typeof SOURCE_EDITION;
  referenceNote: string;
  keywords: string[];
  /** Present when loaded from canonical production-rate index. */
  canonicalId?: string;
  canonicalTitle?: string;
  canonicalDescription?: string;
  variantLabel?: string;
  sourceReferences?: CanonicalSourceReference[];
  allVariants?: CanonicalProductionRateVariant[];
  confidence?: CanonicalConfidence;
}

export interface ProductionRateValidationError {
  index: number;
  field: string;
  message: string;
  id?: string;
  activityName?: string;
}

export interface ProductionRateValidationResult {
  valid: boolean;
  recordCount: number;
  errors: ProductionRateValidationError[];
  warnings: ProductionRateValidationError[];
}

export const DATA_PIPELINE_PATHS = {
  rawJson: 'data/estimating/production-rates/raw',
  needsReviewJson: 'data/estimating/production-rates/needs-review',
  reviewedJson: 'data/estimating/production-rates/reviewed',
  approvedJson: 'data/estimating/production-rates/approved',
  rejectedJson: 'data/estimating/production-rates/rejected',
  rawCsv: 'data/estimating/production-rates/raw/csv',
  generatedDir: 'src/features/estimating/data/productionRates/generated',
} as const;

/** @deprecated Use NormalizedProductionRateRecord */
export type ExtractedProductionRateRecord = NormalizedProductionRateRecord;
/** @deprecated Use NormalizedProductionRateFile */
export type ExtractedProductionRateFile = NormalizedProductionRateFile;
/** @deprecated Use ProductionRateQaStatus */
export type ProductionRateConfidence = ProductionRateQaStatus;
/** @deprecated Use ESTIMATOR_ALLOWED_QA_STATUS */
export const ESTIMATOR_ALLOWED_CONFIDENCE = ESTIMATOR_ALLOWED_QA_STATUS;
/** @deprecated Use QA_STATUSES */
export const PRODUCTION_RATE_CONFIDENCE_LEVELS = QA_STATUSES;
