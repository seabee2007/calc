/** Strip non-digits and cap at 10 digits (US local number). */
export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/** Format digits as (XXX) XXX-XXXX while typing. */
export function formatUSPhoneInput(value: string): string {
  const numericValue = stripPhoneDigits(value);
  if (numericValue.length >= 6) {
    return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
  }
  if (numericValue.length >= 3) {
    return `(${numericValue.slice(0, 3)}) ${numericValue.slice(3)}`;
  }
  return numericValue;
}

/** Format stored phone for display; leaves partial/international values best-effort. */
export function formatUSPhoneNumber(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const digits = stripPhoneDigits(value);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return formatUSPhoneInput(value);
}
