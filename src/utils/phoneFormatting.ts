/** Remove all non-digit characters from a phone value. */
export function stripPhoneToDigits(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.replace(/\D/g, '');
}

/** Normalize to at most 10 U.S. local digits, stripping a leading country code 1. */
export function normalizeUsPhoneDigits(value: string): string {
  let digits = stripPhoneToDigits(value);
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Format a phone value for display while typing or after paste. */
export function formatUsPhoneNumber(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '';
  }
  const digits = normalizeUsPhoneDigits(value);
  if (digits.length === 0) {
    return '';
  }
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length === 3) {
    return `(${digits})`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** True only when the normalized value contains exactly 10 digits. */
export function isValidUsPhoneNumber(value: string): boolean {
  return normalizeUsPhoneDigits(value).length === 10;
}
