import { describe, expect, it } from 'vitest';
import {
  EM_DASH,
  formatProposalPreviewSubtitle,
  normalizeDisplayText,
} from '../normalizeDisplayText';

describe('normalizeDisplayText', () => {
  it('converts em dash mojibake to an em dash', () => {
    const polluted = `Proposal ${'\u00E2\u20AC\u201C'} Jun 12, 2026`;
    expect(normalizeDisplayText(polluted)).toBe(`Proposal ${EM_DASH} Jun 12, 2026`);
  });

  it('leaves clean em dash text unchanged', () => {
    expect(normalizeDisplayText(`Proposal ${EM_DASH} Jun 12, 2026`)).toBe(
      `Proposal ${EM_DASH} Jun 12, 2026`,
    );
  });

  it('does not render mojibake after normalization', () => {
    const cleaned = normalizeDisplayText(`Proposal ${'\u00E2\u20AC\u201C'} Jun 12, 2026`);
    expect(cleaned).not.toContain('\u00E2\u20AC\u201C');
    expect(cleaned).not.toMatch(/â€/);
  });
});

describe('formatProposalPreviewSubtitle', () => {
  it('renders Proposal — with formatted date', () => {
    const subtitle = formatProposalPreviewSubtitle(new Date('2026-06-12T12:00:00'));
    expect(subtitle).toBe(`Proposal ${EM_DASH} Jun 12, 2026`);
    expect(subtitle).not.toMatch(/â€/);
  });
});
