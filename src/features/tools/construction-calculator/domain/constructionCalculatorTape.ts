import type { CalculatorTapeEntry } from './constructionCalculatorTypes';

export const MAX_TAPE_ENTRIES = 50;

export function createTapeEntry(
  expression: string,
  result: string,
): CalculatorTapeEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    expression,
    result,
    timestamp: Date.now(),
  };
}

export function capTapeEntries(entries: CalculatorTapeEntry[]): CalculatorTapeEntry[] {
  if (entries.length <= MAX_TAPE_ENTRIES) return entries;
  return entries.slice(entries.length - MAX_TAPE_ENTRIES);
}

export function appendTapeEntry(
  entries: CalculatorTapeEntry[],
  expression: string,
  result: string,
): CalculatorTapeEntry[] {
  const next = [...entries, createTapeEntry(expression, result)];
  return capTapeEntries(next);
}

export function serializeTapeEntry(entry: CalculatorTapeEntry): string {
  return `${entry.expression} = ${entry.result}`;
}
