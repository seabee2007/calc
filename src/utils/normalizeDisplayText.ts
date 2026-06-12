/** Unicode em dash — safe in ASCII-only source files. */
export const EM_DASH = '\u2014';

const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['\u00E2\u20AC\u201C', EM_DASH],
  ['\u00E2\u20AC\u201D', EM_DASH],
  ['\u00E2\u20AC\u0022', EM_DASH],
  ['\u00E2\u20AC\u2013', '\u2013'],
  ['\u00E2\u20AC\u02DC', '\u2018'],
  ['\u00E2\u20AC\u2122', '\u2019'],
  ['\u00E2\u20AC\u0153', '\u201C'],
  ['\u00E2\u20AC\u009D', '\u201D'],
  ['\u00C2\u00A0', ' '],
  ['\u00C2', ''],
];

/** Fix common UTF-8 mojibake at display boundaries. Does not mutate stored data. */
export function normalizeDisplayText(text: string | null | undefined): string {
  if (text == null) return '';
  let result = String(text);
  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  return result;
}

export function formatProposalPreviewSubtitle(date: Date = new Date()): string {
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `Proposal ${EM_DASH} ${formattedDate}`;
}
