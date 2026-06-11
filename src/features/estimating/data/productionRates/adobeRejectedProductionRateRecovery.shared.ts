import type { AdobeFinalReviewedRow } from './adobeProductionRateRowTypes';

export type { AdobeFinalReviewedRow };

export const RECOVERABLE_EDITABLE_FIELDS = [
  'itemCode',
  'unit',
  'unitOriginal',
  'sectionTitle',
  'workElementDescription',
  'sectionCode',
  'division',
  'divisionName',
  'sourceTableFile',
  'sourcePageNumberApprox',
  'sourceAdobePageIndex',
] as const;

export type RecoverableEditableField = (typeof RECOVERABLE_EDITABLE_FIELDS)[number];

export const LOCKED_FIELDS = ['manHoursPerUnit', 'rateComponents', 'rateType'] as const;

export type RejectedAdobeRecord = AdobeFinalReviewedRow & {
  rejectionReasons: string[];
};

export interface AdobeRejectedFile {
  generatedAt: string;
  sourceFile: string;
  inputRowCount: number;
  rejectedRowCount: number;
  records: RejectedAdobeRecord[];
}

export interface AdobeRejectedRecoveryFix {
  sourceRejectedId: string;
  originalRejectionReasons: string[];
  recoveryStatus: 'fixed' | 'still_rejected' | 'unrecoverable';
  recoveryNotes: string[];
  correctedRow: AdobeFinalReviewedRow;
  changedFields: RecoverableEditableField[];
  reviewedAt: string;
  reviewedBy?: string;
}

export interface AdobeRejectedReviewFixedFile {
  schemaVersion: '1.0.0';
  generatedAt: string;
  sourceRejectedFile: string;
  fixCount: number;
  records: AdobeRejectedRecoveryFix[];
}

export function stripRejectedMetadata(row: RejectedAdobeRecord): AdobeFinalReviewedRow {
  const { rejectionReasons: _reasons, ...rest } = row;
  return rest;
}

export function applyRecoveryPatch(
  base: AdobeFinalReviewedRow,
  patch: Partial<AdobeFinalReviewedRow>,
): { row: AdobeFinalReviewedRow; changedFields: RecoverableEditableField[] } {
  for (const field of LOCKED_FIELDS) {
    if (
      field in patch &&
      patch[field as keyof AdobeFinalReviewedRow] !== base[field as keyof AdobeFinalReviewedRow]
    ) {
      throw new Error(`Recovery patch may not modify locked field: ${field}`);
    }
  }

  const changedFields: RecoverableEditableField[] = [];
  const next: AdobeFinalReviewedRow = { ...base };

  for (const field of RECOVERABLE_EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === undefined) continue;
    if (base[field] !== value) {
      changedFields.push(field);
    }
    (next as Record<string, unknown>)[field] = value;
  }

  return { row: next, changedFields };
}
