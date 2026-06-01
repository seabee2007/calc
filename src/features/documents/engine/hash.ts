import type { DocumentSection } from '../types';

/**
 * Deterministic, dependency-free FNV-1a (32-bit) string hash rendered as 8 hex
 * chars. Used to fingerprint assembled output for reproducibility checks - not
 * for security. Identical input always yields the identical hash.
 */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Hash the ordered rendered sections (clause key + body) into a stable token. */
export function hashSections(sections: DocumentSection[]): string {
  const serialized = sections
    .map((section) => `${section.clauseKey}\n${section.body}`)
    .join('\n---\n');
  return hashString(serialized);
}
