import { describe, expect, it } from 'vitest';
import {
  CSI_DIVISIONS,
  getCsiDivisionByCode,
  getCsiDivisionLabel,
  getCsiDivisionOptions,
  isKnownCsiDivision,
  normalizeCsiDivisionCode,
} from '../domain/csiDivisions';

const REQUIRED_CODES = [
  '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '21', '22', '23', '25', '26',
  '27', '28', '31', '32', '33', '34', '35', '40', '41', '42',
  '43', '44', '45', '46', '48',
] as const;

describe('csiDivisions', () => {
  it('includes all required CSI divisions in the catalog', () => {
    const codes = CSI_DIVISIONS.map((division) => division.code);
    expect(codes).toHaveLength(REQUIRED_CODES.length);
    for (const code of REQUIRED_CODES) {
      expect(codes).toContain(code);
    }
  });

  it('returns Concrete for division 03', () => {
    const division = getCsiDivisionByCode('03');
    expect(division).toBeDefined();
    expect(division?.name).toBe('Concrete');
    expect(division?.label).toBe('03 - Concrete');
  });

  it('returns formatted label for known division codes', () => {
    expect(getCsiDivisionLabel('03')).toBe('03 - Concrete');
    expect(getCsiDivisionLabel('26')).toBe('26 - Electrical');
  });

  it('safely falls back for unknown division codes', () => {
    expect(getCsiDivisionByCode('99')).toBeUndefined();
    expect(getCsiDivisionLabel('99')).toBe('99');
    expect(getCsiDivisionLabel('CUSTOM_DIV')).toBe('CUSTOM_DIV');
    expect(isKnownCsiDivision('99')).toBe(false);
    expect(getCsiDivisionLabel(null)).toBe('');
    expect(getCsiDivisionLabel('')).toBe('');
  });

  it('normalizes shorthand and label-shaped division values', () => {
    expect(normalizeCsiDivisionCode('3')).toBe('03');
    expect(normalizeCsiDivisionCode('03')).toBe('03');
    expect(normalizeCsiDivisionCode('03 - Concrete')).toBe('03');
    expect(normalizeCsiDivisionCode('  26 - Electrical  ')).toBe('26');
    expect(normalizeCsiDivisionCode('')).toBe('');
    expect(normalizeCsiDivisionCode('CUSTOM')).toBe('CUSTOM');
  });

  it('returns sorted division options', () => {
    const options = getCsiDivisionOptions();
    expect(options).toHaveLength(REQUIRED_CODES.length);
    expect(options[0].code).toBe('00');
    expect(options[options.length - 1].code).toBe('48');

    const codes = options.map((option) => option.code);
    const sorted = [...codes].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    expect(codes).toEqual(sorted);

    for (const option of options) {
      expect(option.label).toBe(`${option.code} - ${option.name}`);
    }
  });
});
