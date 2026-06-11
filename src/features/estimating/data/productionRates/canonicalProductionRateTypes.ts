export const CANONICAL_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type CanonicalConfidence = (typeof CANONICAL_CONFIDENCE_LEVELS)[number];

export interface CanonicalSourceReference {
  sourceProductionRateKey: string;
  figure: string;
  sourcePage: string;
  sourcePdfPage?: number | null;
  workElementNumber?: string | null;
  workElementLineNumber?: string | null;
  originalDescription: string;
  originalManHoursPerUnit: number;
  originalUnitOfMeasure: string;
}

export interface CanonicalProductionRateVariant {
  label: string;
  sourceProductionRateKey: string;
  manHoursPerUnit: number;
  unitOfMeasure: string;
  notes?: string[];
}

export interface CanonicalProductionRate {
  id: string;
  canonicalKey: string;
  qaStatus: 'approved';
  divisionCode: string;
  divisionName: string;
  category: string;
  canonicalTitle: string;
  canonicalDescription: string;
  unitOfMeasure: string;
  manHoursPerUnit: number;
  crewSize?: number | null;
  sourceRecordIds: string[];
  sourceReferences: CanonicalSourceReference[];
  variants: CanonicalProductionRateVariant[];
  confidence: CanonicalConfidence;
  canonicalizationNotes?: string[];
  keywords: string[];
}

export interface CanonicalizationReportBucketEntry {
  canonicalId: string;
  canonicalKey: string;
  canonicalTitle: string;
  sourceRecordIds: string[];
  confidence: CanonicalConfidence;
  notes?: string[];
}

export interface CanonicalizationReport {
  generatedAt: string;
  sourceRecordCount: number;
  canonicalRecordCount: number;
  autoMergedHighConfidence: CanonicalizationReportBucketEntry[];
  keptSeparateHighConfidence: CanonicalizationReportBucketEntry[];
  variantGroupsCreated: CanonicalizationReportBucketEntry[];
  needsHumanReview: CanonicalizationReportBucketEntry[];
  blockedFromCanonical: CanonicalizationReportBucketEntry[];
}
