export function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
}

export function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(/,/g, '');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}

export function positiveOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
