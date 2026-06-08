import { describe, expect, it } from 'vitest';
import {
  CSI_MASTER_FORMAT,
  formatCsiDivisionLabel,
  getCsiDivision,
  getCsiDivisionOptions,
  getCsiSectionsByDivision,
  normalizeCsiSectionCode,
  validateCsiMasterFormat,
} from './index';
import type { CsiMasterFormatData } from './csiTypes';

describe('CSI MasterFormat reference layer', () => {
  it('includes all 50 divisions from 00 through 49', () => {
    expect(CSI_MASTER_FORMAT.divisions).toHaveLength(50);
    for (let divisionNumber = 0; divisionNumber <= 49; divisionNumber += 1) {
      const divisionCode = divisionNumber.toString().padStart(2, '0');
      expect(CSI_MASTER_FORMAT.divisions.some((division) => division.divisionCode === divisionCode)).toBe(
        true,
      );
    }
  });

  it('uses official titles for key divisions', () => {
    expect(getCsiDivision('03')?.title).toBe('Concrete');
    expect(getCsiDivision('28')?.title).toBe('Electronic Safety and Security');
    expect(getCsiDivision('48')?.title).toBe('Electrical Power Generation');
  });

  it('marks reserved divisions', () => {
    const reservedCodes = ['15', '16', '17', '18', '19', '20', '24', '29', '30', '36', '37', '38', '39', '47', '49'];
    for (const code of reservedCodes) {
      expect(getCsiDivision(code)?.reserved).toBe(true);
    }
    expect(getCsiDivision('03')?.reserved).toBe(false);
  });

  it('formats division labels', () => {
    expect(formatCsiDivisionLabel('03')).toBe('03 - Concrete');
  });

  it('normalizes section codes', () => {
    expect(normalizeCsiSectionCode('033000')).toBe('03 30 00');
    expect(normalizeCsiSectionCode('03-30-00')).toBe('03 30 00');
    expect(normalizeCsiSectionCode('03 30 00')).toBe('03 30 00');
  });

  it('returns curated sections by division', () => {
    const sections = getCsiSectionsByDivision('03');
    expect(sections.some((section) => section.sectionCode === '03 30 00')).toBe(true);
  });

  it('validates the bundled dataset', () => {
    expect(validateCsiMasterFormat(CSI_MASTER_FORMAT)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('fails validation for duplicate division codes', () => {
    const invalidData: CsiMasterFormatData = {
      divisions: [
        ...CSI_MASTER_FORMAT.divisions,
        {
          divisionCode: '03',
          divisionNumber: 3,
          title: 'Duplicate Concrete',
          group: 'Specifications Group',
          subgroup: 'Facility Construction Subgroup',
          reserved: false,
        },
      ],
      sections: CSI_MASTER_FORMAT.sections,
    };

    const result = validateCsiMasterFormat(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Duplicate division code "03"'))).toBe(true);
  });

  it('fails validation for invalid section code format', () => {
    const invalidData: CsiMasterFormatData = {
      divisions: CSI_MASTER_FORMAT.divisions,
      sections: [
        ...CSI_MASTER_FORMAT.sections,
        {
          sectionCode: 'bad-code',
          divisionCode: '03',
          title: 'Invalid Section',
          level: 2,
        },
      ],
    };

    const result = validateCsiMasterFormat(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('Invalid section code format'))).toBe(true);
  });

  it('fails validation when a section references an unknown division', () => {
    const invalidData: CsiMasterFormatData = {
      divisions: CSI_MASTER_FORMAT.divisions.filter((division) => division.divisionCode !== '03'),
      sections: CSI_MASTER_FORMAT.sections,
    };

    const result = validateCsiMasterFormat(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('references unknown division "03"'))).toBe(
      true,
    );
  });

  it('hides reserved divisions from default selectors', () => {
    const defaultOptions = getCsiDivisionOptions();
    const allOptions = getCsiDivisionOptions(true);

    expect(defaultOptions.some((option) => option.code === '15')).toBe(false);
    expect(allOptions.some((option) => option.code === '15')).toBe(true);
    expect(allOptions.length).toBeGreaterThan(defaultOptions.length);
  });
});

describe('activity master CSI linkage', () => {
  it('auto-populates representative master activities with CSI codes', async () => {
    const { getMasterActivityByCode } = await import('../masterActivityIndex');

    expect(getMasterActivityByCode('03-01-03')).toMatchObject({
      csiDivisionCode: '03',
      csiSectionCode: '03 30 00',
    });
    expect(getMasterActivityByCode('06-01-01')).toMatchObject({
      csiDivisionCode: '06',
      csiSectionCode: '06 10 00',
    });
    expect(getMasterActivityByCode('09-01-01')).toMatchObject({
      csiDivisionCode: '09',
      csiSectionCode: '09 20 00',
    });
    expect(getMasterActivityByCode('26-02-01')).toMatchObject({
      csiDivisionCode: '26',
      csiSectionCode: '26 05 00',
    });
  });

  it('exposes CSI context lookup for custom activities without master linkage', async () => {
    const { getMasterActivityCsiContext } = await import('../masterActivityIndex');
    expect(getMasterActivityCsiContext('99-99-99')).toEqual({});
  });
});
