/**
 * Arden Field Calculator - input guards and validators.
 *
 * Small pure helpers reused by the math modules and the keypad reducer. They
 * normalize loosely-typed numeric input and surface structured validation
 * results. No React/Supabase, no side effects.
 */

import type { FractionPrecision, ValidationResult } from './constructionCalculatorTypes';

/** The fraction precisions the calculator accepts. */
export const ALLOWED_FRACTION_PRECISIONS: FractionPrecision[] = [2, 4, 8, 16, 32, 64];

/** True when `value` is a real, finite number (rejects NaN and Infinity). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Coerce any input to a finite number, falling back when it is not. */
export function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Normalize a denominator: it must be a finite number greater than 0.
 * Returns `value` when valid, otherwise `1` (the neutral denominator).
 */
export function normalizeDenominator(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Coerce a value to be non-negative and finite (clamps negatives to 0). */
export function toNonNegative(value: number): number {
  const safe = toFiniteNumber(value, 0);
  return safe < 0 ? 0 : safe;
}

/** Type guard for a supported FractionPrecision. */
export function isFractionPrecision(value: number): value is FractionPrecision {
  return (ALLOWED_FRACTION_PRECISIONS as number[]).includes(value);
}

/**
 * Validate that `value` is finite. On success returns the number; on failure
 * returns an error describing the field (label defaults to "Value").
 */
export function validateFinite(value: number, label = 'Value'): ValidationResult {
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${label} must be a finite number.` };
  }
  return { ok: true, value };
}

/**
 * Validate a denominator (finite and > 0). On success returns the denominator;
 * on failure returns an error.
 */
export function validateDenominator(value: number): ValidationResult {
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Denominator must be a finite number.' };
  }
  if (value <= 0) {
    return { ok: false, error: 'Denominator must be greater than 0.' };
  }
  return { ok: true, value };
}

/**
 * Validate that `value` is finite and non-negative. On success returns the
 * number; on failure returns an error describing the field.
 */
export function validateNonNegative(value: number, label = 'Value'): ValidationResult {
  const finite = validateFinite(value, label);
  if (!finite.ok) return finite;
  if (value < 0) {
    return { ok: false, error: `${label} must be zero or greater.` };
  }
  return { ok: true, value };
}

/**
 * Validate a divisor for an operation that must not divide by zero. On success
 * returns the divisor; on failure returns an error.
 */
export function validateNonZero(value: number, label = 'Value'): ValidationResult {
  const finite = validateFinite(value, label);
  if (!finite.ok) return finite;
  if (value === 0) {
    return { ok: false, error: `${label} must not be zero.` };
  }
  return { ok: true, value };
}

/** @deprecated alias — use toFiniteNumber */
export const sanitizeFinite = toFiniteNumber;

/** @deprecated alias — use toNonNegative */
export const sanitizeNonNegative = toNonNegative;

export function safeDivide(numerator: number, denominator: number): number {
  const num = toFiniteNumber(numerator, 0);
  const den = toFiniteNumber(denominator, 0);
  if (den === 0) return 0;
  return num / den;
}

export function sanitizePercent(value: number): number {
  const safe = toNonNegative(value);
  return safe > 100 ? 100 : safe;
}
