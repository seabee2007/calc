/**
 * Safe recovery workflow for Adobe Chapter 5 quarantined production-rate rows.
 * Fixes write to review-fixed JSON — never directly to approved.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AdobeFinalReviewedRow } from './adobeProductionRateRowTypes';
import {
  importAdobeFinalReviewedProductionRates,
  normalizeAdobeUnit,
  type ImportAdobeResult,
} from './adobeProductionRateImport';
import {
  stripRejectedMetadata,
  type AdobeRejectedFile,
  type AdobeRejectedRecoveryFix,
  type AdobeRejectedReviewFixedFile,
  type RecoverableEditableField,
  type RejectedAdobeRecord,
} from './adobeRejectedProductionRateRecovery.shared';

export const ADOBE_REJECTED_RELATIVE_PATH =
  'data/estimating/production-rates/rejected/adobe-chapter5.rejected.json';

export const ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH =
  'data/estimating/production-rates/rejected/adobe-chapter5.review-fixed.json';

export const ADOBE_REJECTED_RECOVERY_REPORT_RELATIVE_PATH =
  'data/estimating/production-rates/rejected/adobe-chapter5.recovery-report.json';

export {
  applyRecoveryPatch,
  stripRejectedMetadata,
  LOCKED_FIELDS,
  RECOVERABLE_EDITABLE_FIELDS,
  type AdobeFinalReviewedRow,
  type AdobeRejectedFile,
  type AdobeRejectedRecoveryFix,
  type AdobeRejectedReviewFixedFile,
  type RecoverableEditableField,
  type RejectedAdobeRecord,
} from './adobeRejectedProductionRateRecovery.shared';

export interface AdobeRejectedRecoveryReport {
  generatedAt: string;
  rejectedRowCount: number;
  recoverableCount: number;
  unrecoverableCount: number;
  suggestedFixCount: number;
  byReason: Record<string, number>;
  records: Array<{
    id: string;
    rejectionReasons: string[];
    recoverable: boolean;
    unrecoverableReasons: string[];
    suggestedFix?: Partial<Pick<AdobeFinalReviewedRow, RecoverableEditableField>>;
    suggestionNotes?: string[];
  }>;
}

const UNRECOVERABLE_REASON_PATTERNS = [
  /manHoursPerUnit must be numeric and > 0/i,
  /Could not resolve figure/i,
];

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function extractItemCodeFromRow(row: AdobeFinalReviewedRow): string {
  if (row.itemCode) return collapseWhitespace(String(row.itemCode));
  const fromDescription = row.workElementDescription?.match(/\((\d{4})\)/);
  if (fromDescription) return fromDescription[1];
  if (Array.isArray(row.rawRow) && typeof row.rawRow[0] === 'string') {
    const fromRaw = row.rawRow[0].match(/\((\d{4})\)/);
    if (fromRaw) return fromRaw[1];
  }
  return '';
}

function parseItemCodeNumber(code: string): number | null {
  const parsed = parseInt(code, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatItemCode(value: number): string {
  return String(value).padStart(4, '0');
}

function rowSortKey(row: AdobeFinalReviewedRow): number {
  return row.sourceRowNumberApprox ?? Number.MAX_SAFE_INTEGER;
}

function tableSectionKey(row: AdobeFinalReviewedRow): string {
  return `${row.sourceTableFile ?? ''}::${row.sectionCode ?? ''}`;
}

export function isRecoverableRejectionReason(reason: string): boolean {
  return !UNRECOVERABLE_REASON_PATTERNS.some((pattern) => pattern.test(reason));
}

export function classifyRejectedRecord(record: RejectedAdobeRecord): {
  recoverable: boolean;
  unrecoverableReasons: string[];
} {
  const unrecoverableReasons = record.rejectionReasons.filter(
    (reason) => !isRecoverableRejectionReason(reason),
  );
  return {
    recoverable: unrecoverableReasons.length === 0,
    unrecoverableReasons,
  };
}

export function suggestItemCodeFromTableContext(
  row: AdobeFinalReviewedRow,
  contextRows: AdobeFinalReviewedRow[],
): { itemCode: string; notes: string[] } | null {
  if (extractItemCodeFromRow(row)) return null;
  if (!row.sourceTableFile || !row.sectionCode) return null;

  const key = tableSectionKey(row);
  const peers = contextRows.filter((peer) => tableSectionKey(peer) === key);
  const coded = peers
    .map((peer) => ({
      row: rowSortKey(peer),
      code: parseItemCodeNumber(extractItemCodeFromRow(peer)),
    }))
    .filter((entry): entry is { row: number; code: number } => entry.code != null)
    .sort((a, b) => a.row - b.row);

  const targetRow = rowSortKey(row);
  const prev = [...coded].reverse().find((entry) => entry.row < targetRow);
  const next = coded.find((entry) => entry.row > targetRow);

  if (!prev && next?.code === 10) {
    return { itemCode: '0010', notes: ['Suggested first item code 0010 before later coded rows.'] };
  }
  if (prev && !next) {
    return {
      itemCode: formatItemCode(prev.code + 10),
      notes: [`Suggested sequential item code after ${formatItemCode(prev.code)}.`],
    };
  }
  if (prev && next && next.code - prev.code === 20) {
    return {
      itemCode: formatItemCode(prev.code + 10),
      notes: [
        `Suggested gap item code between ${formatItemCode(prev.code)} and ${formatItemCode(next.code)}.`,
      ],
    };
  }
  return null;
}

export function suggestUnitFix(row: AdobeFinalReviewedRow): {
  unit: string;
  unitOriginal?: string;
  notes: string[];
} | null {
  const normalized = normalizeAdobeUnit(row.unit);
  if (normalized.toLowerCase() === 'surface' || row.unit?.toUpperCase() === 'SURFACE') {
    if (row.sectionCode?.startsWith('03 11 13')) {
      return {
        unit: 'SF_CONTACT_SURFACE',
        unitOriginal: 'SF of contact surface',
        notes: ['Mapped invalid "surface" unit to SF of contact surface for concrete forms context.'],
      };
    }
    return {
      unit: 'SF',
      unitOriginal: 'SF',
      notes: ['Mapped invalid "surface" unit to SF. Verify against source PDF before saving.'],
    };
  }
  return null;
}

/** Sync rate component breakdown to existing total without changing manHoursPerUnit. */
export function syncRateComponentsToManHoursTotal(
  row: AdobeFinalReviewedRow,
): AdobeFinalReviewedRow | null {
  const total = row.manHoursPerUnit;
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  const components = row.rateComponents ?? [];
  if (components.length === 0) return null;

  const fabricate = components.find((item) => item.name === 'fabricate')?.manHoursPerUnit ?? null;
  const erect =
    components.find((item) => item.name === 'erectAndStrip' || item.name === 'erectStrip')
      ?.manHoursPerUnit ?? null;
  const clean =
    components.find((item) => item.name === 'cleanAndMove' || item.name === 'cleanMove')
      ?.manHoursPerUnit ?? null;

  if (fabricate == null || erect == null || clean == null) return null;

  const adjustedClean = Number((total - fabricate - erect).toFixed(4));
  if (adjustedClean < 0) return null;

  const nextComponents = components.map((item) => {
    if (item.name === 'cleanAndMove' || item.name === 'cleanMove') {
      return { ...item, manHoursPerUnit: adjustedClean };
    }
    if (item.name === 'total') {
      return { ...item, manHoursPerUnit: total };
    }
    return item;
  });

  return {
    ...row,
    rateComponents: nextComponents,
    reviewNotes: [
      ...(row.reviewNotes ? [row.reviewNotes] : []),
      `Synced clean/move component to ${adjustedClean} so breakdown matches manHoursPerUnit ${total}.`,
    ].join(' · '),
    reviewStatus: row.reviewStatus ?? 'RECOVERY_COMPONENT_SYNC',
  };
}

export function buildRecoverySuggestions(
  rejected: RejectedAdobeRecord[],
  contextRows: AdobeFinalReviewedRow[],
): AdobeRejectedRecoveryReport {
  const byReason: Record<string, number> = {};
  const records = rejected.map((record) => {
    record.rejectionReasons.forEach((reason) => {
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    });

    const classification = classifyRejectedRecord(record);
    const suggestionNotes: string[] = [];
    const suggestedFix: Partial<Pick<AdobeFinalReviewedRow, RecoverableEditableField>> = {};

    if (classification.recoverable) {
      const itemSuggestion = suggestItemCodeFromTableContext(record, contextRows);
      if (itemSuggestion) {
        suggestedFix.itemCode = itemSuggestion.itemCode;
        suggestionNotes.push(...itemSuggestion.notes);
      }

      const unitSuggestion = suggestUnitFix(record);
      if (unitSuggestion) {
        suggestedFix.unit = unitSuggestion.unit;
        suggestedFix.unitOriginal = unitSuggestion.unitOriginal;
        suggestionNotes.push(...unitSuggestion.notes);
      }
    }

    return {
      id: record.id ?? '',
      rejectionReasons: record.rejectionReasons,
      recoverable: classification.recoverable,
      unrecoverableReasons: classification.unrecoverableReasons,
      suggestedFix: Object.keys(suggestedFix).length ? suggestedFix : undefined,
      suggestionNotes: suggestionNotes.length ? suggestionNotes : undefined,
    };
  });

  const recoverableCount = records.filter((record) => record.recoverable).length;
  const suggestedFixCount = records.filter((record) => record.suggestedFix).length;

  return {
    generatedAt: new Date().toISOString(),
    rejectedRowCount: rejected.length,
    recoverableCount,
    unrecoverableCount: rejected.length - recoverableCount,
    suggestedFixCount,
    byReason,
    records,
  };
}

export function validateRecoveryFixCandidate(
  original: RejectedAdobeRecord,
  corrected: AdobeFinalReviewedRow,
  repoRoot: string,
): { importable: boolean; rejectionReasons: string[] } {
  if (corrected.manHoursPerUnit !== original.manHoursPerUnit) {
    return {
      importable: false,
      rejectionReasons: ['Recovery fix changed manHoursPerUnit (not allowed)'],
    };
  }

  const trial = importAdobeFinalReviewedProductionRates([corrected], { repoRoot });
  if (trial.stats.approvedRowCount === 1) {
    return { importable: true, rejectionReasons: [] };
  }

  return {
    importable: false,
    rejectionReasons: trial.rejected.records[0]?.rejectionReasons ?? ['Import validation failed'],
  };
}

export function buildRecoveryFixFromSuggestion(
  rejected: RejectedAdobeRecord,
  contextRows: AdobeFinalReviewedRow[],
  repoRoot: string,
  options: { reviewedBy?: string; now?: string } = {},
): AdobeRejectedRecoveryFix | null {
  const now = options.now ?? new Date().toISOString();
  let working = stripRejectedMetadata(rejected);
  const notes: string[] = [];
  const changedFields: RecoverableEditableField[] = [];

  const itemSuggestion = suggestItemCodeFromTableContext(working, contextRows);
  if (itemSuggestion) {
    working = { ...working, itemCode: itemSuggestion.itemCode };
    changedFields.push('itemCode');
    notes.push(...itemSuggestion.notes);
  }

  const unitSuggestion = suggestUnitFix(working);
  if (unitSuggestion) {
    working = {
      ...working,
      unit: unitSuggestion.unit,
      unitOriginal: unitSuggestion.unitOriginal ?? unitSuggestion.unit,
    };
    changedFields.push('unit', 'unitOriginal');
    notes.push(...unitSuggestion.notes);
  }

  if (rejected.rejectionReasons.some((reason) => reason.includes('fabricate + erect/strip + clean'))) {
    const synced = syncRateComponentsToManHoursTotal(working);
    if (synced) {
      working = synced;
      notes.push('Synchronized rate component breakdown to existing manHoursPerUnit total.');
    }
  }

  if (changedFields.length === 0 && !notes.some((note) => note.includes('Synchronized rate component'))) {
    return null;
  }

  const validation = validateRecoveryFixCandidate(rejected, working, repoRoot);
  return {
    sourceRejectedId: rejected.id ?? '',
    originalRejectionReasons: rejected.rejectionReasons,
    recoveryStatus: validation.importable ? 'fixed' : 'still_rejected',
    recoveryNotes: [...notes, ...validation.rejectionReasons],
    correctedRow: working,
    changedFields,
    reviewedAt: now,
    reviewedBy: options.reviewedBy ?? 'recovery-script',
  };
}

export function mergeAdobeRecoveryFixesIntoRows(
  baseRows: AdobeFinalReviewedRow[],
  fixes: AdobeRejectedRecoveryFix[],
): AdobeFinalReviewedRow[] {
  const fixById = new Map(
    fixes
      .filter((fix) => fix.recoveryStatus === 'fixed')
      .map((fix) => [fix.sourceRejectedId, fix.correctedRow]),
  );

  return baseRows.map((row) => {
    const id = row.id ?? '';
    return fixById.has(id) ? { ...fixById.get(id)! } : row;
  });
}

export function loadAdobeRejectedFile(repoRoot: string): AdobeRejectedFile {
  const path = join(repoRoot, ADOBE_REJECTED_RELATIVE_PATH);
  return JSON.parse(readFileSync(path, 'utf8')) as AdobeRejectedFile;
}

export function loadAdobeRejectedReviewFixedFile(
  repoRoot: string,
): AdobeRejectedReviewFixedFile | null {
  const path = join(repoRoot, ADOBE_REJECTED_REVIEW_FIXED_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as AdobeRejectedReviewFixedFile;
}

export interface ApplyAdobeRecoveryImportResult extends ImportAdobeResult {
  appliedFixCount: number;
}

export function importAdobeWithRecoveryFixes(
  baseRows: AdobeFinalReviewedRow[],
  repoRoot: string,
  fixes: AdobeRejectedRecoveryFix[] = loadAdobeRejectedReviewFixedFile(repoRoot)?.records ?? [],
): ApplyAdobeRecoveryImportResult {
  const mergedRows = mergeAdobeRecoveryFixesIntoRows(baseRows, fixes);
  const result = importAdobeFinalReviewedProductionRates(mergedRows, { repoRoot });
  return {
    ...result,
    appliedFixCount: fixes.filter((fix) => fix.recoveryStatus === 'fixed').length,
  };
}

export function validateReviewFixedFile(
  file: AdobeRejectedReviewFixedFile,
  rejected: RejectedAdobeRecord[],
  repoRoot: string,
): string[] {
  const errors: string[] = [];
  const rejectedById = new Map(rejected.map((record) => [record.id ?? '', record]));

  for (const fix of file.records) {
    const source = rejectedById.get(fix.sourceRejectedId);
    if (!source) {
      errors.push(`Fix references unknown rejected id: ${fix.sourceRejectedId}`);
      continue;
    }

    if (fix.correctedRow.manHoursPerUnit !== source.manHoursPerUnit) {
      errors.push(`${fix.sourceRejectedId}: manHoursPerUnit changed (not allowed)`);
    }

    const validation = validateRecoveryFixCandidate(source, fix.correctedRow, repoRoot);
    if (!validation.importable && fix.recoveryStatus === 'fixed') {
      errors.push(
        `${fix.sourceRejectedId}: marked fixed but still fails import (${validation.rejectionReasons.join('; ')})`,
      );
    }
  }

  return errors;
}
