import { describe, expect, it } from 'vitest';
import {
  buildProposalIntroduction,
  resolveProposalIntroductionForDisplay,
} from '../proposalIntroText';

describe('proposalIntroText', () => {
  it('builds a short intro without embedding scope text', () => {
    const intro = buildProposalIntroduction('Riverfront Slab');
    expect(intro).toContain('Riverfront Slab');
    expect(intro).toContain('scope of work');
    expect(intro).not.toContain('Pour 4-inch slab');
  });

  it('deduplicates legacy intro that embeds full scope', () => {
    const scope = 'Pour 4-inch slab with vapor barrier and finish.';
    const legacyIntro = `We are pleased to submit this proposal for Riverfront Slab. ${scope}`;

    const resolved = resolveProposalIntroductionForDisplay(
      legacyIntro,
      scope,
      'Riverfront Slab',
    );

    expect(resolved).not.toContain(scope);
    expect(resolved).toContain('Riverfront Slab');
    expect(resolved).toContain('scope of work');
  });

  it('preserves custom intro when scope is not duplicated', () => {
    const custom = 'Thank you for the opportunity to bid on this project.';
    expect(
      resolveProposalIntroductionForDisplay(
        custom,
        'Full scope text here.',
        'Project A',
      ),
    ).toBe(custom);
  });
});
