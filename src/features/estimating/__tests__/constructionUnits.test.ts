import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_UNITS,
  DEFAULT_UNIT_CODES,
  filterConstructionUnits,
  formatConstructionUnitOption,
} from '../data/constructionUnits';

describe('constructionUnits', () => {
  it('deduplicates repeated unit codes in the master list', () => {
    const eaCount = CONSTRUCTION_UNITS.filter((unit) => unit.code === 'EA').length;
    const lfCount = CONSTRUCTION_UNITS.filter((unit) => unit.code === 'LF').length;
    expect(eaCount).toBe(1);
    expect(lfCount).toBe(1);
  });

  it('formats dropdown options as code and label', () => {
    expect(formatConstructionUnitOption({ code: 'EA', label: 'Each', description: '' })).toBe(
      'EA — Each',
    );
  });

  it('returns default units first when query is empty', () => {
    const codes = filterConstructionUnits('').map((unit) => unit.code);
    expect(codes.slice(0, DEFAULT_UNIT_CODES.length)).toEqual([...DEFAULT_UNIT_CODES]);
  });

  it('matches code prefix for e and ranks EA near the top', () => {
    const codes = filterConstructionUnits('e').map((unit) => unit.code);
    expect(codes).toContain('EA');
    expect(codes.indexOf('EA')).toBeLessThan(codes.indexOf('SET'));
  });

  it('matches label text for each', () => {
    const codes = filterConstructionUnits('each').map((unit) => unit.code);
    expect(codes).toContain('EA');
  });

  it('matches square area units', () => {
    const codes = filterConstructionUnits('square').map((unit) => unit.code);
    expect(codes).toEqual(expect.arrayContaining(['SF', 'SY', 'SM', 'SI']));
  });

  it('matches yard units', () => {
    const codes = filterConstructionUnits('yard').map((unit) => unit.code);
    expect(codes).toEqual(expect.arrayContaining(['CY', 'SY', 'YD']));
  });

  it('matches hour units', () => {
    const codes = filterConstructionUnits('hour').map((unit) => unit.code);
    expect(codes).toEqual(expect.arrayContaining(['HR', 'MH']));
  });
});
