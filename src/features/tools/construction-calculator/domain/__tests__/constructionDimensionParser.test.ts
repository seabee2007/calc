import { describe, expect, it } from 'vitest';
import { parseConstructionDimension } from '../constructionDimensionParser';

describe('parseConstructionDimension', () => {
  it('parses feet inches fraction with quotes', () => {
    const v = parseConstructionDimension(`9' 3 1/2"`);
    expect(v).not.toBeNull();
    expect(v!.decimalInches).toBeCloseTo(9 * 12 + 3.5, 4);
  });

  it('parses feet/in word form', () => {
    const v = parseConstructionDimension('9 ft 3 in');
    expect(v!.decimalInches).toBeCloseTo(111, 4);
  });

  it('parses dash separator feet-inches', () => {
    const v = parseConstructionDimension('9-3');
    expect(v!.decimalInches).toBeCloseTo(111, 4);
  });

  it('parses dash with fraction', () => {
    const v = parseConstructionDimension('9-3 1/2');
    expect(v!.decimalInches).toBeCloseTo(111.5, 4);
  });

  it('parses fraction inches only', () => {
    const v = parseConstructionDimension('4 1/2"');
    expect(v!.decimalInches).toBeCloseTo(4.5, 4);
  });

  it('parses bare inches with quote', () => {
    const v = parseConstructionDimension('112"');
    expect(v!.decimalInches).toBe(112);
  });

  it('parses decimal feet', () => {
    const v = parseConstructionDimension('9.5 ft');
    expect(v!.decimalInches).toBeCloseTo(114, 4);
  });

  it('parses leading-dot decimal feet', () => {
    const v = parseConstructionDimension('.5 ft');
    expect(v!.decimalInches).toBeCloseTo(6, 4);
  });

  it('parses decimal inches', () => {
    const v = parseConstructionDimension('9.875 in');
    expect(v!.decimalInches).toBeCloseTo(9.875, 4);
  });

  it('parses case-insensitive units', () => {
    const v = parseConstructionDimension('10.5 FT');
    expect(v!.decimalInches).toBeCloseTo(126, 4);
  });

  it('returns null for empty input', () => {
    expect(parseConstructionDimension('')).toBeNull();
    expect(parseConstructionDimension('   ')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseConstructionDimension('abc')).toBeNull();
  });
});
