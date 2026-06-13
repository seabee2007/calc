import { describe, expect, it } from 'vitest';
import {
  formatUsPhoneNumber,
  isValidUsPhoneNumber,
  normalizeUsPhoneDigits,
  stripPhoneToDigits,
} from '../phoneFormatting';

describe('phoneFormatting', () => {
  describe('stripPhoneToDigits', () => {
    it('removes non-digit characters', () => {
      expect(stripPhoneToDigits('+1 (123) 456-7890')).toBe('11234567890');
    });
  });

  describe('normalizeUsPhoneDigits', () => {
    it('strips a leading 1 from 11-digit numbers', () => {
      expect(normalizeUsPhoneDigits('11234567890')).toBe('1234567890');
    });

    it('limits output to 10 digits', () => {
      expect(normalizeUsPhoneDigits('12345678941231')).toBe('1234567894');
    });
  });

  describe('formatUsPhoneNumber', () => {
    it('formats 10 digits', () => {
      expect(formatUsPhoneNumber('1234567890')).toBe('(123) 456-7890');
    });

    it('normalizes an 11-digit number with leading 1', () => {
      expect(formatUsPhoneNumber('11234567890')).toBe('(123) 456-7890');
    });

    it('normalizes values with a +1 country code', () => {
      expect(formatUsPhoneNumber('+1 (123) 456-7890')).toBe('(123) 456-7890');
    });

    it('limits pasted overflow to the first 10 local digits', () => {
      expect(formatUsPhoneNumber('12345678941231')).toBe('(123) 456-7894');
    });

    it('returns an empty string for empty input', () => {
      expect(formatUsPhoneNumber('')).toBe('');
    });

    it('formats partial input while typing', () => {
      expect(formatUsPhoneNumber('1')).toBe('(1');
      expect(formatUsPhoneNumber('123')).toBe('(123)');
      expect(formatUsPhoneNumber('123456')).toBe('(123) 456');
    });
  });

  describe('isValidUsPhoneNumber', () => {
    it('returns true only for exactly 10 normalized digits', () => {
      expect(isValidUsPhoneNumber('1234567890')).toBe(true);
      expect(isValidUsPhoneNumber('(123) 456-7890')).toBe(true);
      expect(isValidUsPhoneNumber('123')).toBe(false);
      expect(isValidUsPhoneNumber('')).toBe(false);
    });
  });
});
