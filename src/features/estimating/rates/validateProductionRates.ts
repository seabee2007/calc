/**
 * Validates reviewed production-rate entries before they are accepted into seeds or the database.
 *
 * Rules enforced:
 *   - ID must match format {divCode}-{mfSection}-{lineNumber}
 *   - masterFormatCode and workElementLineNumber must be non-empty
 *   - description must be non-empty
 *   - unit must be a recognised value
 *   - rateType must be one of the four legal values
 *   - labor_production requires manHoursPerUnit > 0
 *   - equipment_production requires equipmentHoursPerUnit > 0
 *   - weight_measure | material_quantity requires quantityPerUnit > 0
 *   - sourceFigure and sourcePage must be non-empty
 *   - directLaborOnly must be a boolean
 *   - tags must be an array
 *   - applicableActivityTypes must be a non-empty array
 *   - No duplicate IDs within the batch
 */
import type {
  RateValidationError,
  RateValidationResult,
  RateValidationWarning,
  ReviewedProductionRateEntry,
  ReviewedRateFile,
} from './manualRateTypes';
import { KNOWN_DIVISION_CODES, RECOGNISED_UNITS } from './manualRateTypes';

// Pattern: {2-digit-div}-{2-digit-part1}-{2-digit.2-digit-part2}-{4+-digit-lineNum}
// Examples: "03-15-05.96-0220", "31-23-16.13-0010", "03-11-13.65-0040"
const ID_PATTERN = /^\d{2}-\d{2}-\d{2}\.\d{2}-\d{4,}$/;

function err(id: string, field: string, message: string): RateValidationError {
  return { id, field, message };
}

function warn(id: string, field: string, message: string): RateValidationWarning {
  return { id, field, message };
}

function validateEntry(
  entry: ReviewedProductionRateEntry,
  errors: RateValidationError[],
  warnings: RateValidationWarning[],
): void {
  const { id } = entry;

  if (!id || typeof id !== 'string' || !id.trim()) {
    errors.push(err(id ?? '(missing)', 'id', 'ID is required'));
    return;
  }

  if (!ID_PATTERN.test(id)) {
    errors.push(
      err(id, 'id', `ID "${id}" does not match expected format {divCode}-{mfSection}-{lineNumber} (e.g. "03-15-05.96-0220")`),
    );
  }

  const divCode = id.split('-')[0];
  if (divCode && !KNOWN_DIVISION_CODES.has(divCode)) {
    warnings.push(warn(id, 'id', `Division code "${divCode}" is not in the known division list`));
  }

  if (!entry.masterFormatCode?.trim()) {
    errors.push(err(id, 'masterFormatCode', 'masterFormatCode is required'));
  }

  if (!entry.workElementLineNumber?.trim()) {
    errors.push(err(id, 'workElementLineNumber', 'workElementLineNumber is required'));
  }

  if (!entry.description?.trim()) {
    errors.push(err(id, 'description', 'description is required'));
  }

  if (!entry.unit?.trim()) {
    errors.push(err(id, 'unit', 'unit is required'));
  } else if (!RECOGNISED_UNITS.has(entry.unit)) {
    warnings.push(warn(id, 'unit', `Unit "${entry.unit}" is not in the recognised unit list`));
  }

  const legalRateTypes = new Set(['labor_production', 'equipment_production', 'weight_measure', 'material_quantity']);
  if (!legalRateTypes.has(entry.rateType)) {
    errors.push(err(id, 'rateType', `rateType "${entry.rateType}" is not valid`));
  } else {
    switch (entry.rateType) {
      case 'labor_production':
        if (entry.manHoursPerUnit == null || !Number.isFinite(entry.manHoursPerUnit) || entry.manHoursPerUnit <= 0) {
          errors.push(err(id, 'manHoursPerUnit', 'labor_production rate requires manHoursPerUnit > 0'));
        }
        break;
      case 'equipment_production':
        if (
          entry.equipmentHoursPerUnit == null ||
          !Number.isFinite(entry.equipmentHoursPerUnit) ||
          entry.equipmentHoursPerUnit <= 0
        ) {
          errors.push(err(id, 'equipmentHoursPerUnit', 'equipment_production rate requires equipmentHoursPerUnit > 0'));
        }
        break;
      case 'weight_measure':
      case 'material_quantity':
        if (entry.quantityPerUnit == null || !Number.isFinite(entry.quantityPerUnit) || entry.quantityPerUnit <= 0) {
          errors.push(err(id, 'quantityPerUnit', `${entry.rateType} rate requires quantityPerUnit > 0`));
        }
        break;
    }
  }

  if (!entry.sourceFigure?.trim()) {
    errors.push(err(id, 'sourceFigure', 'sourceFigure is required'));
  }

  if (!entry.sourcePage?.trim()) {
    errors.push(err(id, 'sourcePage', 'sourcePage is required'));
  }

  if (typeof entry.directLaborOnly !== 'boolean') {
    errors.push(err(id, 'directLaborOnly', 'directLaborOnly must be a boolean'));
  }

  if (!Array.isArray(entry.tags)) {
    errors.push(err(id, 'tags', 'tags must be an array'));
  }

  if (!Array.isArray(entry.applicableActivityTypes) || entry.applicableActivityTypes.length === 0) {
    warnings.push(warn(id, 'applicableActivityTypes', 'applicableActivityTypes is empty — rate will not link to any assembly'));
  }
}

/**
 * Validates all entries in a reviewed rate file.
 * Returns a detailed result with per-field errors and warnings.
 */
export function validateReviewedRateFile(file: ReviewedRateFile): RateValidationResult {
  const errors: RateValidationError[] = [];
  const warnings: RateValidationWarning[] = [];

  if (!file.batchMeta?.sourceManual?.trim()) {
    errors.push(err('(batch)', 'batchMeta.sourceManual', 'batchMeta.sourceManual is required'));
  }
  if (!file.batchMeta?.divisionCode?.trim()) {
    errors.push(err('(batch)', 'batchMeta.divisionCode', 'batchMeta.divisionCode is required'));
  }

  if (!Array.isArray(file.rates) || file.rates.length === 0) {
    errors.push(err('(batch)', 'rates', 'rates array is required and must be non-empty'));
    return { valid: false, errors, warnings, validCount: 0, errorCount: errors.length };
  }

  const seenIds = new Set<string>();
  for (const entry of file.rates) {
    const idKey = entry.id ?? '(missing)';
    if (seenIds.has(idKey)) {
      errors.push(err(idKey, 'id', `Duplicate ID "${idKey}" in batch`));
    }
    seenIds.add(idKey);
    validateEntry(entry, errors, warnings);
  }

  const errorCount = errors.length;
  return {
    valid: errorCount === 0,
    errors,
    warnings,
    validCount: file.rates.length,
    errorCount,
  };
}

/**
 * Validates an array of raw rate entries without batch metadata.
 * Useful for testing individual entries.
 */
export function validateRateEntries(entries: ReviewedProductionRateEntry[]): RateValidationResult {
  const errors: RateValidationError[] = [];
  const warnings: RateValidationWarning[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const idKey = entry.id ?? '(missing)';
    if (seenIds.has(idKey)) {
      errors.push(err(idKey, 'id', `Duplicate ID "${idKey}"`));
    }
    seenIds.add(idKey);
    validateEntry(entry, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validCount: entries.length,
    errorCount: errors.length,
  };
}
