/**
 * Types for the MCRP/NTRP Chapter 5 production-rate extraction pipeline.
 *
 * Pipeline stages:
 *   PDF → raw CSV → raw JSON (confidence: raw | needs_review)
 *        → reviewed JSON (confidence: reviewed)
 *        → approved JSON (confidence: approved)
 *        → TypeScript seeds / optional Supabase SQL
 *
 * Raw and needs_review records must never be consumed by the production estimator.
 */

export const SOURCE_DOCUMENT_CODE = 'MCRP 3-40D.12' as const;

export const SOURCE_DOCUMENT_TITLE = 'Construction Estimating' as const;

export const SOURCE_DOCUMENT_FULL =
  'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12' as const;

export const SOURCE_EDITION = 'October 2021, Change 1 October 2022' as const;

export const PRODUCTION_RATE_CONFIDENCE_LEVELS = [
  'raw',
  'needs_review',
  'reviewed',
  'approved',
] as const;

export type ProductionRateConfidence = (typeof PRODUCTION_RATE_CONFIDENCE_LEVELS)[number];

/** Workflow stages that may feed seed generation. */
export const ESTIMATOR_ALLOWED_CONFIDENCE: readonly ProductionRateConfidence[] = ['approved'];

export interface ExtractedProductionRateRecord {
  sourceDocumentCode: typeof SOURCE_DOCUMENT_CODE;
  division: string;
  divisionName: string;
  figure: string;
  figureTitle?: string | null;
  workElementNumber?: string | null;
  workElementLineNumber?: string | null;
  activityName: string;
  description?: string | null;
  unitOfMeasure: string;
  manHoursPerUnit?: number | null;
  crewSize?: number | null;
  skilledTrade?: string | null;
  laborerCount?: number | null;
  equipment?: string | null;
  notes?: string | null;
  sourcePage: string;
  sourcePdfPage?: number | null;
  confidence: ProductionRateConfidence;
  fabricateHours?: number | null;
  erectStripHours?: number | null;
  cleanMoveHours?: number | null;
  extractionWarnings?: string[];
}

export interface ExtractedProductionRateBatchMeta {
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
  notes?: string;
}

export interface ExtractedProductionRateFile {
  batchMeta: ExtractedProductionRateBatchMeta;
  records: ExtractedProductionRateRecord[];
}

export interface ExtractedProductionRateValidationError {
  index: number;
  field: string;
  message: string;
  activityName?: string;
}

export interface ExtractedProductionRateValidationResult {
  valid: boolean;
  recordCount: number;
  errors: ExtractedProductionRateValidationError[];
  warnings: ExtractedProductionRateValidationError[];
}

/** Priority rollout divisions for initial extraction. */
export const PRIORITY_DIVISION_CODES = ['03', '06', '31', '32', '26', '22'] as const;

export const PRIORITY_DIVISION_NAMES: Record<(typeof PRIORITY_DIVISION_CODES)[number], string> = {
  '03': 'Concrete',
  '06': 'Wood, Plastics, and Composites',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '26': 'Electrical',
  '22': 'Plumbing',
};

export const DATA_PIPELINE_PATHS = {
  rawJson: 'data/estimating/production-rates/raw',
  reviewedJson: 'data/estimating/production-rates/reviewed',
  approvedJson: 'data/estimating/production-rates/approved',
  rawCsv: 'data/estimating/production-rates/raw/csv',
  generatedSeeds: 'src/features/estimating/data/generated',
  supabaseSeedSql: 'supabase/seeds/production_rates',
} as const;
