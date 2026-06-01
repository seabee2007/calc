import { describe, expect, it } from 'vitest';
import { assembleDocument } from './documentAssembly';
import { ENGINE_VERSION, type DocumentInput } from '../types';

function makeInput(
  answers: Record<string, unknown>,
  packKey = 'GENERIC_RESIDENTIAL',
  facts: Record<string, unknown> = {},
): DocumentInput {
  return { documentType: 'residential_contract', packKey, answers, facts };
}

function keys(result: ReturnType<typeof assembleDocument>): string[] {
  return result.sections.map((s) => s.clauseKey);
}

describe('clause selection', () => {
  it('always includes the required master clauses', () => {
    const result = assembleDocument(makeInput({ projectType: 'remodel' }));
    expect(keys(result)).toContain('contract.title');
    expect(keys(result)).toContain('scope.work');
  });

  it('narrows pricing clauses to the selected price model', () => {
    const fixed = assembleDocument(makeInput({ projectType: 'remodel', priceModel: 'fixed_price' }));
    expect(keys(fixed)).toContain('pricing.fixed_price');
    expect(keys(fixed)).not.toContain('pricing.time_and_materials');
    expect(keys(fixed)).not.toContain('pricing.cost_plus');

    const tm = assembleDocument(
      makeInput({ projectType: 'remodel', priceModel: 'time_and_materials' }),
    );
    expect(keys(tm)).toContain('pricing.time_and_materials');
    expect(keys(tm)).not.toContain('pricing.fixed_price');
  });
});

describe('includeWhen gating', () => {
  it('omits answer-driven clauses until their answer is set', () => {
    const without = assembleDocument(makeInput({ projectType: 'remodel' }));
    expect(keys(without)).not.toContain('deposit.clause');
    expect(keys(without)).not.toContain('payment.retainage');

    const withDeposit = assembleDocument(
      makeInput({ projectType: 'remodel', depositRequired: true, retainage: true }),
    );
    expect(keys(withDeposit)).toContain('deposit.clause');
    expect(keys(withDeposit)).toContain('payment.retainage');
  });

  it('includes answer-driven addenda on a matching answer', () => {
    const withHoa = assembleDocument(makeInput({ projectType: 'remodel', hoa: true }));
    expect(keys(withHoa)).toContain('addendum.hoa_condo');
  });
});

describe('state notice layering', () => {
  it('appends locked statutory notices for a state pack', () => {
    const result = assembleDocument(makeInput({ projectType: 'remodel' }, 'CA_RESIDENTIAL'));
    expect(result.sections.some((s) => s.clauseKey.startsWith('notice.'))).toBe(true);
  });

  it('the generic pack has no locked notices', () => {
    const result = assembleDocument(makeInput({ projectType: 'remodel' }));
    expect(result.sections.some((s) => s.clauseKey.startsWith('notice.'))).toBe(false);
  });
});

describe('manifest', () => {
  it('records engine version, input snapshot, and a stable output hash', () => {
    const input = makeInput({ projectType: 'remodel', priceModel: 'fixed_price' });
    const a = assembleDocument(input);
    const b = assembleDocument(input);
    expect(a.manifest.engineVersion).toBe(ENGINE_VERSION);
    expect(a.manifest.inputSnapshot.packKey).toBe('GENERIC_RESIDENTIAL');
    expect(a.manifest.outputHash).toBe(b.manifest.outputHash);
  });

  it('changes the output hash when included content changes', () => {
    const base = assembleDocument(makeInput({ projectType: 'remodel' }));
    const withDeposit = assembleDocument(makeInput({ projectType: 'remodel', depositRequired: true }));
    expect(base.manifest.outputHash).not.toBe(withDeposit.manifest.outputHash);
  });

  it('carries recommendation decisions and mode from facts', () => {
    const input = makeInput({ projectType: 'remodel' }, 'GENERIC_RESIDENTIAL', {
      mode: 'advanced',
      recommendationDecisions: [{ clauseKey: 'addendum.concrete', accepted: false }],
    });
    const result = assembleDocument(input);
    expect(result.manifest.mode).toBe('advanced');
    expect(result.manifest.recommendationDecisions).toEqual([
      { clauseKey: 'addendum.concrete', accepted: false },
    ]);
  });
});
