import {
  ESTIMATOR_ALLOWED_QA_STATUS,
  QA_STATUSES,
  type NormalizedProductionRateFile,
  type NormalizedProductionRateRecord,
  type ProductionRateQaStatus,
  type ProductionRateValidationError,
  type ProductionRateValidationResult,
  SOURCE_DOCUMENT_CODE,
} from './productionRateTypes';

const DOT_LEADER_RE = /\.{4,}/;

function error(
  index: number,
  field: string,
  message: string,
  record?: NormalizedProductionRateRecord,
): ProductionRateValidationError {
  return { index, field, message, id: record?.id, activityName: record?.activityName };
}

function isNumericOrNull(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

export function validateProductionRateRecord(
  record: NormalizedProductionRateRecord,
  index: number,
  options?: { expectedQaStatus?: ProductionRateQaStatus | readonly ProductionRateQaStatus[] },
): ProductionRateValidationResult {
  const errors: ProductionRateValidationError[] = [];
  const warnings: ProductionRateValidationError[] = [];

  const requiredFields: Array<keyof NormalizedProductionRateRecord> = [
    'division',
    'divisionName',
    'figure',
    'figureTitle',
    'sourcePage',
    'activityName',
    'unitOfMeasure',
  ];

  for (const field of requiredFields) {
    const value = record[field];
    if (value == null || (typeof value === 'string' && !value.trim())) {
      errors.push(error(index, field, `${field} is required`, record));
    }
  }

  if (record.sourceDocumentCode !== SOURCE_DOCUMENT_CODE) {
    errors.push(error(index, 'sourceDocumentCode', `Expected ${SOURCE_DOCUMENT_CODE}`, record));
  }

  if (DOT_LEADER_RE.test(record.figureTitle ?? '')) {
    errors.push(error(index, 'figureTitle', 'figureTitle cannot contain dot leaders', record));
  }

  if ((record.unitOfMeasure ?? '').trim().toLowerCase() === 'surface') {
    errors.push(error(index, 'unitOfMeasure', 'unitOfMeasure cannot be "surface"', record));
  }

  if (!QA_STATUSES.includes(record.qaStatus)) {
    errors.push(
      error(index, 'qaStatus', `qaStatus must be one of: ${QA_STATUSES.join(', ')}`, record),
    );
  } else if (options?.expectedQaStatus) {
    const allowed = Array.isArray(options.expectedQaStatus)
      ? options.expectedQaStatus
      : [options.expectedQaStatus];
    if (!allowed.includes(record.qaStatus)) {
      errors.push(
        error(index, 'qaStatus', `qaStatus "${record.qaStatus}" is not allowed for this stage`, record),
      );
    }
  }

  if (!isNumericOrNull(record.manHoursPerUnit)) {
    errors.push(error(index, 'manHoursPerUnit', 'manHoursPerUnit must be numeric or null', record));
  }

  if (record.qaStatus === 'approved') {
    if (record.sourcePdfPage == null) {
      errors.push(error(index, 'sourcePdfPage', 'approved records require sourcePdfPage', record));
    }
    if (record.extractionWarnings && record.extractionWarnings.length > 0) {
      errors.push(
        error(index, 'extractionWarnings', 'approved records cannot have extractionWarnings', record),
      );
    }
    const { fabricateHours, erectStripHours, cleanMoveHours, manHoursPerUnit } = record;
    if (
      manHoursPerUnit != null &&
      fabricateHours != null &&
      erectStripHours != null &&
      cleanMoveHours != null &&
      Math.abs(fabricateHours + erectStripHours + cleanMoveHours - manHoursPerUnit) > 0.001
    ) {
      errors.push(
        error(
          index,
          'manHoursPerUnit',
          'manHoursPerUnit must equal fabricate + erect/strip + clean within 0.001',
          record,
        ),
      );
    }
  }

  return { valid: errors.length === 0, recordCount: 1, errors, warnings };
}

export function validateProductionRateFile(
  file: NormalizedProductionRateFile,
  options?: { expectedQaStatus?: ProductionRateQaStatus | readonly ProductionRateQaStatus[] },
): ProductionRateValidationResult {
  const errors: ProductionRateValidationError[] = [];
  const warnings: ProductionRateValidationError[] = [];

  if (!Array.isArray(file.records) || file.records.length === 0) {
    errors.push(error(-1, 'records', 'At least one record is required'));
    return { valid: false, recordCount: 0, errors, warnings };
  }

  for (let index = 0; index < file.records.length; index += 1) {
    const result = validateProductionRateRecord(file.records[index], index, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    recordCount: file.records.length,
    errors,
    warnings,
  };
}

export function assertApprovedProductionRateFile(file: NormalizedProductionRateFile): void {
  const result = validateProductionRateFile(file, {
    expectedQaStatus: ESTIMATOR_ALLOWED_QA_STATUS,
  });
  if (!result.valid) {
    const summary = result.errors
      .slice(0, 5)
      .map((e) => `[${e.id ?? e.index}] ${e.field}: ${e.message}`)
      .join('\n');
    throw new Error(`Production rate file is not approved for estimator use:\n${summary}`);
  }
}

export function isEstimatorSafeRecord(record: NormalizedProductionRateRecord): boolean {
  return ESTIMATOR_ALLOWED_QA_STATUS.includes(record.qaStatus);
}

/** @deprecated */
export const validateExtractedProductionRateRecord = validateProductionRateRecord;
/** @deprecated */
export const validateExtractedProductionRateFile = validateProductionRateFile;
