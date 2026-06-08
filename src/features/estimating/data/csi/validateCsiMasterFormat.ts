import {
  SECTION_CODE_PATTERN,
  normalizeCsiSectionCode,
} from './csiHelpers';
import type { CsiMasterFormatData, CsiMasterFormatValidationResult } from './csiTypes';

export function validateCsiMasterFormat(data: CsiMasterFormatData): CsiMasterFormatValidationResult {
  const errors: string[] = [];
  const divisionCodes = new Set<string>();
  const sectionCodes = new Set<string>();

  for (const division of data.divisions) {
    if (!/^\d{2}$/.test(division.divisionCode)) {
      errors.push(`Division code "${division.divisionCode}" must be two digits.`);
    }

    if (division.divisionNumber < 0 || division.divisionNumber > 49) {
      errors.push(
        `Division number ${division.divisionNumber} must be between 0 and 49.`,
      );
    }

    if (divisionCodes.has(division.divisionCode)) {
      errors.push(`Duplicate division code "${division.divisionCode}".`);
    }
    divisionCodes.add(division.divisionCode);

    if (division.reserved && !division.title.trim()) {
      errors.push(`Reserved division "${division.divisionCode}" must have a title.`);
    }

    if (!division.reserved && !division.title.trim()) {
      errors.push(`Non-reserved division "${division.divisionCode}" must have a title.`);
    }

    if (division.reserved !== isReservedDivisionNumber(division.divisionNumber)) {
      errors.push(
        `Division "${division.divisionCode}" reserved flag does not match expected reserved status.`,
      );
    }
  }

  for (const section of data.sections) {
    const normalizedCode = normalizeCsiSectionCode(section.sectionCode);
    if (!SECTION_CODE_PATTERN.test(normalizedCode)) {
      errors.push(`Invalid section code format "${section.sectionCode}".`);
    }

    if (!section.title.trim()) {
      errors.push(`Section "${section.sectionCode}" is missing a title.`);
    }

    if (!divisionCodes.has(section.divisionCode)) {
      errors.push(
        `Section "${section.sectionCode}" references unknown division "${section.divisionCode}".`,
      );
    }

    if (sectionCodes.has(normalizedCode)) {
      errors.push(`Duplicate section code "${normalizedCode}".`);
    }
    sectionCodes.add(normalizedCode);

    if (section.sectionCode !== normalizedCode) {
      errors.push(
        `Section code "${section.sectionCode}" must be stored in normalized form "${normalizedCode}".`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isReservedDivisionNumber(divisionNumber: number): boolean {
  return [15, 16, 17, 18, 19, 20, 24, 29, 30, 36, 37, 38, 39, 47, 49].includes(
    divisionNumber,
  );
}
