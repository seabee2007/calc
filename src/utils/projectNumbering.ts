/** Auto project naming: {ST}{YY}-{NUM} {Scope summary} e.g. GA26-201 Residential house foundation */

const MIN_PROJECT_NUMBER = 200;

export function buildProjectCodePrefix(stateCode: string, date = new Date()): string {
  const st = stateCode.trim().toUpperCase();
  const yy = String(date.getFullYear()).slice(-2);
  return `${st}${yy}-`;
}

export function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract numeric suffix after prefix (e.g. GA26-201 → 201). */
export function parseProjectNumberFromName(name: string, prefix: string): number | null {
  const re = new RegExp(`^${escapeRegexLiteral(prefix)}(\\d+)\\s`, 'i');
  const m = name.trim().match(re);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function computeNextProjectNumber(
  existingNames: string[],
  prefix: string,
  startAt = MIN_PROJECT_NUMBER,
): number {
  let max = startAt - 1;
  for (const name of existingNames) {
    const n = parseProjectNumberFromName(name, prefix);
    if (n != null) max = Math.max(max, n);
  }
  return Math.max(startAt, max + 1);
}

export function normalizeScopeSummaryTitle(raw: string): string {
  let t = raw.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
  if (!t) return 'Concrete placement';
  if (t.length > 80) t = `${t.slice(0, 77).trim()}…`;
  return t;
}

export function fallbackScopeSummary(description: string): string {
  const cleaned = description
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[-•*]\s*/, '');
  if (!cleaned) return 'Concrete placement';
  const sentence = cleaned.split(/[.!?]\s/)[0]?.trim() || cleaned;
  const words = sentence.split(/\s+/).slice(0, 8).join(' ');
  return normalizeScopeSummaryTitle(words);
}

export function buildProjectDisplayName(
  prefix: string,
  projectNumber: number,
  scopeSummary: string,
): string {
  const title = normalizeScopeSummaryTitle(scopeSummary);
  return `${prefix}${projectNumber} ${title}`;
}
