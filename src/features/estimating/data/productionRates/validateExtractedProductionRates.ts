import {
  ESTIMATOR_ALLOWED_CONFIDENCE,
  PRODUCTION_RATE_CONFIDENCE_LEVELS,
  type ExtractedProductionRateFile,
  type ExtractedProductionRateRecord,
  type ExtractedProductionRateValidationError,
  type ExtractedProductionRateValidationResult,
  type ProductionRateConfidence,
  SOURCE_DOCUMENT_CODE,
} from './productionRateTypes';

function error(
  index: number,
  field: string,
  message: string,
  activityName?: string,
): ExtractedProductionRateValidationError {
  return { index, field, message, activityName };
}

function isNumericOrNull(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

export function validateExtractedProductionRateRecord(
  record: ExtractedProductionRateRecord,
  index: number,
  options?: { allowedConfidence?: readonly ProductionRateConfidence[] },
): ExtractedProductionRateValidationResult {
  const errors: ExtractedProductionRateValidationError[] = [];
  const warnings: ExtractedProductionRateValidationError[] = [];

  if (record.sourceDocumentCode !== SOURCE_DOCUMENT_CODE) {
    errors.push(error(index, 'sourceDocumentCode', `Expected ${SOURCE_DOCUMENT_CODE}`));
  }

  if (!record.division?.trim()) {
    errors.push(error(index, 'division', 'Division is required', record.activityName));
  } else if (!/^\d{2}$/.test(record.division)) {
    errors.push(error(index, 'division', 'Division must be a 2-digit CSI code', record.activityName));
  }

  if (!record.activityName?.trim()) {
    errors.push(error(index, 'activityName', 'Activity name is required'));
  }

  if (!record.unitOfMeasure?.trim()) {
    errors.push(error(index, 'unitOfMeasure', 'Unit of measure is required', record.activityName));
  }

  if (!record.sourcePage?.trim()) {
    errors.push(error(index, 'sourcePage', 'Source page is required', record.activityName));
  }

  if (!PRODUCTION_RATE_CONFIDENCE_LEVELS.includes(record.confidence)) {
    errors.push(
      error(
        index,
        'confidence',
        `Confidence must be one of: ${PRODUCTION_RATE_CONFIDENCE_LEVELS.join(', ')}`,
        record.activityName,
      ),
    );
  } else if (options?.allowedConfidence && !options.allowedConfidence.includes(record.confidence)) {
    errors.push(
      error(
        index,
        'confidence',
        `Confidence "${record.confidence}" is not allowed for this workflow stage`,
        record.activityName,
      ),
    );
  }

  if (!isNumericOrNull(record.manHoursPerUnit)) {
    errors.push(error(index, 'manHoursPerUnit', 'Man-hours per unit must be numeric or null', record.activityName));
  }

  if (record.workElementNumber && !/^\d{2}\s\d{2}\s\d{2}\.\d{2}$/.test(record.workElementNumber)) {
    warnings.push(
      error(index, 'workElementNumber', 'Work element number format looks unusual', record.activityName),
    );
  }

  if (record.workElementLineNumber && !/^\d{4}$/.test(record.workElementLineNumber)) {
    warnings.push(
      error(index, 'workElementLineNumber', 'Work element line number must be 4 digits', record.activityName),
    );
  }

  return {
    valid: errors.length === 0,
    recordCount: 1,
    errors,
    warnings,
  };
}

export function validateExtractedProductionRateFile(
  file: ExtractedProductionRateFile,
  options?: { allowedConfidence?: readonly ProductionRateConfidence[] },
): ExtractedProductionRateValidationResult {
  const errors: ExtractedProductionRateValidationError[] = [];
  const warnings: ExtractedProductionRateValidationError[] = [];

  if (!Array.isArray(file.records) || file.records.length === 0) {
    errors.push(error(-1, 'records', 'At least one record is required'));
    return { valid: false, recordCount: 0, errors, warnings };
  }

  for (let index = 0; index < file.records.length; index += 1) {
    const result = validateExtractedProductionRateRecord(file.records[index], index, options);
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

/** Throws if any record is not approved for estimator consumption. */
export function assertApprovedProductionRateFile(file: ExtractedProductionRateFile): void {
  const result = validateExtractedProductionRateFile(file, {
    allowedConfidence: ESTIMATOR_ALLOWED_CONFIDENCE,
  });
  if (!result.valid) {
    const summary = result.errors.slice(0, 5).map((e) => `[${e.index}] ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Production rate file is not approved for estimator use:\n${summary}`);
  }
}

/** Returns true when a record may be consumed by seed generation. */
export function isEstimatorSafeRecord(record: ExtractedProductionRateRecord): boolean {
  return ESTIMATOR_ALLOWED_CONFIDENCE.includes(record.confidence);
}
