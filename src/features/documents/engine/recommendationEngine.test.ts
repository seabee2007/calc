import { describe, expect, it } from 'vitest';
import { recommendDocumentClauses } from './recommendationEngine';
import type { DocumentInput } from '../types';

function makeInput(
  answers: Record<string, unknown>,
  facts: Record<string, unknown> = {},
): DocumentInput {
  return { documentType: 'residential_contract', packKey: 'GENERIC_RESIDENTIAL', answers, facts };
}

describe('recommendDocumentClauses', () => {
  it('recommends the concrete differentiator addenda for concrete jobs', () => {
    const recs = recommendDocumentClauses(makeInput({ projectType: 'concrete' }));
    const recKeys = recs.map((r) => r.clauseKey);
    expect(recKeys).toContain('addendum.concrete');
    expect(recKeys).toContain('addendum.concrete_cracking');
    expect(recKeys).toContain('addendum.ready_mix');
  });

  it('marks the cracking disclaimer as critical', () => {
    const recs = recommendDocumentClauses(makeInput({ projectType: 'concrete' }));
    const cracking = recs.find((r) => r.clauseKey === 'addendum.concrete_cracking');
    expect(cracking?.severity).toBe('critical');
  });

  it('reflects acceptance state from accepted addendum keys', () => {
    const recs = recommendDocumentClauses(
      makeInput({ projectType: 'concrete' }, { acceptedAddendumKeys: ['addendum.concrete'] }),
    );
    const accepted = recs.find((r) => r.clauseKey === 'addendum.concrete');
    expect(accepted?.accepted).toBe(true);
  });

  it('does not duplicate a recommendation triggered by multiple rules', () => {
    const recs = recommendDocumentClauses(makeInput({ projectType: 'concrete', weatherSensitive: true }));
    const weatherCount = recs.filter((r) => r.clauseKey === 'weather.delay').length;
    expect(weatherCount).toBe(1);
  });

  it('returns no concrete recommendations for an unrelated project', () => {
    const recs = recommendDocumentClauses(makeInput({ projectType: 'fence' }));
    expect(recs.some((r) => r.clauseKey === 'addendum.concrete')).toBe(false);
  });
});
