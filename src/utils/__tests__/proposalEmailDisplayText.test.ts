import { describe, expect, it } from 'vitest';
import { getClientEmailSubjectPreview } from '../proposalNextActionEmail';
import { EM_DASH, normalizeDisplayText } from '../normalizeDisplayText';

describe('proposal email display text', () => {
  it('cleans mojibake from email subject preview', () => {
    const polluted = `Riverfront ${'\u00E2\u20AC\u201C'} Slab`;
    const subject = getClientEmailSubjectPreview('send', polluted);
    expect(subject).toBe('Proposal for Riverfront — Slab');
    expect(subject).not.toMatch(/â€/);
  });

  it('does not leave mojibake in normalized proposal titles', () => {
    const cleaned = normalizeDisplayText(`Proposal ${'\u00E2\u20AC\u201C'} Jun 12, 2026`);
    expect(cleaned).toBe(`Proposal ${EM_DASH} Jun 12, 2026`);
  });
});
