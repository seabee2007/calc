/** Parse user currency input into a numeric value (USD). */
export function parseCurrencyInput(raw: string): number | undefined {
  const numericValue = raw.replace(/[^0-9.]/g, '');
  if (!numericValue) return undefined;

  const parts = numericValue.split('.');
  let cleanValue = parts[0];
  if (parts.length > 1) {
    cleanValue += `.${parts[1].slice(0, 2)}`;
  }

  const number = parseFloat(cleanValue);
  if (!Number.isFinite(number)) return undefined;
  return number;
}

/** Format a number as USD for display. */
export function formatCurrencyDisplay(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parse and re-format raw input for blur display. */
export function formatCurrencyInputValue(raw: string): string {
  const parsed = parseCurrencyInput(raw);
  if (parsed === undefined) return '';
  return formatCurrencyDisplay(parsed);
}
